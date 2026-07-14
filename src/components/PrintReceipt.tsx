"use client";
import { useEffect, useRef } from "react";
import { formatINR } from "@/lib/calc";

interface PrintReceiptProps {
  bill: any;
  settings: any;
  size: "58mm" | "80mm" | "A4";
  onPrintComplete?: () => void;
}

export default function PrintReceipt({ bill, settings, size, onPrintComplete }: PrintReceiptProps) {
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-print when component mounts
    const printTimeout = setTimeout(() => {
      if (printRef.current) {
        // Get the HTML content
        const content = printRef.current.innerHTML;
        
        // Create a new window with ONLY the receipt
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (!printWindow) {
          alert('Please allow popups for printing');
          if (onPrintComplete) onPrintComplete();
          return;
        }

        // Get size settings
        const maxWidth = size === "58mm" ? "58mm" : size === "80mm" ? "80mm" : "210mm";
        const fontSize = size === "58mm" ? "10px" : size === "80mm" ? "11px" : "14px";
        const padding = size === "A4" ? "20px" : "10px";

        // Write the receipt to the new window
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Receipt</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                  background: white;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  min-height: 100vh;
                  font-family: 'Courier New', monospace;
                }
                .receipt {
                  max-width: ${maxWidth};
                  width: 100%;
                  padding: ${padding};
                  font-size: ${fontSize};
                  line-height: 1.4;
                  background: white;
                }
                .text-center { text-align: center; }
                .text-right { text-align: right; }
                .text-left { text-align: left; }
                .font-bold { font-weight: bold; }
                .border-top { border-top: 1px dashed #ccc; margin: 6px 0; }
                .border-bottom { border-bottom: 1px dashed #ccc; }
                .my-1 { margin: 3px 0; }
                .my-2 { margin: 6px 0; }
                table { width: 100%; border-collapse: collapse; }
                td { padding: 2px 0; }
                th { padding: 4px 0; text-align: left; border-bottom: 1px dashed #ccc; }
                .flex { display: flex; }
                .justify-between { justify-content: space-between; }
                .text-slate-500 { color: #64748b; }
                .text-slate-600 { color: #475569; }
                img { max-width: 100%; height: auto; }
                @media print {
                  body { padding: 0; margin: 0; }
                  .receipt { max-width: 100%; padding: 5px; }
                }
              </style>
            </head>
            <body>
              <div class="receipt">
                ${content}
              </div>
              <script>
                window.onload = function() {
                  setTimeout(function() {
                    window.print();
                    setTimeout(function() {
                      window.close();
                    }, 1500);
                  }, 500);
                };
              <\/script>
            </body>
          </html>
        `);
        
        printWindow.document.close();
        printWindow.focus();
      }
      
      if (onPrintComplete) {
        setTimeout(onPrintComplete, 2000);
      }
    }, 500);

    return () => clearTimeout(printTimeout);
  }, [bill, settings, size, onPrintComplete]);

  // This component renders the receipt but it's hidden
  // It's only used to get the HTML content for the print window
  return (
    <div ref={printRef} style={{ display: 'none' }}>
      <ReceiptContent bill={bill} settings={settings} size={size} />
    </div>
  );
}

// Receipt Content Component
function ReceiptContent({ bill, settings, size }: { bill: any; settings: any; size: string }) {
  const compact = size !== "A4";
  
  return (
    <div className={compact ? "text-center" : ""}>
      {/* Store Header */}
      <div className="text-center">
        <div className={compact ? "font-bold text-base" : "font-bold text-2xl"}>
          {settings.storeName || settings.storeName || "Pick2Home"}
        </div>
        <div className="text-[10px] text-slate-600">{settings.address}</div>
        <div className="text-[10px] text-slate-600">Ph: {settings.phone}</div>
        <div className="text-[10px] text-slate-600">GSTIN: {settings.gstin}</div>
        {settings.fssai && <div className="text-[10px] text-slate-600">FSSAI: {settings.fssai}</div>}
      </div>
      <div className="border-top my-2" />

      {/* Bill Info */}
      <div className="text-left text-[10px]">
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

      <div className="border-top my-2" />

      {/* Items Table */}
      <table>
        <thead>
          <tr className="border-bottom">
            <th>Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {bill.order?.items?.map((i: any) => (
            <tr key={i.id}>
              <td>
                {i.name}
                {i.groceryItem?.sku && <span className="text-[8px] text-slate-400 ml-1">({i.groceryItem.sku})</span>}
              </td>
              <td className="text-right">{i.quantity}</td>
              <td className="text-right">{formatINR(i.price)}</td>
              <td className="text-right">{formatINR(i.price * i.quantity)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-top my-2" />

      {/* Totals */}
      <div className="text-right">
        <Row label="Subtotal" value={formatINR(bill.subtotal)} />
        {bill.itemDiscount > 0 && <Row label="Item Disc" value={`− ${formatINR(bill.itemDiscount)}`} />}
        {bill.billDiscount > 0 && <Row label="Bill Disc" value={`− ${formatINR(bill.billDiscount)}`} />}
        {bill.cgst > 0 && <Row label="CGST" value={formatINR(bill.cgst)} />}
        {bill.sgst > 0 && <Row label="SGST" value={formatINR(bill.sgst)} />}
        {bill.packingCharge > 0 && <Row label="Packing" value={formatINR(bill.packingCharge)} />}
        {bill.deliveryCharge > 0 && <Row label="Delivery" value={formatINR(bill.deliveryCharge)} />}
        {bill.roundOff !== 0 && <Row label="Round Off" value={formatINR(bill.roundOff)} />}
        {bill.couponDiscount > 0 && <Row label="Coupon" value={`− ${formatINR(bill.couponDiscount)}`} />}
        {bill.loyaltyValue > 0 && <Row label="Loyalty" value={`− ${formatINR(bill.loyaltyValue)}`} />}
        
        <div className="border-top mt-1 pt-1" />
        <div className="flex justify-between font-bold">
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

      <div className="border-top my-2" />
      
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}