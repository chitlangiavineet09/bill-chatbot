// src/lib/services/openai-service.ts  (DROP-IN REPLACEMENT)

import OpenAI from "openai";
import fs from 'fs';
import path from 'path';

// Load prompts and structure from JSON files (matches Python implementation)
const prompts = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'prompts.json'), 'utf8'));
const structure = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'structure.json'), 'utf8'));

// Document type order for validation (matches Python implementation)
const TYPE_ORDER = [
  "TaxInvoice", "EWayBill", "LorryReceipt", "PackingList", "DeliveryChallan",
  "PurchaseOrder", "CreditNote", "DebitNote", "PaymentAdvice", "ZetwerkInspectionReport",
  "MaterialReport", "WeighmentSlip", "TestCertificate", "GatePass", "BillOfLading",
  "QuotationProforma", "Unknown"
];

type PageResult = {
  page_index: number;
  doc_type: string;
  confidence: number;
  brief_summary: string;
  key_hints: string[];
};

type ProcessResult = {
  pageResult: PageResult;
  extractionData: Record<string, any> | null;
};

type ClassifyResponseShape = {
  page_index: number;
  doc_type: string;
  confidence: number;
  brief_summary?: string;
  key_hints?: string[];
};

type ExtractResponseShape = Record<string, any>;

const SUPPORTED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

/**
 * Parse and normalize a data URL without using named capture groups.
 * Returns a clean data URL string + approximate size in bytes.
 */
function normalizeDataUrlNoNamedGroups(input: string): { url: string; mime: string; approxBytes: number } {
  const trimmed = input.trim();

  // data:<mime>;base64,<b64>
  if (!trimmed.startsWith("data:image/")) {
    throw new Error("Invalid data URL: must start with data:image/<type>;");
  }

  const headerEnd = trimmed.indexOf(";base64,");
  if (headerEnd === -1) {
    throw new Error("Invalid data URL: missing ';base64,' segment");
  }

  const mime = trimmed.slice("data:".length, headerEnd).toLowerCase(); // e.g. image/png
  if (!SUPPORTED_MIME.has(mime)) {
    throw new Error(`Unsupported image mime: ${mime}`);
  }

  const b64Start = headerEnd + ";base64,".length;
  const b64Raw = trimmed.slice(b64Start).replace(/\s+/g, "");
  if (!b64Raw) {
    throw new Error("Invalid data URL: empty base64 payload");
  }

  // Estimate size from base64 length
  const approxBytes = Math.floor((b64Raw.length * 3) / 4) - (b64Raw.endsWith("==") ? 2 : b64Raw.endsWith("=") ? 1 : 0);
  const clean = `data:${mime};base64,${b64Raw}`;
  return { url: clean, mime, approxBytes };
}

export class OpenAIService {
  private static _instance: OpenAIService | null = null;

  private client: OpenAI;
  // Vision-capable chat models
  private MODEL_CLASSIFY = process.env.OCR_MODEL_CLASSIFY || "gpt-4.1";
  private MODEL_EXTRACT  = process.env.OCR_MODEL_EXTRACT  || "gpt-4.1";

  private constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  static get instance() {
    if (!this._instance) this._instance = new OpenAIService();
    return this._instance;
  }

  /**
   * Validate either a data URL or an https URL; returns normalized url and approx bytes.
   */
  private prepareImageUrl(imageUrl: string): { url: string; approxBytes: number } {
    // Accept HTTPS image URLs as-is (vision models expect {image_url:{url}}). 
    // Ensure you only pass real image URLs here.
    if (/^https:\/\//i.test(imageUrl)) {
      return { url: imageUrl, approxBytes: 0 };
    }
    // Otherwise parse data URL without named groups
    const n = normalizeDataUrlNoNamedGroups(imageUrl);
    return { url: n.url, approxBytes: n.approxBytes };
  }

