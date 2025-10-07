"use client";
import { useState, useEffect } from "react";
import { 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2, 
  ChevronDown, 
  ChevronRight, 
  Eye, 
  EyeOff,
  AlertCircle,
  CheckCircle,
  FileText,
  Settings
} from "lucide-react";

interface DocumentType {
  type: string;
  displayName: string;
  aliases: string[];
  properties: Record<string, any>;
  required: string[];
}

interface StructureData {
  $schema: string;
  $id: string;
  title: string;
  type: string;
  required: string[];
  properties: Record<string, any>;
  additionalProperties: boolean;
  $defs: Record<string, any>;
}

interface StructureEditorProps {
  onClose?: () => void;
}

export default function StructureEditor({ onClose }: StructureEditorProps) {
  const [structure, setStructure] = useState<StructureData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [activeDocType, setActiveDocType] = useState<string>("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [showRawJson, setShowRawJson] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [editingProperty, setEditingProperty] = useState<{docType: string, propertyName: string} | null>(null);
  const [propertyEditorOpen, setPropertyEditorOpen] = useState(false);

  const documentTypes = [
    "TaxInvoice", "EWayBill", "LorryReceipt", "PackingList", "DeliveryChallan",
    "PurchaseOrder", "CreditNote", "DebitNote", "PaymentAdvice", "ZetwerkInspectionReport",
    "MaterialReport", "WeighmentSlip", "TestCertificate", "GatePass", "BillOfLading",
    "QuotationProforma", "Unknown"
  ];

  useEffect(() => {
    loadStructure();
  }, []);

  const loadStructure = async () => {
    try {
      const response = await fetch("/api/structure");
      if (response.ok) {
        const data = await response.json();
        setStructure(data);
        setActiveDocType(documentTypes[0]);
        setExpandedSections(new Set([documentTypes[0]]));
      } else {
        console.error("Failed to load structure");
      }
    } catch (error) {
      console.error("Error loading structure:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveStructure = async () => {
    if (!structure) return;
    
    setIsSaving(true);
    setSaveStatus("idle");
    setValidationErrors([]);
    
    try {
      // Validate JSON structure
      const validationErrors = validateStructure(structure);
      if (validationErrors.length > 0) {
        setValidationErrors(validationErrors);
        setSaveStatus("error");
        return;
      }

      const response = await fetch("/api/structure", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(structure),
      });

      if (response.ok) {
        setSaveStatus("success");
        setTimeout(() => setSaveStatus("idle"), 3000);
      } else {
        setSaveStatus("error");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch (error) {
      console.error("Error saving structure:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  const validateStructure = (data: StructureData): string[] => {
    const errors: string[] = [];
    
    if (!data.$defs) {
      errors.push("Missing $defs section");
    }
    
    if (!data.properties) {
      errors.push("Missing properties section");
    }
    
    // Check if all document types have definitions
    documentTypes.forEach(docType => {
      if (!data.$defs?.[docType]) {
        errors.push(`Missing definition for ${docType}`);
      }
    });
    
    return errors;
  };

  const resetToDefaults = async () => {
    if (confirm("Are you sure you want to reset the structure to its default values? This action cannot be undone.")) {
      await loadStructure();
    }
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const updateDocumentType = (docType: string, field: string, value: any) => {
    if (!structure) return;
    
    setStructure(prev => {
      if (!prev) return prev;
      
      const newStructure = { ...prev };
      if (!newStructure.$defs[docType]) {
        newStructure.$defs[docType] = {
          type: "object",
          "x-displayName": docType,
          "x-aliases": [],
          properties: {},
          required: []
        };
      }
      
      if (field === "x-displayName") {
        newStructure.$defs[docType]["x-displayName"] = value;
      } else if (field === "x-aliases") {
        newStructure.$defs[docType]["x-aliases"] = value;
      } else if (field === "required") {
        newStructure.$defs[docType].required = value;
      } else if (field === "properties") {
        newStructure.$defs[docType].properties = value;
      }
      
      return newStructure;
    });
    
    // Auto-save the changes to the file
    saveStructure();
  };

  const addProperty = (docType: string) => {
    if (!structure) return;
    
    const propertyName = prompt("Enter property name:");
    if (!propertyName) return;
    
    const propertyType = prompt("Enter property type (string, number, boolean, object, array):", "string");
    if (!propertyType) return;
    
    const newProperty = {
      type: propertyType,
      ...(propertyType === "array" && { items: { type: "string" } }),
      ...(propertyType === "object" && { properties: {} })
    };
    
    updateDocumentType(docType, "properties", {
      ...structure.$defs[docType]?.properties,
      [propertyName]: newProperty
    });
    
    // Open the property editor for the new property
    setTimeout(() => {
      openPropertyEditor(docType, propertyName);
    }, 100);
  };

  const removeProperty = (docType: string, propertyName: string) => {
    if (!structure) return;
    
    const newProperties = { ...structure.$defs[docType]?.properties };
    delete newProperties[propertyName];
    
    updateDocumentType(docType, "properties", newProperties);
  };

  const openPropertyEditor = (docType: string, propertyName: string) => {
    setEditingProperty({ docType, propertyName });
    setPropertyEditorOpen(true);
  };

  const closePropertyEditor = () => {
    setEditingProperty(null);
    setPropertyEditorOpen(false);
  };

  const updateProperty = (docType: string, propertyName: string, updates: any) => {
    if (!structure) return;
    
    const currentProperty = structure.$defs[docType]?.properties?.[propertyName] || {};
    const updatedProperty = { ...currentProperty, ...updates };
    
    updateDocumentType(docType, "properties", {
      ...structure.$defs[docType]?.properties,
      [propertyName]: updatedProperty
    });
    
    // Auto-save the changes to the file
    saveStructure();
  };

  const getPropertyTypeIcon = (type: string, property: any) => {
    if (property?.$ref) {
      return '🔗';
    }
    if (property?.type === 'array' && property?.items?.$ref) {
      return '📋';
    }
    switch (type) {
      case 'string': return '📝';
      case 'number': return '🔢';
      case 'boolean': return '✅';
      case 'object': return '📦';
      case 'array': return '📋';
      default: return '❓';
    }
  };

  const getDocTypeIcon = (docType: string) => {
    switch (docType) {
      case 'TaxInvoice': return '🧾';
      case 'EWayBill': return '📋';
      case 'LorryReceipt': return '🚛';
      case 'PackingList': return '📦';
      case 'DeliveryChallan': return '🚚';
      case 'PurchaseOrder': return '📝';
      case 'CreditNote': return '💳';
      case 'DebitNote': return '📄';
      case 'PaymentAdvice': return '💰';
      case 'ZetwerkInspectionReport': return '🔍';
      case 'MaterialReport': return '📊';
      case 'WeighmentSlip': return '⚖️';
      case 'TestCertificate': return '📜';
      case 'GatePass': return '🚪';
      case 'BillOfLading': return '🚢';
      case 'QuotationProforma': return '📋';
      default: return '📄';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading structure editor...</p>
        </div>
      </div>
    );
  }

  if (!structure) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Failed to load structure data</p>
        </div>
      </div>
    );
  }

  // Property Editor Modal Component
  const PropertyEditorModal = () => {
    if (!editingProperty || !structure || !propertyEditorOpen) return null;
    
    const { docType, propertyName } = editingProperty;
    const property = structure.$defs[docType]?.properties?.[propertyName] || {};
    
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closePropertyEditor();
          }
        }}
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getPropertyTypeIcon(property.type || 'string', property)}</span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Edit Property: {propertyName}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Configure the {propertyName} property for {docType}
                  </p>
                </div>
              </div>
              <button
                onClick={closePropertyEditor}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              {/* Basic Property Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Property Type
                  </label>
                  <select
                    value={property.type || 'string'}
                    onChange={(e) => updateProperty(docType, propertyName, { type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="object">Object</option>
                    <option value="array">Array</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={property.description || ''}
                    onChange={(e) => updateProperty(docType, propertyName, { description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Property description..."
                  />
                </div>
              </div>

              {/* String-specific properties */}
              {property.type === 'string' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">String Constraints</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Min Length
                      </label>
                      <input
                        type="number"
                        value={property.minLength || ''}
                        onChange={(e) => updateProperty(docType, propertyName, { minLength: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Max Length
                      </label>
                      <input
                        type="number"
                        value={property.maxLength || ''}
                        onChange={(e) => updateProperty(docType, propertyName, { maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pattern (Regex)
                      </label>
                      <input
                        type="text"
                        value={property.pattern || ''}
                        onChange={(e) => updateProperty(docType, propertyName, { pattern: e.target.value || undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="^[A-Za-z0-9]+$"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Enum Values (one per line)
                    </label>
                    <textarea
                      value={property.enum ? property.enum.join('\n') : ''}
                      onChange={(e) => updateProperty(docType, propertyName, { 
                        enum: e.target.value ? e.target.value.split('\n').filter(v => v.trim()) : undefined 
                      })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Option1&#10;Option2&#10;Option3"
                    />
                  </div>
                </div>
              )}

              {/* Number-specific properties */}
              {property.type === 'number' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Number Constraints</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Minimum
                      </label>
                      <input
                        type="number"
                        value={property.minimum || ''}
                        onChange={(e) => updateProperty(docType, propertyName, { minimum: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Maximum
                      </label>
                      <input
                        type="number"
                        value={property.maximum || ''}
                        onChange={(e) => updateProperty(docType, propertyName, { maximum: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Multiple Of
                      </label>
                      <input
                        type="number"
                        value={property.multipleOf || ''}
                        onChange={(e) => updateProperty(docType, propertyName, { multipleOf: e.target.value ? parseFloat(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0.01"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Array-specific properties */}
              {property.type === 'array' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Array Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Min Items
                      </label>
                      <input
                        type="number"
                        value={property.minItems || ''}
                        onChange={(e) => updateProperty(docType, propertyName, { minItems: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Max Items
                      </label>
                      <input
                        type="number"
                        value={property.maxItems || ''}
                        onChange={(e) => updateProperty(docType, propertyName, { maxItems: e.target.value ? parseInt(e.target.value) : undefined })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Unique Items
                      </label>
                      <select
                        value={property.uniqueItems ? 'true' : 'false'}
                        onChange={(e) => updateProperty(docType, propertyName, { uniqueItems: e.target.value === 'true' })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="false">No</option>
                        <option value="true">Yes</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Item Type
                    </label>
                    <select
                      value={property.items?.type || 'string'}
                      onChange={(e) => updateProperty(docType, propertyName, { 
                        items: { type: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="string">String</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="object">Object</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Object-specific properties */}
              {property.type === 'object' && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Object Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Additional Properties
                      </label>
                      <select
                        value={property.additionalProperties === false ? 'false' : 'true'}
                        onChange={(e) => updateProperty(docType, propertyName, { 
                          additionalProperties: e.target.value === 'true' 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="true">Allow</option>
                        <option value="false">Disallow</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Required Properties
                      </label>
                      <input
                        type="text"
                        value={property.required ? property.required.join(', ') : ''}
                        onChange={(e) => updateProperty(docType, propertyName, { 
                          required: e.target.value ? e.target.value.split(',').map(s => s.trim()).filter(s => s) : undefined 
                        })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="prop1, prop2, prop3"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Common properties */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Common Properties</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Default Value
                    </label>
                    <input
                      type="text"
                      value={property.default || ''}
                      onChange={(e) => updateProperty(docType, propertyName, { default: e.target.value || undefined })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Default value..."
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={(structure.$defs[docType]?.required || []).includes(propertyName)}
                        onChange={(e) => {
                          const currentRequired = structure.$defs[docType]?.required || [];
                          if (e.target.checked) {
                            if (!currentRequired.includes(propertyName)) {
                              updateDocumentType(docType, "required", [...currentRequired, propertyName]);
                            }
                          } else {
                            updateDocumentType(docType, "required", currentRequired.filter((r: string) => r !== propertyName));
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Required Field</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={closePropertyEditor}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Save changes and close
                  closePropertyEditor();
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Settings className="w-6 h-6 text-gray-900 dark:text-gray-100" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Document Structure Editor</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                {showRawJson ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showRawJson ? "Hide" : "Show"} Raw JSON</span>
              </button>
              <button
                onClick={resetToDefaults}
                className="flex items-center space-x-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset</span>
              </button>
              <button
                onClick={saveStructure}
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

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Status Messages */}
        {saveStatus === "success" && (
          <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800 dark:text-green-200">✅ Structure saved successfully!</p>
          </div>
        )}
        {saveStatus === "error" && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800 dark:text-red-200">❌ Failed to save structure. Please try again.</p>
          </div>
        )}

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">Validation Errors:</h3>
            <ul className="list-disc list-inside text-red-700 dark:text-red-300">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {showRawJson ? (
          /* Raw JSON Editor */
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Raw JSON Editor</h2>
              <textarea
                value={JSON.stringify(structure, null, 2)}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    setStructure(parsed);
                  } catch (error) {
                    // Invalid JSON, don't update
                  }
                }}
                rows={30}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
            </div>
          </div>
        ) : (
          /* Document Type Editor */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Document Types Sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Document Types</h3>
                </div>
                <div className="p-2">
                  {documentTypes.map((docType) => (
                    <button
                      key={docType}
                      onClick={() => setActiveDocType(docType)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                        activeDocType === docType
                          ? "bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <span className="text-lg">{getDocTypeIcon(docType)}</span>
                      <span className="font-medium">{docType}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Document Type Editor */}
            <div className="lg:col-span-3">
              {activeDocType && structure.$defs[activeDocType] && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{getDocTypeIcon(activeDocType)}</span>
                        <div>
                          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {structure.$defs[activeDocType]["x-displayName"] || activeDocType}
                          </h2>
                          <p className="text-gray-600 dark:text-gray-400">
                            Edit the structure for {activeDocType} documents
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => addProperty(activeDocType)}
                        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Property</span>
                      </button>
                    </div>

                    <div className="space-y-6">
                      {/* Basic Info */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Basic Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Display Name
                            </label>
                            <input
                              type="text"
                              value={structure.$defs[activeDocType]["x-displayName"] || ""}
                              onChange={(e) => updateDocumentType(activeDocType, "x-displayName", e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Aliases (comma-separated)
                            </label>
                            <input
                              type="text"
                              value={structure.$defs[activeDocType]["x-aliases"]?.join(", ") || ""}
                              onChange={(e) => updateDocumentType(activeDocType, "x-aliases", e.target.value.split(",").map(s => s.trim()).filter(s => s))}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Properties */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Properties</h3>
                        <div className="space-y-2">
                          {Object.entries(structure.$defs[activeDocType].properties || {}).map(([propName, propDef]: [string, any]) => (
                            <div key={propName} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-lg">{getPropertyTypeIcon(propDef.type || 'string', propDef)}</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{propName}</span>
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    ({propDef.type || 'string'}
                                    {propDef.$ref && ` → ${propDef.$ref.split('/').pop()}`}
                                    {propDef.type === 'array' && propDef.items?.$ref && ` → ${propDef.items.$ref.split('/').pop()}[]`}
                                    )
                                  </span>
                                  {(structure.$defs[activeDocType].required || []).includes(propName) && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded">
                                      Required
                                    </span>
                                  )}
                                </div>
                                {propDef.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{propDef.description}</p>
                                )}
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {propDef.enum && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded">
                                      Enum: {propDef.enum.length} options
                                    </span>
                                  )}
                                  {propDef.minLength && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded">
                                      Min: {propDef.minLength}
                                    </span>
                                  )}
                                  {propDef.maxLength && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded">
                                      Max: {propDef.maxLength}
                                    </span>
                                  )}
                                  {propDef.minimum && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 rounded">
                                      Min: {propDef.minimum}
                                    </span>
                                  )}
                                  {propDef.maximum && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 rounded">
                                      Max: {propDef.maximum}
                                    </span>
                                  )}
                                  {propDef.minItems && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded">
                                      Min Items: {propDef.minItems}
                                    </span>
                                  )}
                                  {propDef.maxItems && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 rounded">
                                      Max Items: {propDef.maxItems}
                                    </span>
                                  )}
                                  {propDef.uniqueItems && (
                                    <span className="inline-flex px-2 py-1 text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded">
                                      Unique
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => openPropertyEditor(activeDocType, propName)}
                                  className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                                  title="Edit property"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeProperty(activeDocType, propName)}
                                  className="p-1 text-red-600 hover:text-red-800 transition-colors"
                                  title="Remove property"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {Object.keys(structure.$defs[activeDocType].properties || {}).length === 0 && (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                              No properties defined. Click "Add Property" to get started.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* LineItem Details for TaxInvoice */}
                      {activeDocType === 'TaxInvoice' && structure.$defs.LineItem && (
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Line Item Structure</h3>
                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <span className="text-lg">📋</span>
                              <span className="font-medium text-blue-900 dark:text-blue-100">
                                items → LineItem[]
                              </span>
                            </div>
                            <p className="text-sm text-blue-800 dark:text-blue-200 mb-4">
                              Each item in the items array follows the LineItem structure:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {Object.entries(structure.$defs.LineItem.properties || {}).map(([subPropName, subPropDef]: [string, any]) => (
                                <div key={subPropName} className="flex items-center space-x-2 p-2 bg-white dark:bg-gray-800 rounded border">
                                  <span className="text-sm">{getPropertyTypeIcon(subPropDef.type || 'string', subPropDef)}</span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{subPropName}</span>
                                  <span className="text-xs text-gray-500">
                                    ({subPropDef.type || 'string'})
                                  </span>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 text-xs text-blue-700 dark:text-blue-300">
                              <strong>Note:</strong> This shows the structure of individual items in the items array. 
                              Each item will have these properties when the document is processed.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Referenced Definitions */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Referenced Definitions</h3>
                        <div className="space-y-4">
                          {Object.entries(structure.$defs[activeDocType].properties || {})
                            .filter(([_, propDef]: [string, any]) => propDef.$ref || (propDef.type === 'array' && propDef.items?.$ref))
                            .map(([propName, propDef]: [string, any]) => {
                              const refName = propDef.$ref ? propDef.$ref.split('/').pop() : propDef.items?.$ref?.split('/').pop();
                              const refDef = refName ? structure.$defs[refName] : null;
                              
                              if (!refDef) return null;
                              
                              return (
                                <div key={propName} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                  <div className="flex items-center space-x-2 mb-3">
                                    <span className="text-lg">🔗</span>
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                      {propName} → {refName}
                                    </span>
                                    {propDef.type === 'array' && (
                                      <span className="text-sm text-gray-500 dark:text-gray-400">(Array)</span>
                                    )}
                                  </div>
                                  
                                  {refDef.properties && (
                                    <div className="ml-6">
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        Properties in {refName}:
                                      </p>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {Object.entries(refDef.properties).map(([subPropName, subPropDef]: [string, any]) => (
                                          <div key={subPropName} className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                                            <span>{getPropertyTypeIcon(subPropDef.type || 'string', subPropDef)}</span>
                                            <span className="font-medium">{subPropName}</span>
                                            <span className="text-gray-500">
                                              ({subPropDef.type || 'string'}
                                              {subPropDef.$ref && ` → ${subPropDef.$ref.split('/').pop()}`}
                                              )
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          
                          {Object.entries(structure.$defs[activeDocType].properties || {})
                            .filter(([_, propDef]: [string, any]) => propDef.$ref || (propDef.type === 'array' && propDef.items?.$ref))
                            .length === 0 && (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                              No referenced definitions found.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Required Fields */}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Required Fields</h3>
                        <div className="space-y-2">
                          {(structure.$defs[activeDocType].required || []).map((field: string) => (
                            <div key={field} className="flex items-center space-x-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-800 dark:text-green-200">{field}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            💡 Structure Editor Guidelines
          </h3>
          <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
            <p><strong>Document Types:</strong> Each document type defines the structure for extracting data from specific document formats.</p>
            <p><strong>Properties:</strong> Define the fields that can be extracted from each document type. Use appropriate data types (string, number, boolean, object, array).</p>
            <p><strong>Required Fields:</strong> Specify which fields are mandatory for each document type.</p>
            <p><strong>Aliases:</strong> Add alternative names that can be used to identify the document type.</p>
            <p className="mt-4 text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> Changes to the structure will affect how documents are processed and validated. Test thoroughly before deploying to production.
            </p>
          </div>
        </div>
      </div>

      {/* Property Editor Modal */}
      <PropertyEditorModal />
    </div>
  );
}
