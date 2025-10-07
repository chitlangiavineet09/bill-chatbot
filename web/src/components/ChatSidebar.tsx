"use client";
import { useState, useEffect } from "react";
import { MessageSquare, Plus, Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count: {
    messages: number;
  };
}

interface ChatSidebarProps {
  currentThreadId: string | null;
  onThreadSelect: (threadId: string) => void;
  onNewThread: () => void;
  className?: string;
  refreshTrigger?: number; // Add refresh trigger prop
}

export default function ChatSidebar({ 
  currentThreadId, 
  onThreadSelect, 
  onNewThread,
  className,
  refreshTrigger
}: ChatSidebarProps) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingThread, setEditingThread] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    loadThreads();
  }, []);

  // Refresh threads when refreshTrigger changes (e.g., when a new message is added)
  useEffect(() => {
    if (refreshTrigger) {
      loadThreads();
    }
  }, [refreshTrigger]);

  const loadThreads = async () => {
    try {
      const response = await fetch("/api/threads");
      if (response.ok) {
        const data = await response.json();
        // Filter out threads with 0 messages
        const threadsWithMessages = data.filter((thread: ChatThread) => thread._count.messages > 0);
        setThreads(threadsWithMessages);
      }
    } catch (error) {
      console.error("Failed to load threads:", error);
    } finally {
      setLoading(false);
    }
  };

  const deleteThread = async (threadId: string) => {
    // Find the thread to get its title for confirmation
    const thread = threads.find(t => t.id === threadId);
    const threadTitle = thread?.title || 'this thread';
    
    // Show confirmation dialog
    if (!confirm(`Are you sure you want to delete "${threadTitle}"? This will permanently delete the thread and all its messages.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: "DELETE",
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`Thread deleted successfully. ${result.deletedMessages} messages were also deleted.`);
        
        setThreads(threads.filter(thread => thread.id !== threadId && thread._count.messages > 0));
        if (currentThreadId === threadId) {
          onNewThread();
        }
      } else {
        const errorData = await response.json();
        console.error("Failed to delete thread:", errorData.error);
        alert(`Failed to delete thread: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
      alert("Failed to delete thread. Please try again.");
    }
  };

  const updateThreadTitle = async (threadId: string, newTitle: string) => {
    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      
      if (response.ok) {
        setThreads(threads.map(thread => 
          thread.id === threadId ? { ...thread, title: newTitle } : thread
        ).filter(thread => thread._count.messages > 0));
        setEditingThread(null);
        setEditingTitle("");
      }
    } catch (error) {
      console.error("Failed to update thread:", error);
    }
  };

  const startEditing = (thread: ChatThread) => {
    setEditingThread(thread.id);
    setEditingTitle(thread.title);
  };

  const cancelEditing = () => {
    setEditingThread(null);
    setEditingTitle("");
  };

  const handleEditSubmit = (threadId: string) => {
    if (editingTitle.trim()) {
      updateThreadTitle(threadId, editingTitle.trim());
    } else {
      cancelEditing();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className={cn("w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4", className)}>
        <div className="space-y-3">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("w-80 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Chat History</h2>
          <Button
            onClick={onNewThread}
            size="sm"
            className="flex items-center space-x-1"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </Button>
        </div>
      </div>

      {/* Threads List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {threads.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-sm">Start a new chat to begin</p>
          </div>
        ) : (
          threads.map((thread) => (
            <Card
              key={thread.id}
              className={cn(
                "group cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800",
                currentThreadId === thread.id && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
              )}
              onClick={() => onThreadSelect(thread.id)}
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {editingThread === thread.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => handleEditSubmit(thread.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleEditSubmit(thread.id);
                          } else if (e.key === "Escape") {
                            cancelEditing();
                          }
                        }}
                        className="w-full bg-transparent border-none outline-none text-sm font-medium text-gray-900 dark:text-white"
                        autoFocus
                      />
                    ) : (
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {thread.title}
                      </h3>
                    )}
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {thread._count.messages} messages
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatDate(thread.updatedAt)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditing(thread);
                      }}
                      className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteThread(thread.id);
                      }}
                      className="h-6 w-6 p-0 opacity-50 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
