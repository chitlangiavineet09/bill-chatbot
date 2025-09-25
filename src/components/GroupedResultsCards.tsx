import DocumentHTMLRenderer from "./DocumentHTMLRenderer";

interface GroupedResult {
  doc_type: string;
  page_spans: number[][];
  data: {
    doc_type: string;
    [key: string]: unknown;
  };
}

interface GroupedResultsCardsProps {
  results: GroupedResult[];
}

export default function GroupedResultsCards({ results }: GroupedResultsCardsProps) {
  const getDocTypeIcon = (docType: string) => {
    switch (docType) {
      case 'TaxInvoice':
        return '🧾';
      case 'EWayBill':
        return '📋';
      case 'LorryReceipt':
        return '🚛';
      case 'MaterialReport':
        return '📊';
      case 'PackingList':
        return '📦';
      case 'DeliveryChallan':
        return '🚚';
      case 'PurchaseOrder':
        return '📝';
      case 'CreditNote':
        return '💳';
      case 'DebitNote':
        return '📄';
      case 'PaymentAdvice':
        return '💰';
      case 'ZetwerkInspectionReport':
        return '🔍';
      case 'WeighmentSlip':
        return '⚖️';
      case 'TestCertificate':
        return '📜';
      case 'GatePass':
        return '🚪';
      case 'BillOfLading':
        return '🚢';
      case 'QuotationProforma':
        return '📋';
      default:
        return '📄';
    }
  };

  const getDocTypeColor = (docType: string) => {
    switch (docType) {
      case 'TaxInvoice':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20';
      case 'EWayBill':
        return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
      case 'LorryReceipt':
        return 'border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20';
      case 'MaterialReport':
        return 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20';
      case 'PackingList':
        return 'border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20';
      case 'DeliveryChallan':
        return 'border-cyan-200 bg-cyan-50 dark:border-cyan-800 dark:bg-cyan-900/20';
      case 'PurchaseOrder':
        return 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20';
      case 'CreditNote':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
      case 'DebitNote':
        return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20';
      case 'PaymentAdvice':
        return 'border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-900/20';
      case 'ZetwerkInspectionReport':
        return 'border-pink-200 bg-pink-50 dark:border-pink-800 dark:bg-pink-900/20';
      case 'WeighmentSlip':
        return 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/20';
      case 'TestCertificate':
        return 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20';
      case 'GatePass':
        return 'border-lime-200 bg-lime-50 dark:border-lime-800 dark:bg-lime-900/20';
      case 'BillOfLading':
        return 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20';
      case 'QuotationProforma':
        return 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/20';
      default:
        return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/20';
    }
  };


  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          📋 Grouped Document Results
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Extracted and structured data from your documents
        </p>
      </div>
      
      <div className="grid gap-6">
        {results.map((result, index) => (
          <div
            key={index}
            className={`border-2 rounded-lg p-6 ${getDocTypeColor(result.doc_type)}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{getDocTypeIcon(result.doc_type)}</span>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {result.doc_type}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Pages: {result.page_spans.map(span => 
                      span.length === 1 ? span[0] + 1 : `${span[0] + 1}-${span[span.length - 1] + 1}`
                    ).join(', ')}
                  </p>
                </div>
              </div>
            </div>
            
            <DocumentHTMLRenderer data={result.data} docType={result.doc_type} />
          </div>
        ))}
      </div>
    </div>
  );
}