  /**
   * Classify a single page image.
   */
  async classifyPage(page_index: number, imageDataUrl: string): Promise<ClassifyResponseShape> {
    const { url, approxBytes } = this.prepareImageUrl(imageDataUrl);

    // Guard very large images (~20MB/image typical practical ceiling)
    if (approxBytes > 20 * 1024 * 1024) {
      throw new Error(`Image too large (~${Math.round(approxBytes / (1024 * 1024))}MB). Please upload a smaller page image.`);
    }

    const prompt = prompts.classification.content;

    const request = (detail: "low" | "high") =>
      this.client.chat.completions.create({
        model: this.MODEL_CLASSIFY,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              // Correct vision payload shape: image_url must be an object. 
              // Passing a string causes "expected an object, got string" / invalid_image_url. 
              // Docs: Chat API content parts. 
              { type: "image_url", image_url: { url, detail } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      });

    try {
      const resp = await request("low");
      const text = resp.choices?.[0]?.message?.content?.trim() || "{}";
      const parsed = JSON.parse(text) as Partial<ClassifyResponseShape>;
      
      // Validate document type against TYPE_ORDER
      let docType = parsed.doc_type ?? "Unknown";
      if (!TYPE_ORDER.includes(docType)) {
        docType = "Unknown";
      }
      
      return {
        page_index,
        doc_type: docType,
        confidence: Number(parsed.confidence ?? 0),
        brief_summary: parsed.brief_summary ?? "",
        key_hints: Array.isArray(parsed.key_hints) ? parsed.key_hints.slice(0, 6) : [],
      };
    } catch (err: any) {
      // Targeted retry for invalid_image_url with detail:"high"
      if (err?.code === "invalid_image_url" || /invalid[_ ]image/i.test(String(err?.message))) {
        const resp = await request("high");
        const text = resp.choices?.[0]?.message?.content?.trim() || "{}";
        const parsed = JSON.parse(text) as Partial<ClassifyResponseShape>;
        
        // Validate document type against TYPE_ORDER
        let docType = parsed.doc_type ?? "Unknown";
        if (!TYPE_ORDER.includes(docType)) {
          docType = "Unknown";
        }
        
        return {
          page_index,
          doc_type: docType,
          confidence: Number(parsed.confidence ?? 0),
          brief_summary: parsed.brief_summary ?? "",
          key_hints: Array.isArray(parsed.key_hints) ? parsed.key_hints.slice(0, 6) : [],
        };
      }
      throw err;
    }
  }

  /**
   * Get document schema for a specific document type
   */
  private getDocumentSchema(docType: string): Record<string, any> {
    if (!structure.$defs || !structure.$defs[docType]) {
      console.warn(`No schema found for document type: ${docType}`);
      return {};
    }
    return structure.$defs[docType];
  }

  /**
   * Extract structured data from a single page given its doc_type.
   */
  async extractPage(_page_index: number, docType: string, imageDataUrl: string): Promise<ExtractResponseShape> {
    const { url } = this.prepareImageUrl(imageDataUrl);

    // Get the schema for this document type
    const schema = this.getDocumentSchema(docType);
    
    const prompt = `${prompts.extraction.content}

Document type: ${docType}
Return STRICT JSON exactly as per this schema (set null if unknown):
${JSON.stringify(schema, null, 2)}

IMPORTANT:
- Fill "pages_used" with the list of page indices you actually referenced.
- Follow the schema structure exactly.
- Use null for missing fields, not empty strings or arrays.
- Output ONLY the JSON object, no prose, no markdown.`;

    const resp = await this.client.chat.completions.create({
      model: this.MODEL_EXTRACT,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url, detail: "high" } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const text = resp.choices?.[0]?.message?.content?.trim() || "{}";
    try {
      return JSON.parse(text);
    } catch {
      return { _raw: text };
    }
  }

  /**
   * Full page flow: classify; if confident and known, extract.
   */
  async processPage(page_index: number, imageDataUrl: string, minConfidence = 0.35): Promise<ProcessResult> {
    const cls = await this.classifyPage(page_index, imageDataUrl);

    const pageResult: PageResult = {
      page_index,
      doc_type: cls.doc_type || "Unknown",
      confidence: Number(cls.confidence || 0),
      brief_summary: cls.brief_summary || "",
      key_hints: cls.key_hints || [],
    };

    if (!pageResult.doc_type || pageResult.doc_type === "Unknown" || pageResult.confidence < minConfidence) {
      return { pageResult, extractionData: null };
    }

    const extractionData = await this.extractPage(page_index, pageResult.doc_type, imageDataUrl);
    return { pageResult, extractionData };
  }
}

export default OpenAIService.instance;
