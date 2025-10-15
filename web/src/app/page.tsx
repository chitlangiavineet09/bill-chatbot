"use client";
import { useState, useRef, useEffect } from "react";
import MessageBubble from "@/components/MessageBubble";
import ChatSidebar from "@/components/ChatSidebar";
import { Send, Paperclip, Settings, Menu, X, MessageSquare, Plus } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";
import UserHeader from "@/components/UserHeader";
import { Button } from "@/components/ui/button";

type Msg =
  | { role: "user" | "assistant"; kind: "markdown"; content: string }
  | { role: "user" | "assistant"; kind: "html"; content: string }
  | { role: "assistant"; kind: "page-results"; content: unknown[] }
  | { role: "assistant"; kind: "grouped-results"; content: unknown[] };

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [files, setFiles] = useState<File[]>([]);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load messages for current thread
  useEffect(() => {
    if (currentThreadId) {
      loadMessages(currentThreadId);
    } else {
      setMessages([]);
    }
  }, [currentThreadId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadMessages = async (threadId: string) => {
    try {
      const response = await fetch(`/api/messages?threadId=${threadId}`);
      if (response.ok) {
        const data = await response.json();
        console.log("Loaded messages from database:", data);
        console.log("Number of messages:", data.length);
        console.log("Message types:", data.map((m: any) => ({ role: m.role, kind: m.kind })));
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const createNewThread = async () => {
    try {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      
      if (response.ok) {
        const thread = await response.json();
        setCurrentThreadId(thread.id);
        setMessages([]);
        setFiles([]);
      }
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  };

  const handleThreadSelect = (threadId: string) => {
    setCurrentThreadId(threadId);
  };


  const triggerSidebarRefresh = () => {
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      // Process files immediately when selected
      for (const file of selectedFiles) {
        await onUpload(file);
      }
      // Clear the input so the same file can be selected again
      e.target.value = '';
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const send = async () => {
    if ((!input.trim() && files.length === 0) || isLoading) return;
    
    // Create a new thread if none exists
    if (!currentThreadId) {
      await createNewThread();
      return;
    }
    
    // Only add text message if there's input
    if (input.trim()) {
      const userMsg: Msg = { role: "user", kind: "markdown", content: input };
      setMessages((m) => [...m, userMsg]);
      // Trigger sidebar refresh to show the thread with messages
      triggerSidebarRefresh();
    }
    setInput("");
    setIsLoading(true);
    
    try {
      let response;
      
      // Handle file uploads differently
      if (files.length > 0) {
        const file = files[0];
        if (!file) {
          throw new Error("No file selected");
        }
        
        console.log("Frontend - Uploading file:", file.name, "Size:", file.size, "Type:", file.type);
        console.log("Frontend - Thread ID:", currentThreadId);
        
        // For file uploads, use FormData and call /api/ocr-stream directly
        const formData = new FormData();
        formData.append("file", file);
        formData.append("threadId", currentThreadId);
        
        console.log("Frontend - Calling /api/ocr-stream...");
        response = await fetch("/api/ocr-stream", { 
          method: "POST", 
          body: formData
        });
        console.log("Frontend - Response status:", response.status, response.statusText);
      } else {
        // For text messages, use JSON and call /api/chat
        response = await fetch("/api/chat", { 
          method: "POST", 
          body: JSON.stringify({ 
            message: input.trim(),
            threadId: currentThreadId
          }), 
          headers: { "Content-Type": "application/json" } 
        });
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle file uploads with streaming response
      if (files.length > 0) {
        // For file uploads, reload messages to get the user message created by the API
        await loadMessages(currentThreadId);
        triggerSidebarRefresh(); // Update sidebar to show the thread with messages
        const progressMsg: Msg = { role: "assistant", kind: "markdown", content: `⏳ **Starting document processing...**\n\nProcessing pages in real-time...` };
        setMessages((m) => [...m, progressMsg]);
        
        // Save the progress message to DB
        try {
          await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: progressMsg.content,
              role: "assistant",
              threadId: currentThreadId
            })
          });
        } catch (error) {
          console.error("Failed to save progress message:", error);
        }

        // Handle streaming response for file uploads
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let totalPages = 0;
        let processedPages = 0;
        const pageResults: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || "";

        for (const line of lines) {
          console.log("Frontend received line:", line);
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            console.log("Frontend received data:", data);
            if (data === '[DONE]') {
              console.log("Frontend received [DONE] signal");
              setIsLoading(false);
              return;
            }
            try {
              const parsed = JSON.parse(data);
              console.log("Frontend parsed streaming data:", parsed);
              console.log("Event type:", parsed.type);
              console.log("Full event data:", JSON.stringify(parsed, null, 2));
              
              // Handle OCR streaming responses
              if (files.length > 0) {
                if (parsed.type === 'start') {
                  totalPages = parsed.total_pages;
                  setMessages((m) => [
                    ...m.slice(0, -1), // Remove previous progress message
                    { role: "assistant", kind: "markdown", content: `🚀 **Processing ${totalPages} pages in parallel...**\n\nResults will appear as each page completes (not necessarily in order)...` }
                  ]);
                } else if (parsed.type === 'progress' && (parsed.stage === 'process' || parsed.stage === 'process_done')) {
                  console.log("Frontend processing page progress:", parsed);
                  processedPages++;
                  
                  // Create a page result object from the progress data
                  const pageResult = {
                    page_index: parsed.page,
                    doc_type: parsed.doc_type,
                    confidence: parsed.confidence,
                    extraction_data: parsed.extraction_data
                  };
                  pageResults.push(pageResult);
                  
                  // Show individual page completion with key details
                  const docIcon = parsed.doc_type === 'TaxInvoice' ? '🧾' : 
                                  parsed.doc_type === 'EWayBill' ? '🚚' :
                                  parsed.doc_type === 'LorryReceipt' ? '📋' : '📄';
                  
                  // Extract key identifier from extraction data
                  const extractedData = parsed.extraction_data || {};
                  const keyId = extractedData.invoice_no || 
                               extractedData.invoice_number || 
                               extractedData.lr_no || 
                               extractedData.ewaybill_no || 
                               extractedData.document_no || '';
                  const keyIdText = keyId ? ` - **${keyId}**` : '';
                  
                  // Update progress message with individual page details
                  const docTypes = [...new Set(pageResults.map(p => p.doc_type))];
                  const confidencePercent = Math.round(parsed.confidence * 100);
                  
                  setMessages((m) => [
                    ...m.slice(0, -1), // Remove previous progress message
                    { role: "assistant", kind: "markdown", content: `⚡ **Processing: ${processedPages}/${totalPages} pages completed**\n\n${docIcon} **Page ${parsed.page + 1}:** ${parsed.doc_type}${keyIdText} (${confidencePercent}% confidence)\n\n📋 **Document types found:** ${docTypes.join(', ')}` }
                  ]);
                } else if (parsed.type === 'page_error') {
                  processedPages++;
                  setMessages((m) => [
                    ...m,
                    { role: "assistant", kind: "markdown", content: `❌ **Error processing page ${parsed.page_index + 1}:** ${parsed.error}` }
                  ]);
                } else if (parsed.type === 'complete') {
                  console.log("Frontend processing completion:", parsed);
                  console.log("Completion data:", parsed.data);
                  
                  // Display completion summary immediately
                  const docTypes = [...new Set(pageResults.map(p => p.doc_type))];
                  const completionData = parsed.data || {};
                  
                  // Use the data from the stream directly instead of fetching from database
                  // This is more reliable and faster
                  const pageResultsFromStream = completionData.page_results || [];
                  const groupedResultsFromStream = completionData.grouped_results || [];
                  
                  console.log("Page results from stream:", pageResultsFromStream.length);
                  console.log("Grouped results from stream:", groupedResultsFromStream.length);
                  
                  // Build the final messages
                  const finalMessages: Msg[] = [
                    { role: "assistant", kind: "markdown", content: `✅ **Processing completed!**\n\n📊 **Summary:**\n- **Total pages:** ${totalPages}\n- **Successfully processed:** ${completionData.num_pages || pageResults.length}\n- **Document types found:** ${docTypes.join(', ')}` }
                  ];
                  
                  // Add page results if available
                  if (pageResultsFromStream.length > 0) {
                    finalMessages.push({
                      role: "assistant",
                      kind: "page-results",
                      content: pageResultsFromStream
                    });
                  }
                  
                  // Add grouped results if available
                  if (groupedResultsFromStream.length > 0) {
                    finalMessages.push({
                      role: "assistant",
                      kind: "grouped-results",
                      content: groupedResultsFromStream
                    });
                  }
                  
                  // Update messages with all results
                  setMessages((m) => [
                    ...m.slice(0, -1), // Remove progress message
                    ...finalMessages
                  ]);
                  
                  // Trigger sidebar refresh
                  triggerSidebarRefresh();
                  console.log("Results displayed from stream data");
                } else if (parsed.type === 'error') {
                  throw new Error(parsed.error);
                } else {
                  console.log("Unknown event type:", parsed.type, parsed);
                }
              } else {
                // Handle regular chat responses
                if (parsed.role === 'assistant' && parsed.content) {
                  setMessages((m) => [...m, { role: "assistant", kind: "markdown", content: parsed.content }]);
                }
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
        }
      } else {
        // Handle text messages with JSON response
        const data = await response.json();
        console.log("Chat API response:", data);
        
        if (data.role === "assistant" && data.content) {
          // Add the assistant response to the UI
          const assistantMsg: Msg = { 
            role: "assistant", 
            kind: "markdown", 
            content: data.content 
          };
          setMessages((m) => [...m, assistantMsg]);
        }
        
        // Reload messages to get the latest from database
        await loadMessages(currentThreadId);
        triggerSidebarRefresh();
      }
    } catch (error) {
          console.error("Error in send:", error);
          setMessages((m) => [...m, { role: "assistant", kind: "markdown", content: "Sorry, there was an error processing your request." }]);
        } finally {
          setIsLoading(false);
          setFiles([]); // Clear files after processing
        }
  };

  const onUpload = async (file: File) => {
    console.log("=== onUpload called ===");
    console.log("File:", file.name, "Size:", file.size, "Type:", file.type);
    console.log("Current thread ID:", currentThreadId);
    
    // Add the file to the files array and trigger the send function
    setFiles([file]);
    
    // Create a new thread if none exists
    if (!currentThreadId) {
      console.log("No thread exists, creating new one...");
      await createNewThread();
      return;
    }
    
    console.log("Calling send() with file...");
    // Use the existing send function to handle the file upload
    await send();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar */}
      {sidebarOpen && (
        <ChatSidebar
          currentThreadId={currentThreadId}
          onThreadSelect={handleThreadSelect}
          onNewThread={createNewThread}
          refreshTrigger={sidebarRefreshTrigger}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Bill Chatbot</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">Upload PDFs and ask questions about bill processing</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <UserHeader />
              <Link
                href="/settings"
                className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
                <span className="text-sm font-medium">Settings</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {messages.length === 0 && !currentThreadId ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Welcome to Bill Chatbot</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">Start a new conversation to begin</p>
                  <Button onClick={createNewThread} className="flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Start New Chat</span>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                {isLoading && (
                  <div className="flex gap-3 p-4 justify-start">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                      <LoadingSpinner size="sm" />
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
              </>
            )}
          </div>
        </div>

        {/* File Attachments */}
        {files.length > 0 && (
          <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-wrap gap-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center space-x-2 bg-white dark:bg-gray-700 rounded-lg px-3 py-2 border border-gray-200 dark:border-gray-600">
                    <Paperclip className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileSelect}
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
                disabled={(!input.trim() && files.length === 0) || isLoading}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-2xl transition-colors duration-200 flex items-center justify-center"
              >
                {isLoading ? (
                  <LoadingSpinner size="sm" />
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
    </div>
  );
}
