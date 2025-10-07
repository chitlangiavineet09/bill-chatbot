// route.ts — multi-page, parallel classification/extraction (drop-in)

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { MessageService } from "@/lib/services/message-service";
import { ThreadService } from "@/lib/services/thread-service";
import { OpenAIService } from "@/lib/services/openai-service";
import { PDFService } from "@/lib/services/pdf-service";
import { generateThreadTitle } from "@/lib/utils";
import { db } from "@/lib/db";

// Ensure Node.js runtime (Buffer/Prisma)
export const runtime = "nodejs";

// ---- simple concurrency limiter (no deps) ----
function pLimit(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= max || queue.length === 0) return;
    active++;
    const fn = queue.shift()!;
    fn();
  };
  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(run);
      next();
    });
}

// CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

async function handleOCRStream(req: NextRequest, context: any) {
  console.log("OCR Stream - Function called (multi-page)");

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const threadId = (formData.get("threadId") as string) || "";

    const userId: string | undefined = context?.user?.id;
    
    console.log("OCR Stream - Received data:", { 
      fileName: file?.name, 
      threadId, 
      userId,
      hasFile: !!file,
      threadIdLength: threadId.length
    });
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const safeName =
      typeof (file as any).name === "string" && file.name ? file.name : "Untitled";
    const lowerName = safeName.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf");
    const isImage = /\.(png|jpg|jpeg)$/.test(lowerName);

    if (!isPdf && !isImage) {
      return new Response(
        JSON.stringify({
          error: "Please upload a PDF file or image (PNG, JPG, JPEG)",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Thread handling
    let currentThreadId = threadId;
    if (!currentThreadId) {
      // No thread provided, create a new one
      const thread = await ThreadService.createThread({
        title: `PDF Upload: ${safeName}`,
        userId,
      });
      currentThreadId = thread.id;
      console.log("OCR Stream - Created new thread:", currentThreadId);
    } else {
      // Thread provided, verify it exists and belongs to user
      const existingThread = await db.chatThread.findFirst({
        where: { id: currentThreadId, userId },
      });
      if (!existingThread) {
        console.error("OCR Stream - Thread not found or doesn't belong to user:", { threadId: currentThreadId, userId });
        return new Response(JSON.stringify({ 
          error: "Thread not found or access denied" 
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }
      console.log("OCR Stream - Using existing thread:", currentThreadId);
    }

    // Create user message indicating file upload
    await MessageService.createMessage({
      content: `📄 Uploaded file: ${safeName}`,
      threadId: currentThreadId,
      userId,
      role: "user",
      kind: "markdown",
    });

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Create SSE stream
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

        try {
          // Convert to images
          let pages: Array<{ base64Image: string; pageIndex?: number }>;
          if (isPdf) {
            pages = await PDFService.convertPDFToImages(fileBuffer);
          } else {
            const mimeType = file.type || "image/png";
            pages = [
              { base64Image: `data:${mimeType};base64,${fileBuffer.toString("base64")}` },
            ];
          }

          const totalPages = pages?.length || 0;
          if (!totalPages) throw new Error("No pages to process.");

          // Announce start
          send({ type: "start", total_pages: totalPages });

          // Progress: queueing all pages
          for (let i = 0; i < totalPages; i++) {
            send({ type: "progress", stage: "queued", page: i, doc_type: "Unknown", confidence: 0 });
          }

          // Concurrency limit (tune as needed)
          const limit = pLimit(Math.min(4, Math.max(1, totalPages))); // up to 4 at once
          const perPageResults: Array<{
            success: boolean;
            page_index: number;
            result?: {
              page_index: number;
              doc_type: string;
              confidence: number;
              brief_summary: string;
              key_hints: string[];
              extraction_data: Record<string, any>;
            };
            error?: string;
          }> = new Array(totalPages);

          // Kick off parallel processing
          const tasks = pages.map((p, idx) =>
            limit(async () => {
              try {
                send({ type: "progress", stage: "process_start", page: idx });

                const { pageResult, extractionData } = await OpenAIService.instance.processPage(
                  idx,
                  p.base64Image
                );

                const valid = {
                  page_index: pageResult?.page_index ?? idx,
                  doc_type: pageResult?.doc_type ?? "Unknown",
                  confidence: pageResult?.confidence ?? 0,
                  brief_summary: pageResult?.brief_summary ?? "Processing failed",
                  key_hints: pageResult?.key_hints ?? [],
                  extraction_data: extractionData ?? {},
                };

                // Save per-page result
                await MessageService.createMessage({
                  content: JSON.stringify([valid]),
                  threadId: currentThreadId,
                  userId,
                  role: "assistant",
                  kind: "page-results",
                });

                perPageResults[idx] = {
                  success: true,
                  page_index: idx,
                  result: valid,
                };

                // Stream per-page completion
                send({
                  type: "progress",
                  stage: "process_done",
                  page: idx,
                  doc_type: valid.doc_type,
                  confidence: valid.confidence,
                  extraction_data: valid.extraction_data,
                });
              } catch (err: any) {
                const msg = err instanceof Error ? err.message : String(err);
                perPageResults[idx] = { success: false, page_index: idx, error: msg };
                send({
                  type: "progress",
                  stage: "process_error",
                  page: idx,
                  error: msg,
                });
              }
            })
          );

          // Wait for all pages to settle (we want *every* page’s outcome)
          await Promise.allSettled(tasks);

          // Build final arrays
          const page_results = perPageResults
            .map((r) => r?.result)
            .filter(Boolean) as Array<NonNullable<typeof perPageResults[number]["result"]>>;

          // Group by doc_type: collect page spans & merge extraction data
          const groupedMap = new Map<
            string,
            { doc_type: string; page_spans: number[][]; data: any }
          >();

          for (const r of page_results) {
            const key = r.doc_type || "Unknown";
            if (!groupedMap.has(key)) {
              groupedMap.set(key, { 
                doc_type: key, 
                page_spans: [], 
                data: { doc_type: key, ...r.extraction_data } // Merge extraction data directly
              });
            }
            const g = groupedMap.get(key)!;
            g.page_spans.push([r.page_index]); // each page its own span; merge later if you wish
            
            // Merge additional extraction data (in case of multiple pages of same type)
            if (r.extraction_data) {
              g.data = { ...g.data, ...r.extraction_data };
            }
          }

          const grouped_results = Array.from(groupedMap.values());

          // Debug logging for grouped results
          console.log("OCR Stream - Grouped results structure:", JSON.stringify(grouped_results, null, 2));
          console.log("OCR Stream - First grouped result:", grouped_results[0]);
          console.log("OCR Stream - First grouped result data:", grouped_results[0]?.data);

          // Save grouped summary
          await MessageService.createMessage({
            content: JSON.stringify(grouped_results),
            threadId: currentThreadId,
            userId,
            role: "assistant",
            kind: "grouped-results",
          });

          // Title from first successful page
          const first = page_results[0];
          const ed = first?.extraction_data as Record<string, any> | undefined;
          const docNumber: string | undefined =
            ed?.invoice_no ??
            ed?.invoice_number ??
            ed?.lr_no ??
            ed?.ewaybill_no ??
            ed?.document_no ??
            ed?.doc_no ??
            undefined;

            const title = generateThreadTitle(first?.doc_type || "Unknown", docNumber ?? "");
          await ThreadService.updateThreadTitle(currentThreadId, title, userId);

          // Complete
          send({
            type: "complete",
            data: {
              num_pages: totalPages,
              page_results,
              grouped_results,
              // optional timings if you decide to add
              timings_ms: {},
            },
          });

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (error: any) {
          console.error("OCR Stream processing error:", error);
          send({ type: "error", error: error instanceof Error ? error.message : "Unknown error" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform", // important for SSE
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error: any) {
    console.error("OCR Stream API Error:", error);
    return new Response(JSON.stringify({ error: "OCR Stream processing failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export const POST = withAuth(handleOCRStream);
