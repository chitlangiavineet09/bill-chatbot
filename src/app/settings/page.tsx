"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, Save, RotateCcw, Settings, FileText, MessageSquare, Search, Database } from "lucide-react";
import Link from "next/link";
import StructureEditor from "@/components/StructureEditor";

interface Prompt {
  name: string;
  description: string;
  content: string;
}

interface PromptsData {
  classification: Prompt;
  extraction: Prompt;
  chat: Prompt;
}

type SettingsTab = keyof PromptsData | "structure";

export default function SettingsPage() {
  const [prompts, setPrompts] = useState<PromptsData>({
    classification: { name: "", description: "", content: "" },
    extraction: { name: "", description: "", content: "" },
    chat: { name: "", description: "", content: "" }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [activeTab, setActiveTab] = useState<SettingsTab>("classification");

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = async () => {
    try {
      const response = await fetch("/api/prompts");
      if (response.ok) {
        const data = await response.json();
        setPrompts(data);
      } else {
        console.error("Failed to load prompts");
      }
    } catch (error) {
      console.error("Error loading prompts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePrompts = async () => {
    setIsSaving(true);
    setSaveStatus("idle");
    
    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(prompts),
      });

      if (response.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch (error) {
      console.error("Error saving prompts:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (confirm("Are you sure you want to reset all prompts to their default values? This action cannot be undone.")) {
      await loadPrompts();
    }
  };

  const updatePrompt = (type: keyof PromptsData, field: keyof Prompt, value: string) => {
    setPrompts(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  const getTabIcon = (type: SettingsTab) => {
    switch (type) {
      case "classification":
        return <Search className="w-4 h-4" />;
      case "extraction":
        return <FileText className="w-4 h-4" />;
      case "chat":
        return <MessageSquare className="w-4 h-4" />;
      case "structure":
        return <Database className="w-4 h-4" />;
    }
  };

  const getTabColor = (type: SettingsTab) => {
    switch (type) {
      case "classification":
        return "text-blue-600 border-blue-600";
      case "extraction":
        return "text-green-600 border-green-600";
      case "chat":
        return "text-purple-600 border-purple-600";
      case "structure":
        return "text-orange-600 border-orange-600";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center space-x-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Chat</span>
              </Link>
              <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
              <div className="flex items-center space-x-2">
                <Settings className="w-6 h-6 text-gray-900 dark:text-gray-100" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={resetToDefaults}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
              <button
                onClick={savePrompts}
                disabled={isSaving}
                className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-colors ${
                  isSaving
                    ? "bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? "Saving..." : "Save Changes"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Status Messages */}
        {saveStatus === "success" && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-green-800 dark:text-green-200">✅ Prompts saved successfully!</p>
          </div>
        )}
        {saveStatus === "error" && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">❌ Failed to save prompts. Please try again.</p>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {[...Object.keys(prompts), "structure"].map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveTab(type as SettingsTab)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === type
                      ? getTabColor(type as SettingsTab)
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  {getTabIcon(type as SettingsTab)}
                  <span className="capitalize">{type}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        {activeTab === "structure" ? (
          <StructureEditor />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  {prompts[activeTab as keyof PromptsData].name}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {prompts[activeTab as keyof PromptsData].description}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt Name
                  </label>
                  <input
                    type="text"
                    value={prompts[activeTab as keyof PromptsData].name}
                    onChange={(e) => updatePrompt(activeTab as keyof PromptsData, "name", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter prompt name..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={prompts[activeTab as keyof PromptsData].description}
                    onChange={(e) => updatePrompt(activeTab as keyof PromptsData, "description", e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter prompt description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Prompt Content
                  </label>
                  <textarea
                    value={prompts[activeTab as keyof PromptsData].content}
                    onChange={(e) => updatePrompt(activeTab as keyof PromptsData, "content", e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    placeholder="Enter prompt content..."
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Character count: {prompts[activeTab as keyof PromptsData].content.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Text */}
        {activeTab !== "structure" && (
          <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
              💡 Prompt Guidelines
            </h3>
            <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
              <p><strong>Classification Prompt:</strong> Used to identify document types from page images. Should specify the expected JSON output format and document type cues.</p>
              <p><strong>Extraction Prompt:</strong> Used to extract structured data from document images. Should emphasize accuracy and the expected JSON schema.</p>
              <p><strong>Chat Prompt:</strong> Used as the system prompt for the chat assistant. Should define the assistant&apos;s role and capabilities.</p>
              <p className="mt-4 text-blue-700 dark:text-blue-300">
                <strong>Note:</strong> Changes are saved immediately to the server and will affect all new requests. Test your changes thoroughly before deploying to production.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
