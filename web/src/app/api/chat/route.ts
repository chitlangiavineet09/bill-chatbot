import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { MessageService } from "@/lib/services/message-service";
import { ThreadService } from "@/lib/services/thread-service";
import OpenAIService from "@/lib/services/openai-service";

async function handleChat(req: NextRequest, context: any) {
  try {
    const body = await req.json();
    const { message, threadId, files } = body;
    
    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let currentThreadId = threadId;

    // Create a new thread if none provided
    if (!currentThreadId) {
      const thread = await ThreadService.createThread({
        title: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
        userId: context.user.id
      });
      currentThreadId = thread.id;
    }

    // Create user message in database
    await MessageService.createMessage({
      content: message,
      role: "user",
      threadId: currentThreadId,
      userId: context.user.id
    });

    // Handle file uploads through OCR service if files are present
    if (files && files.length > 0) {
      return handleFileUpload(req, currentThreadId, context.user.id, files);
    }

    // For text-only messages, use OpenAI directly with bill details
    try {
      // Get recent messages for conversation history
      const recentMessages = await MessageService.getMessagesByThreadId(currentThreadId, 10);
      const conversationHistory = recentMessages
        .filter((msg: any) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg: any) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        }));

      // Get bill details from messages with grouped-results kind
      const billDetailsMessages = recentMessages.filter((msg: any) => msg.kind === 'grouped-results');
      const billDetails = billDetailsMessages.map((msg: any) => {
        try {
          return JSON.parse(msg.content);
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      // Use OpenAI service to chat with bill details
      const response = await OpenAIService.chatWithBillDetails(
        message,
        billDetails,
        conversationHistory
      );

      // Save the assistant response
      await MessageService.createMessage({
        content: response,
        role: "assistant",
        threadId: currentThreadId,
        userId: context.user.id
      });

      // Return the response as a simple JSON response
      return new Response(JSON.stringify({
        role: "assistant",
        content: response
      }), {
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      console.error("Error in OpenAI chat:", error);
      return new Response(JSON.stringify({ 
        error: "Failed to process your message. Please try again." 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleFileUpload(_req: NextRequest, threadId: string, userId: string, files: any[]) {
  try {
    // For now, we'll handle the first file (PDF) through the OCR service
    // In a real implementation, you'd need to convert the file data to a proper upload
    const file = files[0];
    
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      return new Response(JSON.stringify({ error: "Please upload a PDF file" }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Create a message indicating file upload
    await MessageService.createMessage({
      content: `📄 Uploaded file: ${file.name}`,
      role: "user",
      threadId: threadId,
      userId: userId
    });

    // Convert file to FormData for OCR service
    const formData = new FormData();
    formData.append("file", file);
    formData.append("threadId", threadId);
    formData.append("userId", userId);

    const url = `${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/ocr-stream`;
    const res = await fetch(url, { 
      method: "POST", 
      body: formData
    });
    
    if (!res.ok) {
      throw new Error(`Backend error: ${res.status} ${res.statusText}`);
    }

    // Stream the response back to the client and save assistant messages
    const readable = res.body;
    if (!readable) {
      throw new Error("No response body from external API");
    }

    // Create a transform stream to save assistant messages
    const transformStream = new TransformStream({
      start(controller) {
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";
        let assistantMessage = "";

        const reader = readable.getReader();
        
        const processChunk = async () => {
          try {
            const { done, value } = await reader.read();
            
            if (done) {
              // Save the complete assistant message
              if (assistantMessage.trim()) {
                try {
                  await MessageService.createMessage({
                    content: assistantMessage,
                    role: "assistant",
                    threadId: threadId,
                    userId: userId
                  });
                } catch (error) {
                  console.error("Failed to save assistant message:", error);
                }
              }
              // Stream completed
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  // Save the complete assistant message
                  if (assistantMessage.trim()) {
                    try {
                      await MessageService.createMessage({
                        content: assistantMessage,
                        role: "assistant",
                        threadId: threadId,
                        userId: userId
                      });
                    } catch (error) {
                      console.error("Failed to save assistant message:", error);
                    }
                  }
                  controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                  return;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  
                  // Handle different types of OCR responses
                  if (parsed.type === 'start') {
                    const message = `📄 **Processing PDF file...**\n\nTotal pages: ${parsed.total_pages}\n\nProcessing pages in real-time...`;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      role: "assistant",
                      content: message
                    })}\n\n`));
                    assistantMessage += message + "\n\n";
                  } else if (parsed.type === 'page_result') {
                    const pageResult = parsed.page_result;
                    const message = `**Page ${pageResult.page_index + 1}:** ${pageResult.doc_type} (${Math.round(pageResult.confidence * 100)}% confidence)`;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      role: "assistant",
                      content: message
                    })}\n\n`));
                    assistantMessage += message + "\n";
                  } else if (parsed.type === 'complete') {
                    const message = `✅ **Document processing completed!**\n\nProcessed ${parsed.processed_pages} out of ${parsed.total_pages} pages successfully.`;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      role: "assistant",
                      content: message
                    })}\n\n`));
                    assistantMessage += message + "\n";
                  } else if (parsed.type === 'error') {
                    const message = `❌ **Error processing document:** ${parsed.error}`;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                      role: "assistant",
                      content: message
                    })}\n\n`));
                    assistantMessage += message + "\n";
                  }
                } catch (e) {
                  console.error("Failed to parse SSE data:", e);
                }
              }
            }
            
            // Continue processing
            processChunk();
          } catch (error) {
            console.error("Error processing chunk:", error);
            controller.error(error);
          }
        };
        
        processChunk();
      }
    });

    return new Response(transformStream.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
      },
    });
  } catch (error) {
    console.error("File upload error:", error);
    return new Response(JSON.stringify({ error: "File upload failed" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export const POST = withAuth(handleChat);
