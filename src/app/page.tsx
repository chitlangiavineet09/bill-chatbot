"use client";
import { useState, useRef, useEffect } from "react";
import MessageBubble from "@/components/MessageBubble";
import { Send, Paperclip, Loader2, Settings } from "lucide-react";
import Link from "next/link";

type Msg =
  | { role: "user" | "assistant"; kind: "markdown"; content: string }
  | { role: "user" | "assistant"; kind: "html"; content: string }
  | { role: "assistant"; kind: "page-results"; content: unknown[] }
  | { role: "assistant"; kind: "grouped-results"; content: unknown[] };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", kind: "markdown", content: "Hi! I'm your Bill Chatbot. Upload a PDF and I'll parse it, or ask me anything about bill creation and management." },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to extract key data for summary
  const extractKeyData = (extractionData: any, docType: string): string | null => {
    if (!extractionData || typeof extractionData !== 'object') return null;
    
    const keyFields: string[] = [];
    
    // Common fields across document types
    if (extractionData.invoice_number) keyFields.push(`**Invoice No:** ${extractionData.invoice_number}`);
    if (extractionData.date) keyFields.push(`**Date:** ${extractionData.date}`);
    if (extractionData.total_amount) keyFields.push(`**Total Amount:** ₹${extractionData.total_amount}`);
    if (extractionData.supplier?.name) keyFields.push(`**Supplier:** ${extractionData.supplier.name}`);
    if (extractionData.buyer?.name) keyFields.push(`**Buyer:** ${extractionData.buyer.name}`);
    
    // Document type specific fields
    if (docType === 'TaxInvoice') {
      if (extractionData.gstin) keyFields.push(`**GSTIN:** ${extractionData.gstin}`);
      if (extractionData.irn) keyFields.push(`**IRN:** ${extractionData.irn}`);
      if (extractionData.taxable_value) keyFields.push(`**Taxable Value:** ₹${extractionData.taxable_value}`);
    } else if (docType === 'DeliveryChallan') {
      if (extractionData.dc_no) keyFields.push(`**DC No:** ${extractionData.dc_no}`);
      if (extractionData.vehicle?.number) keyFields.push(`**Vehicle:** ${extractionData.vehicle.number}`);
    } else if (docType === 'LorryReceipt') {
      if (extractionData.lr_no) keyFields.push(`**LR No:** ${extractionData.lr_no}`);
      if (extractionData.consignor?.name) keyFields.push(`**Consignor:** ${extractionData.consignor.name}`);
      if (extractionData.consignee?.name) keyFields.push(`**Consignee:** ${extractionData.consignee.name}`);
    } else if (docType === 'PackingList') {
      if (extractionData.packing_list_no) keyFields.push(`**Packing List No:** ${extractionData.packing_list_no}`);
      if (extractionData.total_packages) keyFields.push(`**Total Packages:** ${extractionData.total_packages}`);
      if (extractionData.gross_weight_kg) keyFields.push(`**Gross Weight:** ${extractionData.gross_weight_kg} kg`);
    } else if (docType === 'PurchaseOrder') {
      if (extractionData.po_no) keyFields.push(`**PO No:** ${extractionData.po_no}`);
      if (extractionData.supplier?.name) keyFields.push(`**Supplier:** ${extractionData.supplier.name}`);
    }
    
    return keyFields.length > 0 ? keyFields.join('\n') : null;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const send = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: Msg = { role: "user", kind: "markdown", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsLoading(true);
    
    try {
      // Send POST request to start the chat
      const response = await fetch("/api/chat", { 
        method: "POST", 
        body: JSON.stringify({ message: userMsg.content }), 
        headers: { "Content-Type": "application/json" } 
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle the streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              setIsLoading(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.role === 'assistant' && parsed.content) {
                setMessages((m) => [...m, { role: "assistant", kind: "markdown", content: parsed.content }]);
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error in send:", error);
      setMessages((m) => [...m, { role: "assistant", kind: "markdown", content: "Sorry, there was an error processing your request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const onUpload = async (file: File) => {
    setIsLoading(true);
    const userMsg: Msg = { role: "user", kind: "markdown", content: `📄 Uploaded file: ${file.name}` };
    setMessages((m) => [...m, userMsg]);
    
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ocr-stream", { method: "POST", body: fd });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP error! status: ${res.status}`;
        throw new Error(errorMessage);
      }
      
      // Handle streaming response
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("No response body reader available");
      }
      
      const decoder = new TextDecoder();
      let totalPages = 0;
      let processedPages = 0;
      const pageResults: any[] = [];
      const extractionData: any[] = [];
      
      // Add initial progress message
      const progressMsg: Msg = { role: "assistant", kind: "markdown", content: `⏳ **Starting document processing...**\n\nProcessing pages in real-time...` };
      setMessages((m) => [...m, progressMsg]);
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'start') {
                  totalPages = data.total_pages;
                  setMessages((m) => [
                    ...m.slice(0, -1), // Remove previous progress message
                    { role: "assistant", kind: "markdown", content: `🚀 **Processing ${totalPages} pages in parallel...**\n\nResults will appear as each page completes (not necessarily in order)...` }
                  ]);
                } else if (data.type === 'page_result') {
                  processedPages++;
                  pageResults.push(data.page_result);
                  extractionData.push(data.extraction_data);
                  
                  // Add full extracted data immediately (no page-by-page classification)
                  const extractionMsg: Msg = { 
                    role: "assistant", 
                    kind: "grouped-results", 
                    content: [{
                      doc_type: data.page_result.doc_type,
                      page_spans: [[data.page_index]],
                      data: data.extraction_data
                    }]
                  };
                  setMessages((m) => [...m, extractionMsg]);
                  
                  // Add summary of key extracted data
                  const keyData = extractKeyData(data.extraction_data, data.page_result.doc_type);
                  if (keyData) {
                    const summaryMsg: Msg = { 
                      role: "assistant", 
                      kind: "markdown", 
                      content: `📄 **Page ${data.page_index + 1} - ${data.page_result.doc_type} Summary:**\n\n${keyData}` 
                    };
                    setMessages((m) => [...m, summaryMsg]);
                  }
                  
                  // Update progress with parallel processing info
                  const docTypes = [...new Set(pageResults.map(p => p.doc_type))];
                  setMessages((m) => [
                    ...m.slice(0, -1), // Remove previous progress message
                    { role: "assistant", kind: "markdown", content: `⚡ **Parallel processing: ${processedPages}/${totalPages} pages completed**\n\n📋 **Document types found so far:** ${docTypes.join(', ')}` }
                  ]);
                } else if (data.type === 'page_error') {
                  processedPages++;
                  setMessages((m) => [
                    ...m,
                    { role: "assistant", kind: "markdown", content: `❌ **Error processing page ${data.page_index + 1}:** ${data.error}` }
                  ]);
                } else if (data.type === 'complete') {
                  // Processing complete - show page-by-page classification analysis at the end
                  const docTypes = [...new Set(pageResults.map(p => p.doc_type))];
                  setMessages((m) => [
                    ...m.slice(0, -1), // Remove progress message
                    { role: "assistant", kind: "markdown", content: `✅ **Parallel processing completed!**\n\n📊 **Summary:**\n- **Total pages:** ${totalPages}\n- **Successfully processed:** ${data.processed_pages}\n- **Document types found:** ${docTypes.join(', ')}\n- **Processing method:** Parallel (all pages processed simultaneously)` }
                  ]);
                  
                  // Add page-by-page classification analysis at the end
                  if (pageResults.length > 0) {
                    const pageAnalysisMsg: Msg = { 
                      role: "assistant", 
                      kind: "page-results", 
                      content: pageResults 
                    };
                    setMessages((m) => [...m, pageAnalysisMsg]);
                  }
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (parseError) {
                console.error('Error parsing stream data:', parseError);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      
    } catch (error) {
      console.error("OCR Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setMessages((m) => [
        ...m.slice(0, -1), // Remove the progress message
        { role: "assistant", kind: "markdown", content: `❌ **Error processing document:**\n\n${errorMessage}\n\nPlease try again or contact support if the issue persists.` }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Bill Chatbot</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Upload PDFs and ask questions about bill processing</p>
          </div>
          <Link
            href="/settings"
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5" />
            <span className="text-sm font-medium">Settings</span>
          </Link>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
          {isLoading && (
            <div className="flex gap-3 p-4 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              </div>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <div className="flex-1 relative">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                disabled={isLoading}
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input
                className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-2xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here... (Shift+Enter for new line)"
                disabled={isLoading}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-2xl transition-colors duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            Upload PDF files or ask questions about bill processing
          </p>
        </div>
      </div>
    </div>
  );
}
