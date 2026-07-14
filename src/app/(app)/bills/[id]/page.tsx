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
  // PRINT FUNCTION - COMPLETELY FIXED WITH PADDING
  // =============================================
  function printReceipt() {
    const receiptElement = receiptRef.current;
    if (!receiptElement) {
      alert("Receipt not found");
      return;
    }

    setIsPrinting(true);

    // Get the receipt HTML
    const receiptHTML = receiptElement.innerHTML;

    // Set exact paper size based on selection with MORE PADDING
    let paperWidth = "80mm";
    let fontSize = "11px";
    let padding = "12px 14px"; // INCREASED PADDING
    let pageWidth = "80mm";
    let fontFamily = "'Courier New', monospace";
    let tableFontSize = "10px";
    let headerFontSize = "16px";
    let topPadding = "8px"; // ADDED TOP PADDING
    
    if (size === "58mm") {
      paperWidth = "58mm";
      pageWidth = "58mm";
      fontSize = "9px";
      padding = "8px 10px"; // INCREASED PADDING
      tableFontSize = "8px";
      headerFontSize = "12px";
      topPadding = "6px";
    } else if (size === "80mm") {
      paperWidth = "80mm";
      pageWidth = "80mm";
      fontSize = "11px";
      padding = "12px 16px"; // INCREASED PADDING
      tableFontSize = "10px";
      headerFontSize = "16px";
      topPadding = "8px";
    } else {
      paperWidth = "210mm";
      pageWidth = "210mm";
      fontSize = "14px";
      padding = "20px 30px"; // INCREASED PADDING
      tableFontSize = "13px";
      headerFontSize = "24px";
      fontFamily = "'Inter', Arial, sans-serif";
      topPadding = "15px";
    }

    // Create a new window
    const printWindow = window.open('', '_blank', 'width=600,height=800,scrollbars=yes');
    if (!printWindow) {
      setIsPrinting(false);
      alert('Please allow popups for printing');
      return;
    }

    // Write the receipt with COMPLETE FIX
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${bill?.billNumber || 'Bill'}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          
          <style>
            /* ============================================= */
            /* COMPLETE RESET */
            /* ============================================= */
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              min-height: auto !important;
              height: auto !important;
            }
            
            body {
              display: flex !important;
              justify-content: center !important;
              align-items: flex-start !important;
              padding: 10px !important;
              font-family: ${fontFamily} !important;
            }
            
            /* Preview wrapper */
            .preview-wrapper {
              background: white;
              box-shadow: 0 2px 12px rgba(0,0,0,0.15);
              padding: 10px;
              display: inline-block;
              margin: 0 auto;
              max-width: 100%;
            }
            
            /* ============================================= */
            /* RECEIPT - WITH EXTRA PADDING */
            /* ============================================= */
            .receipt {
              width: ${paperWidth} !important;
              min-width: ${paperWidth} !important;
              max-width: ${paperWidth} !important;
              padding: ${padding} !important;
              padding-top: ${topPadding} !important;
              margin: 0 auto !important;
              background: white !important;
              font-family: ${fontFamily} !important;
              font-size: ${fontSize} !important;
              line-height: 1.5 !important;
              color: #1e293b !important;
              overflow: visible !important;
              word-wrap: break-word !important;
              word-break: break-word !important;
            }
            
            /* ALL CONTENT INSIDE RECEIPT */
            .receipt * {
              font-family: ${fontFamily} !important;
              box-sizing: border-box !important;
            }
            
            /* ============================================= */
            /* TEXT STYLES */
            /* ============================================= */
            .text-center { text-align: center !important; }
            .text-right { text-align: right !important; }
            .text-left { text-align: left !important; }
            .font-bold { font-weight: 700 !important; }
            .font-semibold { font-weight: 600 !important; }
            .border-top { border-top: 1px dashed #cbd5e1 !important; margin: 4px 0 !important; padding-top: 4px !important; }
            .border-bottom { border-bottom: 1px dashed #cbd5e1 !important; }
            .my-1 { margin: 3px 0 !important; }
            .my-2 { margin: 5px 0 !important; }
            .mt-1 { margin-top: 3px !important; }
            .pt-1 { padding-top: 3px !important; }
            .text-slate-500 { color: #64748b !important; }
            .text-slate-600 { color: #475569 !important; }
            .text-brand-600 { color: #059669 !important; }
            
            /* ============================================= */
            /* STORE HEADER - WITH EXTRA PADDING */
            /* ============================================= */
            .store-header {
              text-align: center !important;
              margin-bottom: 6px !important;
              padding: 4px 0 !important;
              width: 100% !important;
              overflow: visible !important;
            }
            
            .store-name {
              font-weight: 700 !important;
              font-size: ${headerFontSize} !important;
              color: #059669 !important;
              width: 100% !important;
              overflow: visible !important;
              white-space: normal !important;
              word-wrap: break-word !important;
              display: block !important;
              padding: 4px 8px !important;
              margin: 0 !important;
              line-height: 1.4 !important;
              text-align: center !important;
            }
            
            .store-details {
              font-size: ${size === "58mm" ? "8px" : size === "80mm" ? "9px" : "12px"} !important;
              color: #475569 !important;
              margin-top: 2px !important;
              padding: 1px 4px !important;
              width: 100% !important;
              overflow: visible !important;
              white-space: normal !important;
              word-wrap: break-word !important;
              text-align: center !important;
            }
            
            /* ============================================= */
            /* TABLE - FIXES LEFT CUTOFF */
            /* ============================================= */
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              font-family: ${fontFamily} !important;
              table-layout: fixed !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            td, th {
              padding: 2px 6px !important;
              font-family: ${fontFamily} !important;
              vertical-align: top !important;
              border: none !important;
              text-align: left !important;
            }
            
            th {
              border-bottom: 1px dashed #cbd5e1 !important;
              font-weight: 600 !important;
              font-size: ${tableFontSize} !important;
            }
            
            td {
              font-size: ${tableFontSize} !important;
            }
            
            /* Column widths - prevents cutoff */
            .col-item { width: 50% !important; text-align: left !important; }
            .col-qty { width: 15% !important; text-align: right !important; }
            .col-rate { width: 17% !important; text-align: right !important; }
            .col-amt { width: 18% !important; text-align: right !important; }
            
            .flex { display: flex !important; }
            .justify-between { justify-content: space-between !important; }
            .w-full { width: 100% !important; }
            
            .text-\\[8px\\] { font-size: 8px !important; }
            .ml-1 { margin-left: 4px !important; }
            
            img { 
              max-width: ${size === "58mm" ? "30px" : size === "80mm" ? "40px" : "60px"} !important; 
              height: auto !important; 
            }
            
            .print-btn {
              display: block !important;
              margin: 12px auto 0 !important;
              padding: 10px 30px !important;
              background: #059669 !important;
              color: white !important;
              border: none !important;
              border-radius: 6px !important;
              font-size: 14px !important;
              cursor: pointer !important;
              font-family: 'Inter', Arial, sans-serif !important;
              font-weight: 500 !important;
            }
            
            /* ============================================= */
            /* PRINT STYLES - WITH EXTRA PADDING */
            /* ============================================= */
            @page {
              size: ${pageWidth} auto;
              margin: 2mm !important;
              padding: 0 !important;
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
              
              body {
                padding: 0 !important;
                margin: 0 !important;
                display: block !important;
              }
              
              .preview-wrapper {
                box-shadow: none !important;
                padding: 0 !important;
                background: white !important;
                margin: 0 !important;
                display: block !important;
              }
              
              .receipt {
                width: ${paperWidth} !important;
                min-width: ${paperWidth} !important;
                max-width: ${paperWidth} !important;
                padding: ${size === "58mm" ? "6px 10px" : size === "80mm" ? "8px 14px" : "15px 25px"} !important;
                padding-top: ${size === "58mm" ? "10px" : size === "80mm" ? "12px" : "20px"} !important;
                margin: 0 auto !important;
                background: white !important;
                font-family: ${fontFamily} !important;
                font-size: ${fontSize} !important;
                overflow: visible !important;
                display: block !important;
              }
              
              /* Force all text to be visible */
              .receipt * {
                font-family: ${fontFamily} !important;
                overflow: visible !important;
              }
              
              /* Store name in print - EXTRA PADDING */
              .store-name {
                font-size: ${headerFontSize} !important;
                white-space: normal !important;
                word-wrap: break-word !important;
                display: block !important;
                width: 100% !important;
                padding: 6px 10px !important;
                margin: 0 !important;
              }
              
              .store-details {
                white-space: normal !important;
                word-wrap: break-word !important;
                padding: 2px 4px !important;
              }
              
              /* Fix table cells in print */
              td, th {
                padding: 2px 6px !important;
                font-size: ${tableFontSize} !important;
              }
              
              .print-btn {
                display: none !important;
              }
              
              /* Ensure no extra spacing */
              body::before, body::after {
                display: none !important;
                content: none !important;
              }
              
              /* Force all content to be visible */
              .receipt div, .receipt span, .receipt p {
                overflow: visible !important;
                white-space: normal !important;
                word-wrap: break-word !important;
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
            window.onload = function() {
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  window.close();
                }, 2000);
              }, 800);
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
            size === "58mm" ? "w-[58mm] bg-white p-3 text-[10px] leading-tight border border-slate-200 shadow-lg" :
            size === "80mm" ? "w-[80mm] bg-white p-3 text-xs leading-tight border border-slate-200 shadow-lg" :
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

// =============================================
// RECEIPT COMPONENT - WITH EXTRA PADDING
// =============================================
function Receipt({ bill, settings, size }: { bill: any; settings: any; size: string }) {
  const compact = size !== "A4";
  
  // Get restaurant name - FIXED with multiple fallbacks
  const storeName = settings?.storeName || 
                        settings?.storeName || 
                        settings?.businessName || 
                        "Pick2Home";
  
  const address = settings?.address || "Your Store Address";
  const phone = settings?.phone || "0000000000";
  const gstin = settings?.gstin || "";
  const fssai = settings?.fssai || "";
  const footer = settings?.invoiceFooter || "Thank you for shopping at Pick2Home!";
  
  // Determine font sizes based on paper size
  const nameFontSize = compact ? "14px" : "22px";
  const detailFontSize = compact ? "9px" : "12px";
  const tableFontSize = compact ? "9px" : "12px";
  
  return (
    <div style={{ 
      width: '100%', 
      overflow: 'visible', 
      padding: '4px 0', 
      margin: 0,
      display: 'block'
    }}>
      {/* ============================================ */}
      {/* STORE HEADER - WITH EXTRA PADDING ON TOP */}
      {/* ============================================ */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: compact ? '6px' : '10px',
        paddingTop: compact ? '6px' : '12px',
        paddingBottom: compact ? '4px' : '8px',
        paddingLeft: '4px',
        paddingRight: '4px',
        width: '100%',
        overflow: 'visible',
        display: 'block'
      }}>
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: nameFontSize,
          color: '#059669',
          width: '100%',
          overflow: 'visible',
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          display: 'block',
          padding: '4px 8px',
          margin: '0 auto',
          lineHeight: '1.4',
          textAlign: 'center'
        }}>
          {storeName}
        </div>
        <div style={{ 
          fontSize: detailFontSize, 
          color: '#475569',
          marginTop: '3px',
          padding: '1px 4px',
          width: '100%',
          overflow: 'visible',
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          display: 'block',
          textAlign: 'center'
        }}>
          {address}
        </div>
        <div style={{ 
          fontSize: detailFontSize, 
          color: '#475569',
          padding: '1px 4px',
          width: '100%',
          overflow: 'visible',
          whiteSpace: 'normal',
          wordWrap: 'break-word',
          display: 'block',
          textAlign: 'center'
        }}>
          Ph: {phone}
        </div>
        {gstin && (
          <div style={{ 
            fontSize: detailFontSize, 
            color: '#475569',
            padding: '1px 4px',
            width: '100%',
            overflow: 'visible',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            display: 'block',
            textAlign: 'center'
          }}>
            GSTIN: {gstin}
          </div>
        )}
        {fssai && (
          <div style={{ 
            fontSize: detailFontSize, 
            color: '#475569',
            padding: '1px 4px',
            width: '100%',
            overflow: 'visible',
            whiteSpace: 'normal',
            wordWrap: 'break-word',
            display: 'block',
            textAlign: 'center'
          }}>
            FSSAI: {fssai}
          </div>
        )}
      </div>
      
      <div style={{ 
        borderTop: '1px dashed #cbd5e1', 
        margin: compact ? '4px 0' : '8px 0',
        paddingTop: compact ? '4px' : '8px',
        width: '100%'
      }} />

      {/* ============================================ */}
      {/* BILL INFO */}
      {/* ============================================ */}
      <div style={{ 
        fontSize: compact ? '9px' : '12px',
        width: '100%',
        overflow: 'visible',
        padding: '0 2px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
          <span>Bill: <b>{bill?.billNumber || 'N/A'}</b></span>
          <span>Date: {bill?.createdAt ? new Date(bill.createdAt).toLocaleString() : 'N/A'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
          <span>Cashier: {bill?.cashier?.name || 'N/A'}</span>
          <span>Type: {bill?.orderType || 'N/A'}
            {bill?.order?.pickupCounter?.number && ` · C${bill.order.pickupCounter.number}`}
          </span>
        </div>
        {bill?.customer && (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
            <span>Customer: {bill.customer.name || 'N/A'}</span>
            <span>Phone: {bill.customer.phone || 'N/A'}</span>
          </div>
        )}
      </div>

      <div style={{ 
        borderTop: '1px dashed #cbd5e1', 
        margin: compact ? '4px 0' : '8px 0',
        paddingTop: compact ? '4px' : '8px',
        width: '100%'
      }} />

      {/* ============================================ */}
      {/* ITEMS TABLE */}
      {/* ============================================ */}
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        fontSize: tableFontSize,
        margin: 0,
        padding: 0,
        tableLayout: 'fixed'
      }}>
        <thead>
          <tr>
            <th style={{ 
              textAlign: 'left', 
              padding: '2px 6px',
              borderBottom: '1px dashed #cbd5e1',
              width: '50%',
              fontSize: compact ? '8px' : '11px'
            }}>Item</th>
            <th style={{ 
              textAlign: 'right', 
              padding: '2px 6px',
              borderBottom: '1px dashed #cbd5e1',
              width: '15%',
              fontSize: compact ? '8px' : '11px'
            }}>Qty</th>
            <th style={{ 
              textAlign: 'right', 
              padding: '2px 6px',
              borderBottom: '1px dashed #cbd5e1',
              width: '17%',
              fontSize: compact ? '8px' : '11px'
            }}>Rate</th>
            <th style={{ 
              textAlign: 'right', 
              padding: '2px 6px',
              borderBottom: '1px dashed #cbd5e1',
              width: '18%',
              fontSize: compact ? '8px' : '11px'
            }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {bill?.order?.items?.map((i: any) => (
            <tr key={i.id}>
              <td style={{ 
                padding: '2px 6px',
                textAlign: 'left',
                wordWrap: 'break-word',
                overflow: 'visible',
                fontSize: compact ? '8px' : '11px'
              }}>
                {i.name || 'Item'}
                {i.groceryItem?.sku && (
                  <span style={{ fontSize: '7px', color: '#94a3b8', marginLeft: '4px' }}>
                    ({i.groceryItem.sku})
                  </span>
                )}
              </td>
              <td style={{ 
                padding: '2px 6px', 
                textAlign: 'right',
                fontSize: compact ? '8px' : '11px'
              }}>{i.quantity || 0}</td>
              <td style={{ 
                padding: '2px 6px', 
                textAlign: 'right',
                fontSize: compact ? '8px' : '11px'
              }}>{formatINR(i.price || 0)}</td>
              <td style={{ 
                padding: '2px 6px', 
                textAlign: 'right',
                fontSize: compact ? '8px' : '11px'
              }}>{formatINR((i.price || 0) * (i.quantity || 0))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ 
        borderTop: '1px dashed #cbd5e1', 
        margin: compact ? '4px 0' : '8px 0',
        paddingTop: compact ? '4px' : '8px',
        width: '100%'
      }} />

      {/* ============================================ */}
      {/* TOTALS */}
      {/* ============================================ */}
      <div style={{ textAlign: 'right', width: '100%', padding: '0 2px' }}>
        <Row label="Subtotal" value={formatINR(bill?.subtotal || 0)} compact={compact} />
        {bill?.itemDiscount > 0 && <Row label="Item Disc" value={`− ${formatINR(bill.itemDiscount)}`} compact={compact} />}
        {bill?.billDiscount > 0 && <Row label="Bill Disc" value={`− ${formatINR(bill.billDiscount)}`} compact={compact} />}
        {bill?.cgst > 0 && <Row label="CGST" value={formatINR(bill.cgst)} compact={compact} />}
        {bill?.sgst > 0 && <Row label="SGST" value={formatINR(bill.sgst)} compact={compact} />}
        {bill?.packingCharge > 0 && <Row label="Packing" value={formatINR(bill.packingCharge)} compact={compact} />}
        {bill?.deliveryCharge > 0 && <Row label="Delivery" value={formatINR(bill.deliveryCharge)} compact={compact} />}
        {bill?.roundOff !== 0 && <Row label="Round Off" value={formatINR(bill.roundOff)} compact={compact} />}
        {bill?.couponDiscount > 0 && <Row label="Coupon" value={`− ${formatINR(bill.couponDiscount)}`} compact={compact} />}
        {bill?.loyaltyValue > 0 && <Row label="Loyalty" value={`− ${formatINR(bill.loyaltyValue)}`} compact={compact} />}
        
        <div style={{ 
          borderTop: '1px dashed #cbd5e1', 
          marginTop: compact ? '4px' : '8px',
          paddingTop: compact ? '4px' : '8px',
          width: '100%'
        }} />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between',
          fontWeight: 'bold',
          fontSize: compact ? '12px' : '18px',
          width: '100%'
        }}>
          <span>TOTAL</span>
          <span>{formatINR(bill?.grandTotal || 0)}</span>
        </div>
        
        <div style={{ 
          fontSize: compact ? '8px' : '11px', 
          marginTop: '4px',
          color: '#64748b',
          width: '100%'
        }}>
          Paid via {bill?.paymentMethod || 'N/A'}
          {bill?.paymentMethod === "SPLIT" && (
            <span>
              : Cash {formatINR(bill.paymentCash)} · UPI {formatINR(bill.paymentUpi)} · Card {formatINR(bill.paymentCard)}
              {bill.paymentOnline > 0 && ` · Online ${formatINR(bill.paymentOnline)}`}
            </span>
          )}
          {bill?.paymentMethod === "ONLINE" && `: ${formatINR(bill.paymentOnline)}`}
        </div>
      </div>

      <div style={{ 
        borderTop: '1px dashed #cbd5e1', 
        margin: compact ? '4px 0' : '8px 0',
        paddingTop: compact ? '4px' : '8px',
        width: '100%'
      }} />
      
      {/* ============================================ */}
      {/* FOOTER */}
      {/* ============================================ */}
      <div style={{ 
        textAlign: 'center', 
        fontSize: compact ? '8px' : '12px',
        color: '#64748b',
        width: '100%',
        overflow: 'visible',
        padding: '4px 0'
      }}>
        {footer}
      </div>
      
      {/* QR Code */}
      {settings?.paymentQrUrl && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', width: '100%' }}>
          <img src={settings.paymentQrUrl} alt="QR Code" style={{ 
            width: compact ? '40px' : '64px', 
            height: 'auto' 
          }} />
        </div>
      )}
    </div>
  );
}

// =============================================
// ROW COMPONENT
// =============================================
function Row({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between',
      fontSize: compact ? '8px' : '12px',
      width: '100%',
      padding: '1px 0'
    }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}