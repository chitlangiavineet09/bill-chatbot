interface DocumentData {
  doc_type: string;
  invoice_no?: string;
  invoice_date?: string;
  irn?: string;
  seller?: Party;
  buyer?: Party;
  ship_to?: Party;
  items?: LineItem[];
  totals?: Totals;
  bank?: Bank;
  ewb_no?: string;
  generated_on?: string;
  valid_upto?: string;
  from?: Party;
  to?: Party;
  vehicle?: Vehicle;
  transporter?: {
    name?: string;
    gstin?: string;
    transporter_id?: string;
    pan?: string;
  };
  lr_no?: string;
  date?: string;
  docket_no?: string;
  consignor?: Party;
  origin?: string;
  destination?: string;
  ewaybill_no?: string;
  packages?: number;
  weight_kg?: number;
  freight?: {
    basic?: number;
    hamali?: number;
    oda?: number;
    other_charges?: number;
    total?: number;
    to_pay_or_paid?: string;
  };
  material_report_type?: string;
  doc_no?: string;
  doc_date?: string;
  supplier?: Party;
  packing_list_no?: string;
  po_no?: string;
  dc_no?: string;
  dc_date?: string;
  reason?: string;
  sender?: Party;
  receiver?: Party;
  po_date?: string;
  delivery_terms?: string;
  note_no?: string;
  note_date?: string;
  reference_invoice_no?: string;
  advice_no?: string;
  advice_date?: string;
  payer?: Party;
  payee?: Party;
  utr?: string;
  amount?: number | { value: number; currency?: string };
  tds_amount?: number;
  bank_name?: string;
  ifsc?: string;
  account_no?: string;
  invoice_refs?: InvoiceRef[];
  // ZetwerkInspectionReport fields
  report_no?: string;
  report_date?: string;
  item_code?: string;
  lot_batch?: string;
  quantity_inspected?: number;
  sampling_plan?: string;
  measurements?: Array<{
    characteristic?: string;
    spec?: string;
    measured?: string;
    result?: string;
  }>;
  visual_checks?: string;
  final_disposition?: string;
  inspector?: string;
  remarks?: string;
  // WeighmentSlip fields
  slip_no?: string;
  date_time?: string;
  material?: string;
  gross_kg?: number;
  tare_kg?: number;
  net_kg?: number;
  weighbridge_id?: string;
  // TestCertificate fields
  certificate_no?: string;
  certificate_type?: string;
  grade?: string;
  specification?: string;
  heat_no?: string;
  batch_no?: string;
  chemical_composition?: Record<string, number>;
  mechanical_properties?: {
    uts?: number;
    yield_strength?: number;
    elongation_percent?: number;
    hardness_hb?: number;
  };
  result?: string;
  // GatePass fields
  gp_no?: string;
  gp_date?: string;
  movement?: string;
  returnable?: boolean;
  purpose?: string;
  party?: Party;
  // BillOfLading fields
  bl_or_awb_no?: string;
  mode?: string;
  shipper?: Party;
  consignee?: Party;
  notify_party?: Party;
  pol?: string;
  pod?: string;
  vessel_or_flight?: string;
  voyage_or_flight_no?: string;
  container_nos?: string[];
  gross_weight_kg?: number;
  incoterm?: string;
  issue_date?: string;
  // QuotationProforma fields
  quote_or_pi_no?: string;
  valid_till?: string;
  taxes_included?: boolean;
  notes?: string;
  raw_text?: string;
  top_candidates?: Array<{
    doc_type: string;
    confidence: number;
  }>;
  [key: string]: unknown;
}

interface DocumentHTMLRendererProps {
  data: DocumentData;
  docType?: string;
}

interface Party {
  name?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  state?: string;
  state_code?: string;
  contact?: string;
  email?: string;
}

interface LineItem {
  sl_no?: string;
  description?: string;
  item_code?: string;
  hsn_sac?: string;
  uom?: string;
  qty?: number | string;
  rate?: number;
  unit_rate?: number;
  taxable_value?: number;
  total?: number;
  total_price?: number;
  cgst_rate?: number;
  cgst_amount?: number;
  sgst_rate?: number;
  sgst_amount?: number;
  igst_rate?: number;
  igst_amount?: number;
  batch_lot?: string;
  serial_no?: string;
  accepted_qty?: number;
  rejected_qty?: number;
  box_no?: string;
  net_weight_kg?: number;
  gross_weight_kg?: number;
  dimensions_mm?: string;
  marks_nos?: string;
}

