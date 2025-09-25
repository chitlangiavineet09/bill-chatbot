interface PageResult {
  page_index: number;
  doc_type: string;
  confidence: number;
  brief_summary: string | null;
  key_hints: string[] | null;
}

interface PageResultsTableProps {
  results: PageResult[];
}

export default function PageResultsTable({ results }: PageResultsTableProps) {
  const getDocTypeColor = (docType: string) => {
    switch (docType) {
      case 'TaxInvoice':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'EWayBill':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'LorryReceipt':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'MaterialReport':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'PackingList':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'DeliveryChallan':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
      case 'PurchaseOrder':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'CreditNote':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'DebitNote':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'PaymentAdvice':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'ZetwerkInspectionReport':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'WeighmentSlip':
        return 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200';
      case 'TestCertificate':
        return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200';
      case 'GatePass':
        return 'bg-lime-100 text-lime-800 dark:bg-lime-900 dark:text-lime-200';
      case 'BillOfLading':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200';
      case 'QuotationProforma':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.8) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          📄 Page-by-Page Analysis
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Document type classification for each page
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Page
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Document Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Confidence
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Summary
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Key Elements
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result, index) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-full text-sm font-medium">
                      {result.page_index + 1}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDocTypeColor(result.doc_type)}`}>
                    {result.doc_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm font-medium ${getConfidenceColor(result.confidence)}`}>
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 dark:text-gray-100 max-w-xs">
                    {result.brief_summary || 'No summary available'}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {result.key_hints && result.key_hints.length > 0 ? (
                      <>
                        {result.key_hints.slice(0, 3).map((hint, hintIndex) => (
                          <span
                            key={hintIndex}
                            className="inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded"
                          >
                            {hint}
                          </span>
                        ))}
                        {result.key_hints.length > 3 && (
                          <span className="inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded">
                            +{result.key_hints.length - 3} more
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 rounded">
                        No key elements
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
