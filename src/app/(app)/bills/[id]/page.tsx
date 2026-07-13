"use client";
import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, X, Ban, RefreshCw, ArrowLeft, CheckCircle } from "lucide-react";
import { formatINR } from "@/lib/calc";
import Modal from "@/components/ui/Modal";

type Bill = any;

export default function BillDetail() {
  const { id } = useParams<{ id: string }>();
  const sp = useSearchParams();
  const router = useRouter();
  const [bill, setBill] = useState<Bill | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState<"58mm" | "80mm" | "A4">("80mm");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const [refundMethod, setRefundMethod] = useState("CASH");
  const [closing, setClosing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/bills/${id}`).then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([b, s]) => {
      setBill(b.bill);
      setSettings(s.settings);
      setSize(s.settings.printSize ?? "80mm");
      setLoading(false);
      
      if (sp.get("print") === "1") {
        setTimeout(() => {
          printReceipt();
        }, 1500);
      }
    });
  }, [id, sp]);

  async function cancelBill() {
    if (!cancelReason.trim()) {
      alert("Please provide a reason for cancellation");
      return;
    }
    const r = await fetch(`/api/bills/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ 
        action: "CANCEL", 
        reason: cancelReason,
        refundAmount: bill?.grandTotal || 0,
        refundMethod: "CASH"
      }),
    });
    if (!r.ok) {
      alert("Failed to cancel bill");
      return;
    }
    setCancelOpen(false);
    const updated = await r.json();
    setBill(updated.bill);
    alert("Bill cancelled successfully");
  }

  async function refundBill() {
    if (!refundAmount || refundAmount <= 0) {
      alert("Please enter a valid refund amount");
      return;
    }
    const r = await fetch(`/api/bills/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ 
        action: "REFUND", 
        reason: "Customer refund",
        refundAmount: refundAmount,
        refundMethod: refundMethod
      }),
    });
    if (!r.ok) {
      alert("Failed to process refund");
      return;
    }
    setRefundOpen(false);
    const updated = await r.json();
    setBill(updated.bill);
    alert("Refund processed successfully");
  }

  function closeBillAndGoToPOS() {
    setClosing(true);
    router.push("/pos");
  }

  // =============================================
  // PRINT FUNCTION - Opens new window with exact size
  // =============================================
function printReceipt() {
  const receiptElement = receiptRef.current;
  if (!receiptElement) {
    alert("Receipt not found");
    return;
  }

  setIsPrinting(true);

  // Get the receipt HTML - but we need to preserve all styles
  const receiptHTML = receiptElement.innerHTML;
  
  // Get the computed styles from the receipt element
  const computedStyle = window.getComputedStyle(receiptElement);
  const fontFamily = computedStyle.fontFamily || "'Courier New', Courier, monospace";
  
  // Also get any inline styles from the receipt
  const receiptClasses = receiptElement.className;

  // Set exact paper size based on selection
  let paperWidth = "80mm";
  let fontSize = "11px";
  let padding = "8px";
  let pageWidth = "80mm";
  
  if (size === "58mm") {
    paperWidth = "58mm";
    pageWidth = "58mm";
    fontSize = "9px";
    padding = "4px";
  } else if (size === "80mm") {
    paperWidth = "80mm";
    pageWidth = "80mm";
    fontSize = "11px";
    padding = "6px";
  } else {
    // A4
    paperWidth = "210mm";
    pageWidth = "210mm";
    fontSize = "14px";
    padding = "15px";
  }

  // Create a new window
  const printWindow = window.open('', '_blank', 'width=500,height=700,scrollbars=yes');
  if (!printWindow) {
    setIsPrinting(false);
    return;
  }

  // Write the receipt with exact paper size and proper fonts
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Receipt - ${bill?.billNumber || 'Bill'}</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <!-- Load Google Fonts to match your app -->
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet">
        
        <style>
          /* COMPLETE RESET */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          html {
            margin: 0;
            padding: 0;
            background: #f0f0f0;
          }
          
          body {
            margin: 0;
            padding: 10px;
            background: #f0f0f0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            min-height: 100vh;
            font-family: 'Inter', 'Courier New', Courier, monospace;
          }
          
          /* Preview wrapper */
          .preview-wrapper {
            background: white;
            box-shadow: 0 2px 12px rgba(0,0,0,0.15);
            border-radius: 4px;
            padding: 10px;
            display: inline-block;
            margin: 0 auto;
          }
          
          /* EXACT RECEIPT SIZE - MATCHES MAIN PAGE */
          .receipt {
            width: ${paperWidth};
            min-width: ${paperWidth};
            max-width: ${paperWidth};
            padding: ${padding};
            font-size: ${fontSize};
            line-height: 1.4;
            background: white;
            font-family: 'Inter', 'Courier New', Courier, monospace;
            margin: 0;
            color: #1e293b;
          }
          
          /* Copy all receipt styles from your main component */
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .text-left { text-align: left; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .border-top { border-top: 1px dashed #cbd5e1; margin: 4px 0; padding-top: 4px; }
          .border-bottom { border-bottom: 1px dashed #cbd5e1; }
          .my-1 { margin: 3px 0; }
          .my-2 { margin: 5px 0; }
          .mt-1 { margin-top: 3px; }
          .pt-1 { padding-top: 3px; }
          .text-slate-500 { color: #64748b; }
          .text-slate-600 { color: #475569; }
          .text-brand-600 { color: #059669; }
          
          table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Inter', 'Courier New', Courier, monospace;
          }
          
          td {
            padding: 2px 0;
            font-family: 'Inter', 'Courier New', Courier, monospace;
          }
          
          th {
            padding: 3px 0;
            text-align: left;
            border-bottom: 1px dashed #cbd5e1;
            font-size: ${size === "58mm" ? "8px" : size === "80mm" ? "10px" : "12px"};
            font-weight: 600;
            font-family: 'Inter', 'Courier New', Courier, monospace;
          }
          
          .flex { display: flex; }
          .justify-between { justify-content: space-between; }
          .w-full { width: 100%; }
          
          /* For grocery items with SKU */
          .text-\\[8px\\] { font-size: 8px; }
          .ml-1 { margin-left: 4px; }
          
          img { 
            max-width: ${size === "58mm" ? "30px" : size === "80mm" ? "40px" : "60px"}; 
            height: auto; 
          }
          
          /* Badge and chip styles if used */
          .badge, .chip {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 4px;
            font-size: ${size === "58mm" ? "7px" : size === "80mm" ? "9px" : "11px"};
          }
          .bg-emerald-100 { background: #d1fae5; color: #065f46; }
          .bg-red-100 { background: #fee2e2; color: #991b1b; }
          .bg-amber-100 { background: #fef3c7; color: #92400e; }
          
          .print-btn {
            display: block;
            margin: 12px auto 0;
            padding: 10px 30px;
            background: #059669;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            font-family: 'Inter', Arial, sans-serif;
            font-weight: 500;
          }
          .print-btn:hover {
            background: #047857;
          }
          
          /* ============================================= */
          /* ✅ PRINT STYLES - EXACT PAPER SIZE */
          /* ============================================= */
          @page {
            size: ${pageWidth} auto;
            margin: 0;
          }
          
          @media print {
            /* Reset everything for print */
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              min-height: auto !important;
              height: auto !important;
              display: block !important;
            }
            
            .preview-wrapper {
              box-shadow: none !important;
              border-radius: 0 !important;
              padding: 0 !important;
              background: white !important;
              margin: 0 !important;
              display: block !important;
            }
            
            .receipt {
              width: ${paperWidth} !important;
              min-width: ${paperWidth} !important;
              max-width: ${paperWidth} !important;
              padding: ${size === "58mm" ? "3px" : size === "80mm" ? "4px" : "15px"} !important;
              margin: 0 !important;
              background: white !important;
              font-family: 'Inter', 'Courier New', Courier, monospace !important;
            }
            
            /* Ensure all text uses the same font */
            .receipt * {
              font-family: 'Inter', 'Courier New', Courier, monospace !important;
            }
            
            .print-btn {
              display: none !important;
            }
            
            /* Remove any extra spacing */
            body::before, body::after {
              display: none !important;
              content: none !important;
            }
            
            .receipt:first-child {
              margin-top: 0 !important;
            }
            .receipt:last-child {
              margin-bottom: 0 !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="preview-wrapper">
          <div class="receipt" id="print-receipt">
            ${receiptHTML}
          </div>
          <button class="print-btn" onclick="window.print()">
            🖨️ Print Receipt
          </button>
        </div>
        <script>
          // Auto-print when loaded
          window.onload = function() {
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 1500);
            }, 600);
          };
        <\/script>
      </body>
    </html>
  `);

  printWindow.document.close();
  printWindow.focus();

  setTimeout(() => {
    setIsPrinting(false);
  }, 3000);
}

  function handlePrint() {
    printReceipt();
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <RefreshCw size={32} className="animate-spin text-brand-600 mx-auto mb-4" />
        <p className="text-slate-500">Loading bill...</p>
      </div>
    </div>
  );

  if (!bill || !settings) return (
    <div className="text-center py-12">
      <p className="text-red-500">Bill not found</p>
      <Link href="/bills" className="btn btn-secondary mt-4">Back to Bills</Link>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between no-print flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Link href="/bills" className="btn btn-ghost p-2">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Bill {bill.billNumber}</h1>
          <span className={`badge ${bill.status === "PAID" ? "bg-emerald-100 text-emerald-700" : bill.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
            {bill.status}
          </span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select className="select py-1 text-sm" value={size} onChange={(e) => setSize(e.target.value as any)}>
            <option value="58mm">58mm thermal</option>
            <option value="80mm">80mm thermal</option>
            <option value="A4">A4 invoice</option>
          </select>
          <button className="btn btn-secondary" onClick={handlePrint} disabled={isPrinting}>
            <Printer size={16} /> {isPrinting ? "Printing..." : "Print"}
          </button>
          {bill.status === "PAID" && (
            <>
              <button className="btn btn-danger" onClick={() => setCancelOpen(true)}>
                <Ban size={16} /> Cancel
              </button>
              <button className="btn btn-warning" onClick={() => {
                setRefundAmount(bill.grandTotal);
                setRefundOpen(true);
              }}>
                <X size={16} /> Refund
              </button>
            </>
          )}
          <button 
            onClick={closeBillAndGoToPOS} 
            className="btn btn-success flex items-center gap-2"
            disabled={closing}
          >
            <CheckCircle size={16} />
            {closing ? "Closing..." : "Close Bill"}
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {bill.status !== "PAID" && (
        <div className={`rounded-lg border p-3 no-print ${
          bill.status === "CANCELLED" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"
        }`}>
          This bill is <b>{bill.status}</b>
          {bill.cancelReason && ` — ${bill.cancelReason}`}
          {bill.refundAmount > 0 && ` — Refunded: ${formatINR(bill.refundAmount)} via ${bill.refundMethod}`}
        </div>
      )}

      {/* Bill Receipt */}
      <div className="flex justify-center">
        <div 
          ref={receiptRef}
          id="bill-receipt" 
          className={
            size === "58mm" ? "w-[58mm] bg-white p-2 text-[10px] leading-tight border border-slate-200 shadow-lg" :
            size === "80mm" ? "w-[80mm] bg-white p-2 text-xs leading-tight border border-slate-200 shadow-lg" :
            "w-[210mm] max-w-full bg-white p-8 text-sm border border-slate-200 shadow-card"
          }
        >
          <Receipt bill={bill} settings={settings} size={size} />
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Bill"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setCancelOpen(false)}>Back</button>
            <button className="btn btn-danger" onClick={cancelBill}>
              <X size={14} /> Confirm Cancel
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Are you sure you want to cancel this bill?</p>
          <p className="text-sm text-slate-600">This will restore the stock and mark the bill as cancelled.</p>
          <label className="label">Reason for cancellation *</label>
          <input className="input" placeholder="e.g., Customer changed mind" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
        </div>
      </Modal>

      {/* Refund Modal */}
      <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Process Refund"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRefundOpen(false)}>Cancel</button>
            <button className="btn btn-warning" onClick={refundBill}>
              <X size={14} /> Process Refund
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Process a refund for this bill.</p>
          <label className="label">Refund Amount</label>
          <input 
            type="number" 
            className="input" 
            value={refundAmount} 
            onChange={(e) => setRefundAmount(Number(e.target.value))}
            max={bill.grandTotal}
          />
          <label className="label">Refund Method</label>
          <select className="select" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="ONLINE">Online</option>
          </select>
          <p className="text-xs text-slate-500">Max refund: {formatINR(bill.grandTotal)}</p>
        </div>
      </Modal>
    </div>
  );
}

function Receipt({ bill, settings, size }: { bill: any; settings: any; size: string }) {
  const compact = size !== "A4";
  
  return (
    <div className={compact ? "text-center" : ""}>
      {/* Store Header */}
      <div className="text-center">
        <div className={compact ? "font-bold text-base" : "font-bold text-2xl text-brand-600"}>
          {settings.storeName || settings.restaurantName || "Pick2Home"}
        </div>
        <div className="text-[10px] text-slate-600">{settings.address}</div>
        <div className="text-[10px] text-slate-600">Ph: {settings.phone}</div>
        <div className="text-[10px] text-slate-600">GSTIN: {settings.gstin}</div>
        {settings.fssai && <div className="text-[10px] text-slate-600">FSSAI: {settings.fssai}</div>}
      </div>
      <div className={compact ? "border-top my-2" : "border-top my-3"} />

      {/* Bill Info */}
      <div className={compact ? "text-left text-[10px]" : "grid grid-cols-2 gap-2 text-sm"}>
        <div>Bill: <b>{bill.billNumber}</b></div>
        <div>Date: {new Date(bill.createdAt).toLocaleString()}</div>
        <div>Cashier: {bill.cashier?.name}</div>
        <div>Type: {bill.orderType}
          {bill.order?.pickupCounter?.number && ` · C${bill.order.pickupCounter.number}`}
        </div>
        {bill.customer && (
          <>
            <div>Customer: {bill.customer.name}</div>
            <div>Phone: {bill.customer.phone}</div>
          </>
        )}
      </div>

      <div className={compact ? "border-top my-2" : "border-top my-3"} />

      {/* Items Table */}
      <table className="w-full text-left">
        <thead>
          <tr className="border-bottom">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {bill.order?.items?.map((i: any) => (
            <tr key={i.id}>
              <td className="py-0.5">
                {i.name}
                {i.groceryItem?.sku && <span className="text-[8px] text-slate-400 ml-1">({i.groceryItem.sku})</span>}
              </td>
              <td className="py-0.5 text-right">{i.quantity}</td>
              <td className="py-0.5 text-right">{formatINR(i.price)}</td>
              <td className="py-0.5 text-right">{formatINR(i.price * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={compact ? "border-top my-2" : "border-top my-3"} />

      {/* Totals */}
      <div className="text-right">
        <Row label="Subtotal" value={formatINR(bill.subtotal)} compact={compact} />
        {bill.itemDiscount > 0 && <Row label="Item Disc" value={`− ${formatINR(bill.itemDiscount)}`} compact={compact} />}
        {bill.billDiscount > 0 && <Row label="Bill Disc" value={`− ${formatINR(bill.billDiscount)}`} compact={compact} />}
        {bill.cgst > 0 && <Row label="CGST" value={formatINR(bill.cgst)} compact={compact} />}
        {bill.sgst > 0 && <Row label="SGST" value={formatINR(bill.sgst)} compact={compact} />}
        {bill.packingCharge > 0 && <Row label="Packing" value={formatINR(bill.packingCharge)} compact={compact} />}
        {bill.deliveryCharge > 0 && <Row label="Delivery" value={formatINR(bill.deliveryCharge)} compact={compact} />}
        {bill.roundOff !== 0 && <Row label="Round Off" value={formatINR(bill.roundOff)} compact={compact} />}
        {bill.couponDiscount > 0 && <Row label="Coupon" value={`− ${formatINR(bill.couponDiscount)}`} compact={compact} />}
        {bill.loyaltyValue > 0 && <Row label="Loyalty" value={`− ${formatINR(bill.loyaltyValue)}`} compact={compact} />}
        
        <div className={compact ? "border-top mt-1 pt-1" : "border-top mt-2 pt-2"} />
        <div className={`flex justify-between ${compact ? "text-sm" : "text-lg"} font-bold`}>
          <span>TOTAL</span>
          <span>{formatINR(bill.grandTotal)}</span>
        </div>
        
        <div className="text-[10px] mt-1 text-slate-500">
          Paid via {bill.paymentMethod}
          {bill.paymentMethod === "SPLIT" && (
            <span>
              : Cash {formatINR(bill.paymentCash)} · UPI {formatINR(bill.paymentUpi)} · Card {formatINR(bill.paymentCard)}
              {bill.paymentOnline > 0 && ` · Online ${formatINR(bill.paymentOnline)}`}
            </span>
          )}
          {bill.paymentMethod === "ONLINE" && `: ${formatINR(bill.paymentOnline)}`}
        </div>
      </div>

      <div className={compact ? "border-top my-2" : "border-top my-3"} />
      
      {/* Footer */}
      <div className="text-center text-[10px] text-slate-500">
        {settings.invoiceFooter || "Thank you for shopping at Pick2Home!"}
      </div>
      
      {/* QR Code */}
      {settings.paymentQrUrl && (
        <div className="flex justify-center mt-2">
          <img src={settings.paymentQrUrl} alt="QR Code" className="w-16 h-16" />
        </div>
      )}
    </div>
  );
}

function Row({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`flex justify-between ${compact ? "text-[10px]" : "text-sm"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

















// "use client";
// import { useEffect, useState } from "react";
// import { useParams, useSearchParams, useRouter } from "next/navigation";
// import Link from "next/link";
// import { Printer, X, Ban, RefreshCw, ArrowLeft, CheckCircle } from "lucide-react";
// import { formatINR } from "@/lib/calc";
// import Modal from "@/components/ui/Modal";

// type Bill = any;

// export default function BillDetail() {
//   const { id } = useParams<{ id: string }>();
//   const sp = useSearchParams();
//   const router = useRouter();
//   const [bill, setBill] = useState<Bill | null>(null);
//   const [settings, setSettings] = useState<any>(null);
//   const [loading, setLoading] = useState(true);
//   const [size, setSize] = useState<"58mm" | "80mm" | "A4">("80mm");
//   const [cancelOpen, setCancelOpen] = useState(false);
//   const [cancelReason, setCancelReason] = useState("");
//   const [refundOpen, setRefundOpen] = useState(false);
//   const [refundAmount, setRefundAmount] = useState(0);
//   const [refundMethod, setRefundMethod] = useState("CASH");
//   const [closing, setClosing] = useState(false);
//   const [isPrinting, setIsPrinting] = useState(false);

//   useEffect(() => {
//     Promise.all([
//       fetch(`/api/bills/${id}`).then((r) => r.json()),
//       fetch("/api/settings").then((r) => r.json()),
//     ]).then(([b, s]) => {
//       setBill(b.bill);
//       setSettings(s.settings);
//       setSize(s.settings.printSize ?? "80mm");
//       setLoading(false);
//       // Auto-print if print parameter is set
//       if (sp.get("print") === "1") {
//         setTimeout(() => {
//           setIsPrinting(true);
//           window.print();
//           setTimeout(() => {
//             setIsPrinting(false);
//           }, 1000);
//         }, 800);
//       }
//     });
//   }, [id, sp]);

//   async function cancelBill() {
//     if (!cancelReason.trim()) {
//       alert("Please provide a reason for cancellation");
//       return;
//     }
//     const r = await fetch(`/api/bills/${id}`, {
//       method: "PATCH",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify({ 
//         action: "CANCEL", 
//         reason: cancelReason,
//         refundAmount: bill?.grandTotal || 0,
//         refundMethod: "CASH"
//       }),
//     });
//     if (!r.ok) {
//       alert("Failed to cancel bill");
//       return;
//     }
//     setCancelOpen(false);
//     const updated = await r.json();
//     setBill(updated.bill);
//     alert("Bill cancelled successfully");
//   }

//   async function refundBill() {
//     if (!refundAmount || refundAmount <= 0) {
//       alert("Please enter a valid refund amount");
//       return;
//     }
//     const r = await fetch(`/api/bills/${id}`, {
//       method: "PATCH",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify({ 
//         action: "REFUND", 
//         reason: "Customer refund",
//         refundAmount: refundAmount,
//         refundMethod: refundMethod
//       }),
//     });
//     if (!r.ok) {
//       alert("Failed to process refund");
//       return;
//     }
//     setRefundOpen(false);
//     const updated = await r.json();
//     setBill(updated.bill);
//     alert("Refund processed successfully");
//   }

//   function closeBillAndGoToPOS() {
//     setClosing(true);
//     router.push("/pos");
//   }

//   // Custom print function - prints only the receipt
//   function handlePrint() {
//     setIsPrinting(true);
//     setTimeout(() => {
//       window.print();
//       setTimeout(() => {
//         setIsPrinting(false);
//       }, 1000);
//     }, 300);
//   }

//   if (loading) return (
//     <div className="flex items-center justify-center h-64">
//       <div className="text-center">
//         <RefreshCw size={32} className="animate-spin text-brand-600 mx-auto mb-4" />
//         <p className="text-slate-500">Loading bill...</p>
//       </div>
//     </div>
//   );

//   if (!bill || !settings) return (
//     <div className="text-center py-12">
//       <p className="text-red-500">Bill not found</p>
//       <Link href="/bills" className="btn btn-secondary mt-4">Back to Bills</Link>
//     </div>
//   );

//   return (
//     <div className="space-y-4">
//       {/* Header - Hidden when printing */}
//       <div className="flex items-center justify-between no-print flex-wrap gap-2">
//         <div className="flex items-center gap-3">
//           <Link href="/bills" className="btn btn-ghost p-2">
//             <ArrowLeft size={18} />
//           </Link>
//           <h1 className="text-2xl font-bold text-slate-800">Bill {bill.billNumber}</h1>
//           <span className={`badge ${bill.status === "PAID" ? "bg-emerald-100 text-emerald-700" : bill.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
//             {bill.status}
//           </span>
//         </div>
//         <div className="flex gap-2 flex-wrap">
//           <select className="select py-1 text-sm" value={size} onChange={(e) => setSize(e.target.value as any)}>
//             <option value="58mm">58mm thermal</option>
//             <option value="80mm">80mm thermal</option>
//             <option value="A4">A4 invoice</option>
//           </select>
//           <button className="btn btn-secondary" onClick={handlePrint} disabled={isPrinting}>
//             <Printer size={16} /> {isPrinting ? "Printing..." : "Print"}
//           </button>
//           {bill.status === "PAID" && (
//             <>
//               <button className="btn btn-danger" onClick={() => setCancelOpen(true)}>
//                 <Ban size={16} /> Cancel
//               </button>
//               <button className="btn btn-warning" onClick={() => {
//                 setRefundAmount(bill.grandTotal);
//                 setRefundOpen(true);
//               }}>
//                 <X size={16} /> Refund
//               </button>
//             </>
//           )}
//           <button 
//             onClick={closeBillAndGoToPOS} 
//             className="btn btn-success flex items-center gap-2"
//             disabled={closing}
//           >
//             <CheckCircle size={16} />
//             {closing ? "Closing..." : "Close Bill"}
//           </button>
//         </div>
//       </div>

//       {/* Status Banner - Hidden when printing */}
//       {bill.status !== "PAID" && (
//         <div className={`rounded-lg border p-3 no-print ${
//           bill.status === "CANCELLED" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"
//         }`}>
//           This bill is <b>{bill.status}</b>
//           {bill.cancelReason && ` — ${bill.cancelReason}`}
//           {bill.refundAmount > 0 && ` — Refunded: ${formatINR(bill.refundAmount)} via ${bill.refundMethod}`}
//         </div>
//       )}

//       {/* Bill Receipt - This is what gets printed */}
//       <div className="flex justify-center">
//         <div id="bill-receipt" className={
//           size === "58mm" ? "print-58mm w-[58mm] bg-white p-2 text-[10px] leading-tight border border-slate-200 shadow-lg" :
//           size === "80mm" ? "print-80mm w-[80mm] bg-white p-2 text-xs leading-tight border border-slate-200 shadow-lg" :
//           "w-[210mm] max-w-full bg-white p-8 text-sm border border-slate-200 shadow-card"
//         }>
//           <Receipt bill={bill} settings={settings} size={size} />
//         </div>
//       </div>

//       {/* Cancel Modal */}
//       <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel Bill"
//         footer={
//           <>
//             <button className="btn btn-secondary" onClick={() => setCancelOpen(false)}>Back</button>
//             <button className="btn btn-danger" onClick={cancelBill}>
//               <X size={14} /> Confirm Cancel
//             </button>
//           </>
//         }
//       >
//         <div className="space-y-3">
//           <p className="text-sm text-slate-600">Are you sure you want to cancel this bill?</p>
//           <p className="text-sm text-slate-600">This will restore the stock and mark the bill as cancelled.</p>
//           <label className="label">Reason for cancellation *</label>
//           <input className="input" placeholder="e.g., Customer changed mind" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
//         </div>
//       </Modal>

//       {/* Refund Modal */}
//       <Modal open={refundOpen} onClose={() => setRefundOpen(false)} title="Process Refund"
//         footer={
//           <>
//             <button className="btn btn-secondary" onClick={() => setRefundOpen(false)}>Cancel</button>
//             <button className="btn btn-warning" onClick={refundBill}>
//               <X size={14} /> Process Refund
//             </button>
//           </>
//         }
//       >
//         <div className="space-y-3">
//           <p className="text-sm text-slate-600">Process a refund for this bill.</p>
//           <label className="label">Refund Amount</label>
//           <input 
//             type="number" 
//             className="input" 
//             value={refundAmount} 
//             onChange={(e) => setRefundAmount(Number(e.target.value))}
//             max={bill.grandTotal}
//           />
//           <label className="label">Refund Method</label>
//           <select className="select" value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
//             <option value="CASH">Cash</option>
//             <option value="UPI">UPI</option>
//             <option value="CARD">Card</option>
//             <option value="ONLINE">Online</option>
//           </select>
//           <p className="text-xs text-slate-500">Max refund: {formatINR(bill.grandTotal)}</p>
//         </div>
//       </Modal>
//     </div>
//   );
// }

// function Receipt({ bill, settings, size }: { bill: any; settings: any; size: string }) {
//   const compact = size !== "A4";
  
//   return (
//     <div className={compact ? "text-center" : ""} id="print-area">
//       {/* Store Header */}
//       <div className="text-center">
//         <div className={compact ? "font-bold text-base" : "font-bold text-2xl text-brand-600"}>
//           {settings.storeName || settings.restaurantName || "Pick2Home"}
//         </div>
//         <div className="text-[10px] text-slate-600">{settings.address}</div>
//         <div className="text-[10px] text-slate-600">Ph: {settings.phone}</div>
//         <div className="text-[10px] text-slate-600">GSTIN: {settings.gstin}</div>
//         {settings.fssai && <div className="text-[10px] text-slate-600">FSSAI: {settings.fssai}</div>}
//       </div>
//       <div className={compact ? "border-t border-dashed my-2" : "border-t my-3"} />

//       {/* Bill Info */}
//       <div className={compact ? "text-left text-[10px]" : "grid grid-cols-2 gap-2 text-sm"}>
//         <div>Bill: <b>{bill.billNumber}</b></div>
//         <div>Date: {new Date(bill.createdAt).toLocaleString()}</div>
//         <div>Cashier: {bill.cashier?.name}</div>
//         <div>Type: {bill.orderType}
//           {bill.order?.pickupCounter?.number && ` · C${bill.order.pickupCounter.number}`}
//         </div>
//         {bill.customer && (
//           <>
//             <div>Customer: {bill.customer.name}</div>
//             <div>Phone: {bill.customer.phone}</div>
//           </>
//         )}
//       </div>

//       <div className={compact ? "border-t border-dashed my-2" : "border-t my-3"} />

//       {/* Items Table */}
//       <table className="w-full text-left">
//         <thead>
//           <tr className="border-b border-dashed">
//             <th className="py-1">Item</th>
//             <th className="py-1 text-right">Qty</th>
//             <th className="py-1 text-right">Rate</th>
//             <th className="py-1 text-right">Amt</th>
//           </tr>
//         </thead>
//         <tbody>
//           {bill.order?.items?.map((i: any) => (
//             <tr key={i.id}>
//               <td className="py-0.5">
//                 {i.name}
//                 {i.groceryItem?.sku && <span className="text-[8px] text-slate-400 ml-1">({i.groceryItem.sku})</span>}
//               </td>
//               <td className="py-0.5 text-right">{i.quantity}</td>
//               <td className="py-0.5 text-right">{formatINR(i.price)}</td>
//               <td className="py-0.5 text-right">{formatINR(i.price * i.quantity)}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>

//       <div className={compact ? "border-t border-dashed my-2" : "border-t my-3"} />

//       {/* Totals */}
//       <div className="text-right">
//         <Row label="Subtotal" value={formatINR(bill.subtotal)} compact={compact} />
//         {bill.itemDiscount > 0 && <Row label="Item Disc" value={`− ${formatINR(bill.itemDiscount)}`} compact={compact} />}
//         {bill.billDiscount > 0 && <Row label="Bill Disc" value={`− ${formatINR(bill.billDiscount)}`} compact={compact} />}
//         {bill.cgst > 0 && <Row label="CGST" value={formatINR(bill.cgst)} compact={compact} />}
//         {bill.sgst > 0 && <Row label="SGST" value={formatINR(bill.sgst)} compact={compact} />}
//         {bill.packingCharge > 0 && <Row label="Packing" value={formatINR(bill.packingCharge)} compact={compact} />}
//         {bill.deliveryCharge > 0 && <Row label="Delivery" value={formatINR(bill.deliveryCharge)} compact={compact} />}
//         {bill.roundOff !== 0 && <Row label="Round Off" value={formatINR(bill.roundOff)} compact={compact} />}
//         {bill.couponDiscount > 0 && <Row label="Coupon" value={`− ${formatINR(bill.couponDiscount)}`} compact={compact} />}
//         {bill.loyaltyValue > 0 && <Row label="Loyalty" value={`− ${formatINR(bill.loyaltyValue)}`} compact={compact} />}
        
//         <div className={compact ? "border-t border-dashed mt-1 pt-1" : "border-t mt-2 pt-2"} />
//         <div className={`flex justify-between ${compact ? "text-sm" : "text-lg"} font-bold`}>
//           <span>TOTAL</span>
//           <span>{formatINR(bill.grandTotal)}</span>
//         </div>
        
//         <div className="text-[10px] mt-1 text-slate-500">
//           Paid via {bill.paymentMethod}
//           {bill.paymentMethod === "SPLIT" && (
//             <span>
//               : Cash {formatINR(bill.paymentCash)} · UPI {formatINR(bill.paymentUpi)} · Card {formatINR(bill.paymentCard)}
//               {bill.paymentOnline > 0 && ` · Online ${formatINR(bill.paymentOnline)}`}
//             </span>
//           )}
//           {bill.paymentMethod === "ONLINE" && `: ${formatINR(bill.paymentOnline)}`}
//         </div>
//       </div>

//       <div className={compact ? "border-t border-dashed my-2" : "border-t my-3"} />
      
//       {/* Footer */}
//       <div className="text-center text-[10px] text-slate-500">
//         {settings.invoiceFooter || "Thank you for shopping at Pick2Home!"}
//       </div>
      
//       {/* QR Code */}
//       {settings.paymentQrUrl && (
//         <div className="flex justify-center mt-2">
//           <img src={settings.paymentQrUrl} alt="QR Code" className="w-16 h-16" />
//         </div>
//       )}
//     </div>
//   );
// }

// function Row({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
//   return (
//     <div className={`flex justify-between ${compact ? "text-[10px]" : "text-sm"}`}>
//       <span>{label}</span>
//       <span>{value}</span>
//     </div>
//   );
// }











