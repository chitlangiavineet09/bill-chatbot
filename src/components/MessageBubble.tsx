"use client";
import DOMPurify from "isomorphic-dompurify";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { User, Bot } from "lucide-react";
import PageResultsTable from "./PageResultsTable";
import GroupedResultsCards from "./GroupedResultsCards";

type Msg =
  | { role: "user" | "assistant"; kind: "markdown"; content: string }
  | { role: "user" | "assistant"; kind: "html"; content: string }
  | { role: "assistant"; kind: "page-results"; content: unknown[] }
  | { role: "assistant"; kind: "grouped-results"; content: unknown[] };

export default function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  
  const renderContent = () => {
    if (msg.kind === "markdown") {
      return (
        <div className="prose prose-sm max-w-none prose-gray dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {msg.content}
          </ReactMarkdown>
        </div>
      );
    }
    if (msg.kind === "page-results") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <PageResultsTable results={msg.content as any} />;
    }
    if (msg.kind === "grouped-results") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return <GroupedResultsCards results={msg.content as any} />;
    }
    const clean = DOMPurify.sanitize(msg.content, { USE_PROFILES: { html: true } });
    return <div className="prose prose-sm max-w-none prose-gray dark:prose-invert" dangerouslySetInnerHTML={{ __html: clean }} />;
  };

  // Special handling for structured components that don't need bubble styling
  if (msg.kind === "page-results" || msg.kind === "grouped-results") {
    return (
      <div className="flex gap-3 p-4 justify-start">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 max-w-full">
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 p-4 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}
      
      <div className={`flex flex-col max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser 
            ? "bg-blue-600 text-white rounded-br-md" 
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-md"
        }`}>
          {renderContent()}
        </div>
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
          <User className="w-4 h-4 text-gray-600 dark:text-gray-300" />
        </div>
      )}
    </div>
  );
}