interface Vehicle {
  vehicle_no?: string;
  driver_name?: string;
  driver_phone?: string;
}

interface Totals {
  subtotal?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  round_off?: number;
  freight?: number;
  other_charges?: number;
  grand_total?: number;
  grand_total_in_words?: string;
  taxable_value?: number;
  tax_amount?: number;
  note_total?: number;
}

interface Bank {
  account_name?: string;
  account_no?: string;
  ifsc?: string;
  bank_name?: string;
  branch?: string;
}

interface InvoiceRef {
  invoice_no?: string;
  invoice_date?: string;
  amount?: number;
}

export default function DocumentHTMLRenderer({ data, docType }: DocumentHTMLRendererProps) {
  // Safety check for undefined data
  if (!data) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">
          ⚠️ Data Error
        </h2>
        <p className="text-red-700 dark:text-red-300">
          No data available for rendering. This might be due to a processing error.
        </p>
      </div>
    );
  }
  const formatCurrency = (amount: number | string | null | undefined) => {
    if (!amount) return 'N/A';
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN');
    } catch {
      return dateStr;
    }
  };

  const renderParty = (party: Party | undefined, title: string) => {
    if (!party) return null;
    
    return (
      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {party.name && <div><strong>Name:</strong> {party.name}</div>}
          {party.gstin && <div><strong>GSTIN:</strong> {party.gstin}</div>}
          {party.pan && <div><strong>PAN:</strong> {party.pan}</div>}
          {party.address && <div><strong>Address:</strong> {party.address}</div>}
          {party.state && <div><strong>State:</strong> {party.state}</div>}
          {party.state_code && <div><strong>State Code:</strong> {party.state_code}</div>}
          {party.email && <div><strong>Email:</strong> {party.email}</div>}
          {party.contact && <div><strong>Contact:</strong> {party.contact}</div>}
        </div>
      </div>
    );
  };

  const renderLineItems = (items: LineItem[]) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">S.No</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Description</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">HSN/SAC</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Qty</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Rate</th>
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: LineItem, index: number) => (
              <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.sl_no || index + 1}</td>
                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.description || 'N/A'}</td>
                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.hsn_sac || 'N/A'}</td>
                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                  {item.qty || 'N/A'} {item.uom || ''}
                </td>
                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                  {formatCurrency(item.rate || item.unit_rate)}
                </td>
                <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right font-medium">
                  {formatCurrency(item.total || item.total_price || item.taxable_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTaxInvoice = (data: DocumentData) => (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold text-blue-900 dark:text-blue-100">Tax Invoice</h2>
            <p className="text-blue-700 dark:text-blue-300">
              Invoice No: <strong>{data.invoice_no || 'N/A'}</strong>
            </p>
            <p className="text-blue-700 dark:text-blue-300">
              Date: <strong>{formatDate(data.invoice_date)}</strong>
            </p>
            {data.irn && (
              <p className="text-blue-700 dark:text-blue-300">
                IRN: <strong>{data.irn}</strong>
              </p>
            )}
          </div>
          {data.totals?.grand_total && (
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {formatCurrency(data.totals.grand_total)}
              </p>
              <p className="text-blue-700 dark:text-blue-300">Total Amount</p>
            </div>
          )}
        </div>
      </div>

      {/* Parties */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.seller, "Seller")}
        {renderParty(data.buyer, "Buyer")}
        {data.ship_to && renderParty(data.ship_to, "Ship To")}
      </div>

      {/* Items */}
      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Items</h3>
          {renderLineItems(data.items)}
        </div>
      )}

      {/* Totals */}
      {data.totals && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Totals</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {data.totals.subtotal && (
              <div><strong>Subtotal:</strong> {formatCurrency(data.totals.subtotal)}</div>
            )}
            {data.totals.cgst && (
              <div><strong>CGST:</strong> {formatCurrency(data.totals.cgst)}</div>
            )}
            {data.totals.sgst && (
              <div><strong>SGST:</strong> {formatCurrency(data.totals.sgst)}</div>
            )}
            {data.totals.igst && (
              <div><strong>IGST:</strong> {formatCurrency(data.totals.igst)}</div>
            )}
            {data.totals.grand_total && (
              <div className="col-span-2 md:col-span-4 pt-2 border-t border-gray-300 dark:border-gray-600">
                <strong>Grand Total:</strong> {formatCurrency(data.totals.grand_total)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bank Details */}
      {data.bank && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {data.bank.account_name && <div><strong>Account Name:</strong> {data.bank.account_name}</div>}
            {data.bank.account_no && <div><strong>Account No:</strong> {data.bank.account_no}</div>}
            {data.bank.ifsc && <div><strong>IFSC:</strong> {data.bank.ifsc}</div>}
            {data.bank.bank_name && <div><strong>Bank:</strong> {data.bank.bank_name}</div>}
            {data.bank.branch && <div><strong>Branch:</strong> {data.bank.branch}</div>}
          </div>
        </div>
      )}
    </div>
  );

  const renderEWayBill = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-green-900 dark:text-green-100 mb-4">E-Way Bill</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-green-700 dark:text-green-300">
              <strong>E-Way Bill No:</strong> {data.ewb_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-green-700 dark:text-green-300">
              <strong>Generated:</strong> {formatDate(data.generated_on)}
            </p>
          </div>
          <div>
            <p className="text-green-700 dark:text-green-300">
              <strong>Valid Until:</strong> {formatDate(data.valid_upto)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.from, "From")}
        {renderParty(data.to, "To")}
      </div>

      {data.vehicle && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vehicle Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><strong>Vehicle No:</strong> {data.vehicle.vehicle_no || 'N/A'}</div>
            <div><strong>Driver:</strong> {data.vehicle.driver_name || 'N/A'}</div>
            <div><strong>Phone:</strong> {data.vehicle.driver_phone || 'N/A'}</div>
          </div>
        </div>
      )}

      {data.transporter && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Transporter</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><strong>Name:</strong> {data.transporter.name || 'N/A'}</div>
            <div><strong>GSTIN:</strong> {data.transporter.gstin || 'N/A'}</div>
            <div><strong>ID:</strong> {data.transporter.transporter_id || 'N/A'}</div>
          </div>
        </div>
      )}
    </div>
  );

  const renderLorryReceipt = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-4">Lorry Receipt</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-purple-700 dark:text-purple-300">
              <strong>LR No:</strong> {data.lr_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-purple-700 dark:text-purple-300">
              <strong>Date:</strong> {formatDate(data.date)}
            </p>
          </div>
          <div>
            <p className="text-purple-700 dark:text-purple-300">
              <strong>Docket No:</strong> {data.docket_no || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.consignor, "Consignor")}
        {renderParty(data.consignee, "Consignee")}
      </div>

      {data.vehicle && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Transport Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><strong>Vehicle No:</strong> {data.vehicle.vehicle_no || 'N/A'}</div>
            <div><strong>Driver:</strong> {data.vehicle.driver_name || 'N/A'}</div>
            <div><strong>From:</strong> {data.origin || 'N/A'}</div>
            <div><strong>To:</strong> {data.destination || 'N/A'}</div>
            <div><strong>E-Way Bill:</strong> {data.ewaybill_no || 'N/A'}</div>
            <div><strong>Packages:</strong> {data.packages || 'N/A'}</div>
          </div>
        </div>
      )}

      {data.freight && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Freight Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {data.freight.basic && <div><strong>Basic:</strong> {formatCurrency(data.freight.basic)}</div>}
            {data.freight.hamali && <div><strong>Hamali:</strong> {formatCurrency(data.freight.hamali)}</div>}
            {data.freight.oda && <div><strong>ODA:</strong> {formatCurrency(data.freight.oda)}</div>}
            {data.freight.total && <div><strong>Total:</strong> {formatCurrency(data.freight.total)}</div>}
          </div>
        </div>
      )}
    </div>
  );

  const renderMaterialReport = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-4">Material Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-orange-700 dark:text-orange-300">
              <strong>Type:</strong> {data.material_report_type || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-orange-700 dark:text-orange-300">
              <strong>Doc No:</strong> {data.doc_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-orange-700 dark:text-orange-300">
              <strong>Date:</strong> {formatDate(data.doc_date)}
            </p>
          </div>
        </div>
      </div>

      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Item Code</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Description</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Qty</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Accepted</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: LineItem, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.item_code || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.description || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                      {item.qty || 'N/A'} {item.uom || ''}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                      {item.accepted_qty || 'N/A'}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                      {item.rejected_qty || 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderPackingList = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mb-4">Packing List</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-indigo-700 dark:text-indigo-300">
              <strong>Packing List No:</strong> {data.packing_list_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-indigo-700 dark:text-indigo-300">
              <strong>Date:</strong> {formatDate(data.date)}
            </p>
          </div>
          <div>
            <p className="text-indigo-700 dark:text-indigo-300">
              <strong>PO No:</strong> {data.po_no || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.supplier, "Supplier")}
        {renderParty(data.buyer, "Buyer")}
      </div>

      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Packing Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Box No</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Item Code</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Description</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Qty</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Net Weight</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Gross Weight</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: LineItem, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.box_no || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.item_code || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.description || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                      {item.qty || 'N/A'} {item.uom || ''}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                      {item.net_weight_kg || 'N/A'} kg
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">
                      {item.gross_weight_kg || 'N/A'} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderDeliveryChallan = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-cyan-900 dark:text-cyan-100 mb-4">Delivery Challan</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-cyan-700 dark:text-cyan-300">
              <strong>DC No:</strong> {data.dc_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-cyan-700 dark:text-cyan-300">
              <strong>Date:</strong> {formatDate(data.dc_date)}
            </p>
          </div>
          <div>
            <p className="text-cyan-700 dark:text-cyan-300">
              <strong>Reason:</strong> {data.reason || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.sender, "Sender")}
        {renderParty(data.receiver, "Receiver")}
      </div>

      {data.vehicle && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vehicle Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><strong>Vehicle No:</strong> {data.vehicle.vehicle_no || 'N/A'}</div>
            <div><strong>Driver:</strong> {data.vehicle.driver_name || 'N/A'}</div>
            <div><strong>Phone:</strong> {data.vehicle.driver_phone || 'N/A'}</div>
          </div>
        </div>
      )}

      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Items</h3>
          {renderLineItems(data.items)}
        </div>
      )}
    </div>
  );

  const renderPurchaseOrder = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mb-4">Purchase Order</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-emerald-700 dark:text-emerald-300">
              <strong>PO No:</strong> {data.po_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-emerald-700 dark:text-emerald-300">
              <strong>Date:</strong> {formatDate(data.po_date)}
            </p>
          </div>
          <div>
            <p className="text-emerald-700 dark:text-emerald-300">
              <strong>Delivery Terms:</strong> {data.delivery_terms || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.buyer, "Buyer")}
        {renderParty(data.supplier, "Supplier")}
      </div>

      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Order Items</h3>
          {renderLineItems(data.items)}
        </div>
      )}
    </div>
  );

  const renderCreditNote = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-4">Credit Note</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-red-700 dark:text-red-300">
              <strong>Note No:</strong> {data.note_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-red-700 dark:text-red-300">
              <strong>Date:</strong> {formatDate(data.note_date)}
            </p>
          </div>
          <div>
            <p className="text-red-700 dark:text-red-300">
              <strong>Reference Invoice:</strong> {data.reference_invoice_no || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.seller, "Seller")}
        {renderParty(data.buyer, "Buyer")}
      </div>

      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Credit Items</h3>
          {renderLineItems(data.items)}
        </div>
      )}

      {data.totals && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Credit Totals</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {data.totals.taxable_value && (
              <div><strong>Taxable Value:</strong> {formatCurrency(data.totals.taxable_value)}</div>
            )}
            {data.totals.tax_amount && (
              <div><strong>Tax Amount:</strong> {formatCurrency(data.totals.tax_amount)}</div>
            )}
            {data.totals.note_total && (
              <div><strong>Note Total:</strong> {formatCurrency(data.totals.note_total)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderDebitNote = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-4">Debit Note</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-amber-700 dark:text-amber-300">
              <strong>Note No:</strong> {data.note_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-amber-700 dark:text-amber-300">
              <strong>Date:</strong> {formatDate(data.note_date)}
            </p>
          </div>
          <div>
            <p className="text-amber-700 dark:text-amber-300">
              <strong>Reference Invoice:</strong> {data.reference_invoice_no || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.buyer, "Buyer")}
        {renderParty(data.seller, "Seller")}
      </div>

      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Debit Items</h3>
          {renderLineItems(data.items)}
        </div>
      )}

      {data.totals && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Debit Totals</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {data.totals.taxable_value && (
              <div><strong>Taxable Value:</strong> {formatCurrency(data.totals.taxable_value)}</div>
            )}
            {data.totals.tax_amount && (
              <div><strong>Tax Amount:</strong> {formatCurrency(data.totals.tax_amount)}</div>
            )}
            {data.totals.note_total && (
              <div><strong>Note Total:</strong> {formatCurrency(data.totals.note_total)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderPaymentAdvice = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-teal-900 dark:text-teal-100 mb-4">Payment Advice</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-teal-700 dark:text-teal-300">
              <strong>Advice No:</strong> {data.advice_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-teal-700 dark:text-teal-300">
              <strong>Date:</strong> {formatDate(data.advice_date)}
            </p>
          </div>
          <div>
            <p className="text-teal-700 dark:text-teal-300">
              <strong>UTR:</strong> {data.utr || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.payer, "Payer")}
        {renderParty(data.payee, "Payee")}
      </div>

      {data.amount && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Payment Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><strong>Amount:</strong> {formatCurrency(typeof data.amount === 'object' ? data.amount.value : data.amount)}</div>
            <div><strong>Currency:</strong> {typeof data.amount === 'object' ? data.amount.currency || 'INR' : 'INR'}</div>
            <div><strong>TDS Amount:</strong> {formatCurrency(data.tds_amount)}</div>
            <div><strong>Bank:</strong> {data.bank_name || 'N/A'}</div>
            <div><strong>IFSC:</strong> {data.ifsc || 'N/A'}</div>
            <div><strong>Account No:</strong> {data.account_no || 'N/A'}</div>
          </div>
        </div>
      )}

      {data.invoice_refs && data.invoice_refs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Invoice References</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Invoice No</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Date</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.invoice_refs.map((ref: InvoiceRef, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{ref.invoice_no || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{formatDate(ref.invoice_date)}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right font-medium">
                      {formatCurrency(ref.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderZetwerkInspectionReport = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-pink-900 dark:text-pink-100 mb-4">Zetwerk Inspection Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-pink-700 dark:text-pink-300">
              <strong>Report No:</strong> {data.report_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-pink-700 dark:text-pink-300">
              <strong>Date:</strong> {formatDate(data.report_date)}
            </p>
          </div>
          <div>
            <p className="text-pink-700 dark:text-pink-300">
              <strong>PO No:</strong> {data.po_no || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><strong>Item Code:</strong> {data.item_code || 'N/A'}</div>
        <div><strong>Lot/Batch:</strong> {data.lot_batch || 'N/A'}</div>
        <div><strong>Quantity Inspected:</strong> {data.quantity_inspected || 'N/A'}</div>
        <div><strong>Sampling Plan:</strong> {data.sampling_plan || 'N/A'}</div>
        <div><strong>Final Disposition:</strong> {data.final_disposition || 'N/A'}</div>
        <div><strong>Inspector:</strong> {data.inspector || 'N/A'}</div>
      </div>

      {data.measurements && data.measurements.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Measurements</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Characteristic</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Spec</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Measured</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.measurements.map((measurement: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{measurement.characteristic || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{measurement.spec || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{measurement.measured || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        measurement.result === 'OK' ? 'bg-green-100 text-green-800' :
                        measurement.result === 'NG' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {measurement.result || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.visual_checks && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Visual Checks</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{data.visual_checks}</p>
        </div>
      )}

      {data.remarks && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Remarks</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{data.remarks}</p>
        </div>
      )}
    </div>
  );

  const renderWeighmentSlip = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Weighment Slip</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-slate-700 dark:text-slate-300">
              <strong>Slip No:</strong> {data.slip_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-slate-700 dark:text-slate-300">
              <strong>Date/Time:</strong> {formatDate(data.date_time)}
            </p>
          </div>
          <div>
            <p className="text-slate-700 dark:text-slate-300">
              <strong>Weighbridge ID:</strong> {data.weighbridge_id || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {data.vehicle && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vehicle Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><strong>Vehicle No:</strong> {data.vehicle.vehicle_no || 'N/A'}</div>
            <div><strong>Driver:</strong> {data.vehicle.driver_name || 'N/A'}</div>
            <div><strong>Phone:</strong> {data.vehicle.driver_phone || 'N/A'}</div>
          </div>
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Weight Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div><strong>Material:</strong> {data.material || 'N/A'}</div>
          <div><strong>Gross Weight:</strong> {data.gross_kg || 'N/A'} kg</div>
          <div><strong>Tare Weight:</strong> {data.tare_kg || 'N/A'} kg</div>
          <div><strong>Net Weight:</strong> {data.net_kg || 'N/A'} kg</div>
        </div>
      </div>
    </div>
  );

  const renderTestCertificate = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-violet-900 dark:text-violet-100 mb-4">Test Certificate</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-violet-700 dark:text-violet-300">
              <strong>Certificate No:</strong> {data.certificate_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-violet-700 dark:text-violet-300">
              <strong>Type:</strong> {data.certificate_type || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-violet-700 dark:text-violet-300">
              <strong>Date:</strong> {formatDate(data.date)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><strong>Grade:</strong> {data.grade || 'N/A'}</div>
        <div><strong>Specification:</strong> {data.specification || 'N/A'}</div>
        <div><strong>Heat No:</strong> {data.heat_no || 'N/A'}</div>
        <div><strong>Batch No:</strong> {data.batch_no || 'N/A'}</div>
        <div><strong>Result:</strong> 
          <span className={`ml-2 px-2 py-1 rounded text-xs ${
            data.result === 'Conforms' ? 'bg-green-100 text-green-800' :
            data.result === 'Does Not Conform' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {data.result || 'N/A'}
          </span>
        </div>
      </div>

      {data.chemical_composition && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Chemical Composition</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {Object.entries(data.chemical_composition).map(([element, value]) => (
              <div key={element}>
                <strong>{element}:</strong> {typeof value === 'number' ? value.toFixed(2) : value}%
              </div>
            ))}
          </div>
        </div>
      )}

      {data.mechanical_properties && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Mechanical Properties</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {data.mechanical_properties.uts && <div><strong>UTS:</strong> {data.mechanical_properties.uts} MPa</div>}
            {data.mechanical_properties.yield_strength && <div><strong>Yield Strength:</strong> {data.mechanical_properties.yield_strength} MPa</div>}
            {data.mechanical_properties.elongation_percent && <div><strong>Elongation:</strong> {data.mechanical_properties.elongation_percent}%</div>}
            {data.mechanical_properties.hardness_hb && <div><strong>Hardness:</strong> {data.mechanical_properties.hardness_hb} HB</div>}
          </div>
        </div>
      )}
    </div>
  );

  const renderGatePass = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-lime-50 dark:bg-lime-900/20 border border-lime-200 dark:border-lime-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-lime-900 dark:text-lime-100 mb-4">Gate Pass</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-lime-700 dark:text-lime-300">
              <strong>GP No:</strong> {data.gp_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-lime-700 dark:text-lime-300">
              <strong>Date:</strong> {formatDate(data.gp_date)}
            </p>
          </div>
          <div>
            <p className="text-lime-700 dark:text-lime-300">
              <strong>Movement:</strong> 
              <span className={`ml-2 px-2 py-1 rounded text-xs ${
                data.movement === 'Inward' ? 'bg-blue-100 text-blue-800' :
                data.movement === 'Outward' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {data.movement || 'N/A'}
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><strong>Returnable:</strong> {data.returnable ? 'Yes' : 'No'}</div>
        <div><strong>Purpose:</strong> {data.purpose || 'N/A'}</div>
      </div>

      {renderParty(data.party, "Party")}

      {data.vehicle && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vehicle Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div><strong>Vehicle No:</strong> {data.vehicle.vehicle_no || 'N/A'}</div>
            <div><strong>Driver:</strong> {data.vehicle.driver_name || 'N/A'}</div>
            <div><strong>Phone:</strong> {data.vehicle.driver_phone || 'N/A'}</div>
          </div>
        </div>
      )}

      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse border border-gray-300 dark:border-gray-600">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Description</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">Item Code</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">Qty</th>
                  <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left">UOM</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item: any, index: number) => (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.description || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.item_code || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-right">{item.qty || 'N/A'}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-3 py-2">{item.uom || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderBillOfLading = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-rose-900 dark:text-rose-100 mb-4">Bill of Lading / Air Waybill</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-rose-700 dark:text-rose-300">
              <strong>BL/AWB No:</strong> {data.bl_or_awb_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-rose-700 dark:text-rose-300">
              <strong>Mode:</strong> {data.mode || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-rose-700 dark:text-rose-300">
              <strong>Issue Date:</strong> {formatDate(data.issue_date)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {renderParty(data.shipper, "Shipper")}
        {renderParty(data.consignee, "Consignee")}
        {renderParty(data.notify_party, "Notify Party")}
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Transport Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><strong>Port of Loading:</strong> {data.pol || 'N/A'}</div>
          <div><strong>Port of Discharge:</strong> {data.pod || 'N/A'}</div>
          <div><strong>Vessel/Flight:</strong> {data.vessel_or_flight || 'N/A'}</div>
          <div><strong>Voyage/Flight No:</strong> {data.voyage_or_flight_no || 'N/A'}</div>
          <div><strong>Packages:</strong> {data.packages || 'N/A'}</div>
          <div><strong>Gross Weight:</strong> {data.gross_weight_kg || 'N/A'} kg</div>
          <div><strong>Incoterm:</strong> {data.incoterm || 'N/A'}</div>
        </div>
      </div>

      {data.container_nos && data.container_nos.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Container Numbers</h3>
          <div className="flex flex-wrap gap-2">
            {data.container_nos.map((container: string, index: number) => (
              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                {container}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderQuotationProforma = (data: DocumentData) => (
    <div className="space-y-6">
      <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-sky-900 dark:text-sky-100 mb-4">Quotation / Proforma Invoice</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sky-700 dark:text-sky-300">
              <strong>Quote/PI No:</strong> {data.quote_or_pi_no || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sky-700 dark:text-sky-300">
              <strong>Date:</strong> {formatDate(data.date)}
            </p>
          </div>
          <div>
            <p className="text-sky-700 dark:text-sky-300">
              <strong>Valid Till:</strong> {formatDate(data.valid_till)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderParty(data.seller, "Seller")}
        {renderParty(data.buyer, "Buyer")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><strong>Taxes Included:</strong> {data.taxes_included ? 'Yes' : 'No'}</div>
      </div>

      {data.items && data.items.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Items</h3>
          {renderLineItems(data.items)}
        </div>
      )}

      {data.notes && (
        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Notes</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{data.notes}</p>
        </div>
      )}
    </div>
  );

  const renderUnknown = (data: DocumentData) => (
    <div className="space-y-4">
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">Unknown Document Type</h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>This document could not be classified into a known document type.</p>
            </div>
          </div>
        </div>
      </div>

      {data.raw_text && (
        <div>
          <label className="text-sm font-medium text-gray-500">Raw Text</label>
          <div className="mt-1 p-3 bg-gray-50 rounded max-h-40 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">{data.raw_text}</p>
          </div>
        </div>
      )}

      {data.top_candidates && data.top_candidates.length > 0 && (
        <div>
          <label className="text-sm font-medium text-gray-500">Top Classification Candidates</label>
          <div className="mt-1 space-y-2">
            {data.top_candidates.map((candidate: any, index: number) => (
              <div key={index} className="p-3 bg-gray-50 rounded">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-sm">{candidate.doc_type}</span>
                  <span className="text-sm text-gray-600">
                    {candidate.confidence ? `${(candidate.confidence * 100).toFixed(1)}%` : 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderDocument = () => {
    const documentType = docType || data.doc_type;
    switch (documentType) {
      case 'TaxInvoice':
        return renderTaxInvoice(data);
      case 'EWayBill':
        return renderEWayBill(data);
      case 'LorryReceipt':
        return renderLorryReceipt(data);
      case 'MaterialReport':
        return renderMaterialReport(data);
      case 'PackingList':
        return renderPackingList(data);
      case 'DeliveryChallan':
        return renderDeliveryChallan(data);
      case 'PurchaseOrder':
        return renderPurchaseOrder(data);
      case 'CreditNote':
        return renderCreditNote(data);
      case 'DebitNote':
        return renderDebitNote(data);
      case 'PaymentAdvice':
        return renderPaymentAdvice(data);
      case 'ZetwerkInspectionReport':
        return renderZetwerkInspectionReport(data);
      case 'WeighmentSlip':
        return renderWeighmentSlip(data);
      case 'TestCertificate':
        return renderTestCertificate(data);
      case 'GatePass':
        return renderGatePass(data);
      case 'BillOfLading':
        return renderBillOfLading(data);
      case 'QuotationProforma':
        return renderQuotationProforma(data);
      case 'Unknown':
        return renderUnknown(data);
      default:
        return (
          <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {data.doc_type || 'Unknown Document'}
            </h2>
            <pre className="text-sm text-gray-600 dark:text-gray-400 overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      {renderDocument()}
    </div>
  );
}
