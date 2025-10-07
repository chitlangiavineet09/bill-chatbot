import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format extracted data as HTML for proper display
export function formatExtractedDataAsHTML(extractionData: any, docType: string): string {
  if (!extractionData || typeof extractionData !== 'object') {
    return '<p>No data extracted</p>';
  }

  let html = `<div class="extracted-data">`;
  html += `<h3 class="text-lg font-semibold mb-4 text-blue-600">${docType} - Extracted Data</h3>`;
  
  // Helper function to format nested objects
  const formatValue = (value: any, depth = 0): string => {
    if (value === null || value === undefined) return '<span class="text-gray-400">N/A</span>';
    if (typeof value === 'string') return `<span class="text-gray-800">${value}</span>`;
    if (typeof value === 'number') return `<span class="text-gray-800 font-mono">${value}</span>`;
    if (typeof value === 'boolean') return `<span class="text-gray-800">${value ? 'Yes' : 'No'}</span>`;
    if (Array.isArray(value)) {
      if (value.length === 0) return '<span class="text-gray-400">Empty</span>';
      return `<ul class="ml-4 space-y-1">${value.map((item, index) => 
        `<li class="text-sm">${index + 1}. ${formatValue(item, depth + 1)}</li>`
      ).join('')}</ul>`;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) return '<span class="text-gray-400">Empty</span>';
      return `<div class="ml-4 space-y-1">${entries.map(([key, val]) => 
        `<div class="text-sm"><span class="font-medium text-gray-600">${key}:</span> ${formatValue(val, depth + 1)}</div>`
      ).join('')}</div>`;
    }
    return `<span class="text-gray-800">${String(value)}</span>`;
  };

  // Format the main data
  for (const [key, value] of Object.entries(extractionData)) {
    if (value !== null && value !== undefined) {
      html += `<div class="mb-3 p-3 bg-gray-50 rounded-lg">`;
      html += `<h4 class="font-medium text-gray-700 mb-2 capitalize">${key.replace(/_/g, ' ')}</h4>`;
      html += formatValue(value);
      html += `</div>`;
    }
  }
  
  html += `</div>`;
  return html;
}

// Generate thread title from extracted data
export function generateThreadTitle(extractionData: any, docType: string): string {
  if (!extractionData || typeof extractionData !== 'object') {
    return `${docType} - Document`;
  }

  // Document type specific identifier mapping
  const identifierMap: { [key: string]: string[] } = {
    'TaxInvoice': ['invoice_no', 'invoice_number', 'bill_no', 'bill_number'],
    'EWayBill': ['ewb_no', 'ewaybill_no', 'ewb_number'],
    'PurchaseOrder': ['po_no', 'po_number', 'purchase_order_no'],
    'DeliveryChallan': ['dc_no', 'dc_number', 'delivery_challan_no'],
    'QuotationProforma': ['quote_or_pi_no', 'quotation_no', 'proforma_no'],
    'BillOfLading': ['bl_or_awb_no', 'bl_no', 'awb_no'],
    'GatePass': ['gp_no', 'gate_pass_no'],
    'WeighmentSlip': ['slip_no', 'weighment_slip_no'],
    'TestCertificate': ['certificate_no', 'test_cert_no'],
    'ZetwerkInspectionReport': ['report_no', 'inspection_report_no'],
    'MaterialReport': ['report_no', 'material_report_no']
  };

  // Get relevant identifiers for this document type
  const relevantIdentifiers = identifierMap[docType] || [
    'invoice_no', 'document_number', 'receipt_no', 'bill_no', 
    'reference_number', 'id', 'number', 'no'
  ];

  // Try to find document identifiers
  const identifiers = relevantIdentifiers
    .map(field => extractionData[field])
    .filter(Boolean);

  if (identifiers.length > 0) {
    return `${docType} - ${identifiers[0]}`;
  }

  // Try alternative identifier patterns
  const alternativeIdentifiers = [
    extractionData.invoice_no,
    extractionData.document_number,
    extractionData.receipt_no,
    extractionData.bill_no,
    extractionData.reference_number,
    extractionData.id,
    extractionData.number,
    extractionData.no
  ].filter(Boolean);

  if (alternativeIdentifiers.length > 0) {
    return `${docType} - ${alternativeIdentifiers[0]}`;
  }

  // Fallback to date if available
  const dates = [
    extractionData.invoice_date,
    extractionData.date,
    extractionData.created_date,
    extractionData.issue_date,
    extractionData.generated_on,
    extractionData.valid_upto
  ].filter(Boolean);

  if (dates.length > 0) {
    return `${docType} - ${dates[0]}`;
  }

  // Final fallback
  return `${docType} - Document`;
}
