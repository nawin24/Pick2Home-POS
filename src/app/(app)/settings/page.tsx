"use client";
import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import ImageUploader from "@/components/ui/ImageUploader";

export default function SettingsPage() {
  const [s, setS] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => setS(d.settings));
  }, []);

  async function save() {
    setSaving(true);
    const r = await fetch("/api/settings", { 
      method: "PUT", 
      headers: { "content-type": "application/json" }, 
      body: JSON.stringify(s) 
    });
    setSaving(false);
    if (!r.ok) alert("Failed to save");
    else alert("Saved.");
  }

  if (!s) return <div className="text-slate-500">Loading...</div>;

  const f = (k: string) => ({ 
    value: s[k] ?? "", 
    onChange: (e: any) => setS({ ...s, [k]: e.target.value }) 
  });
  const fnum = (k: string) => ({ 
    value: s[k] ?? 0, 
    onChange: (e: any) => setS({ ...s, [k]: Number(e.target.value) }) 
  });
  const fbool = (k: string) => ({ 
    checked: !!s[k], 
    onChange: (e: any) => setS({ ...s, [k]: e.target.checked }) 
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          <Save size={16} /> {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* CHANGED: Store Profile (was Restaurant Profile) */}
      <div className="card p-5 space-y-3">
        <div className="font-semibold text-slate-800">Store Profile</div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Store Name</span>
            <input className="input" {...f("storeName")} placeholder="Pick2Home" />
          </label>
          <label>
            <span className="label">Phone</span>
            <input className="input" {...f("phone")} placeholder="+91 98765 43210" />
          </label>
          <label className="col-span-2">
            <span className="label">Address</span>
            <input className="input" {...f("address")} placeholder="123, Main Street, City" />
          </label>
          <label>
            <span className="label">Email</span>
            <input className="input" {...f("email")} placeholder="hello@freshmart.com" />
          </label>
          <label>
            <span className="label">GSTIN</span>
            <input className="input" {...f("gstin")} placeholder="22AAAAA0000A1Z5" />
          </label>
          <label>
            <span className="label">FSSAI (Optional)</span>
            <input className="input" {...f("fssai")} placeholder="12345678901234" />
          </label>
          <label className="col-span-2">
            <span className="label">Store Type</span>
            <select className="select" {...f("storeType")}>
              <option value="GROCERY">Grocery Store</option>
              <option value="RESTAURANT">Restaurant</option>
            </select>
          </label>
          <div className="col-span-2">
            <ImageUploader
              label="Store Logo"
              folder="branding"
              value={s.logoUrl ?? ""}
              onChange={(url) => setS({ ...s, logoUrl: url })}
            />
          </div>
        </div>
      </div>

      {/* CHANGED: Tax & Charges - Removed Service Charge */}
      <div className="card p-5 space-y-3">
        <div className="font-semibold text-slate-800">Tax & Charges</div>
        <div className="grid grid-cols-3 gap-3">
          <label>
            <span className="label">Default GST %</span>
            <input type="number" className="input" {...fnum("defaultGst")} />
          </label>
          <label>
            <span className="label">Packing Charge (₹)</span>
            <input type="number" className="input" {...fnum("packingCharge")} />
          </label>
          <label>
            <span className="label">Delivery Charge (₹)</span>
            <input type="number" className="input" {...fnum("deliveryCharge")} placeholder="0" />
          </label>
        </div>
        <div className="text-xs text-slate-500">
          Note: Service charge is not applicable for grocery stores.
        </div>
      </div>

      {/* NEW: Inventory Settings */}
      <div className="card p-5 space-y-3">
        <div className="font-semibold text-slate-800">Inventory Settings</div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Low Stock Alert Threshold</span>
            <input 
              type="number" 
              className="input" 
              value={s.lowStockThreshold ?? 10}
              onChange={(e) => setS({ ...s, lowStockThreshold: Number(e.target.value) })}
              placeholder="10"
            />
          </label>
          <label>
            <span className="label">Auto Reorder Quantity</span>
            <input 
              type="number" 
              className="input" 
              value={s.autoReorderQty ?? 50}
              onChange={(e) => setS({ ...s, autoReorderQty: Number(e.target.value) })}
              placeholder="50"
            />
          </label>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...fbool("allowOnlineOrders")} /> 
            Allow Online Orders
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...fbool("allowDelivery")} /> 
            Allow Delivery
          </label>
        </div>
      </div>

      {/* CHANGED: Printing */}
      <div className="card p-5 space-y-3">
        <div className="font-semibold text-slate-800">Printing</div>
        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Print Size</span>
            <select className="select" {...f("printSize")}>
              <option value="58mm">58mm</option>
              <option value="80mm">80mm</option>
              <option value="A4">A4</option>
            </select>
          </label>
          <label>
            <span className="label">Currency</span>
            <input className="input" {...f("currency")} />
          </label>
          <label className="col-span-2">
            <span className="label">Invoice Footer</span>
            <input className="input" {...f("invoiceFooter")} placeholder="Thank you for shopping with us!" />
          </label>
          <div className="col-span-2">
            <ImageUploader
              label="Payment QR Code"
              folder="branding"
              value={s.paymentQrUrl ?? ""}
              onChange={(url) => setS({ ...s, paymentQrUrl: url })}
            />
          </div>
        </div>
      </div>

      {/* Loyalty Program (unchanged) */}
      <div className="card p-5 space-y-3">
        <div className="font-semibold text-slate-800">Loyalty Program</div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...fbool("loyaltyEnabled")} /> Enable loyalty points
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label>
            <span className="label">Earn rate (₹ per point)</span>
            <input type="number" className="input" {...fnum("loyaltyEarnRupees")} />
          </label>
          <label>
            <span className="label">Redeem value (₹ per point)</span>
            <input type="number" step="0.1" className="input" {...fnum("loyaltyRedeemValue")} />
          </label>
          <label>
            <span className="label">Min points to redeem</span>
            <input type="number" className="input" {...fnum("loyaltyMinRedeem")} />
          </label>
        </div>
        <div className="text-xs text-slate-500">
          e.g. 1 point per ₹100 spent · 1 point = ₹1 · minimum 50 points to redeem.
        </div>
      </div>

      {/* CHANGED: Permissions */}
      <div className="card p-5 space-y-3">
        <div className="font-semibold text-slate-800">Permissions</div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...fbool("allowCashierDiscount")} /> 
            Allow cashier to give discounts
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...fbool("allowCashierCancel")} /> 
            Allow cashier to cancel bills
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...fbool("allowStockAdjustment")} /> 
            Allow stock adjustments by cashier
          </label>
        </div>
      </div>
    </div>
  );
}


// "use client";
// import { useEffect, useState } from "react";
// import { Save } from "lucide-react";
// import ImageUploader from "@/components/ui/ImageUploader";

// export default function SettingsPage() {
//   const [s, setS] = useState<any>(null);
//   const [saving, setSaving] = useState(false);

//   useEffect(() => {
//     fetch("/api/settings").then((r) => r.json()).then((d) => setS(d.settings));
//   }, []);

//   async function save() {
//     setSaving(true);
//     const r = await fetch("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
//     setSaving(false);
//     if (!r.ok) alert("Failed to save");
//     else alert("Saved.");
//   }

//   if (!s) return <div className="text-slate-500">Loading...</div>;

//   const f = (k: string) => ({ value: s[k] ?? "", onChange: (e: any) => setS({ ...s, [k]: e.target.value }) });
//   const fnum = (k: string) => ({ value: s[k] ?? 0, onChange: (e: any) => setS({ ...s, [k]: Number(e.target.value) }) });
//   const fbool = (k: string) => ({ checked: !!s[k], onChange: (e: any) => setS({ ...s, [k]: e.target.checked }) });

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
//         <button className="btn btn-primary" onClick={save} disabled={saving}><Save size={16} /> {saving ? "Saving…" : "Save"}</button>
//       </div>

//       <div className="card p-5 space-y-3">
//         <div className="font-semibold text-slate-800">Restaurant Profile</div>
//         <div className="grid grid-cols-2 gap-3">
//           <label><span className="label">Name</span><input className="input" {...f("storeName")} /></label>
//           <label><span className="label">Phone</span><input className="input" {...f("phone")} /></label>
//           <label className="col-span-2"><span className="label">Address</span><input className="input" {...f("address")} /></label>
//           <label><span className="label">Email</span><input className="input" {...f("email")} /></label>
//           <label><span className="label">GSTIN</span><input className="input" {...f("gstin")} /></label>
//           <label><span className="label">FSSAI</span><input className="input" {...f("fssai")} /></label>
//           <div className="col-span-2">
//             <ImageUploader
//               label="Logo"
//               folder="branding"
//               value={s.logoUrl ?? ""}
//               onChange={(url) => setS({ ...s, logoUrl: url })}
//             />
//           </div>
//         </div>
//       </div>

//       <div className="card p-5 space-y-3">
//         <div className="font-semibold text-slate-800">Tax & Charges</div>
//         <div className="grid grid-cols-3 gap-3">
//           <label><span className="label">Default GST %</span><input type="number" className="input" {...fnum("defaultGst")} /></label>
//           <label><span className="label">Packing Charge</span><input type="number" className="input" {...fnum("packingCharge")} /></label>
//           <label><span className="label">Service Charge</span><input type="number" className="input" {...fnum("serviceCharge")} /></label>
//         </div>
//       </div>

//       <div className="card p-5 space-y-3">
//         <div className="font-semibold text-slate-800">Printing</div>
//         <div className="grid grid-cols-2 gap-3">
//           <label><span className="label">Print Size</span>
//             <select className="select" {...f("printSize")}>
//               <option value="58mm">58mm</option><option value="80mm">80mm</option><option value="A4">A4</option>
//             </select>
//           </label>
//           <label><span className="label">Currency</span><input className="input" {...f("currency")} /></label>
//           <label className="col-span-2"><span className="label">Invoice Footer</span><input className="input" {...f("invoiceFooter")} /></label>
//           <div className="col-span-2">
//             <ImageUploader
//               label="Payment QR"
//               folder="branding"
//               value={s.paymentQrUrl ?? ""}
//               onChange={(url) => setS({ ...s, paymentQrUrl: url })}
//             />
//           </div>
//         </div>
//       </div>

//       <div className="card p-5 space-y-3">
//         <div className="font-semibold text-slate-800">Loyalty Program</div>
//         <label className="flex items-center gap-2 text-sm">
//           <input type="checkbox" {...fbool("loyaltyEnabled")} /> Enable loyalty points
//         </label>
//         <div className="grid grid-cols-3 gap-3">
//           <label><span className="label">Earn rate (₹ per point)</span><input type="number" className="input" {...fnum("loyaltyEarnRupees")} /></label>
//           <label><span className="label">Redeem value (₹ per point)</span><input type="number" step="0.1" className="input" {...fnum("loyaltyRedeemValue")} /></label>
//           <label><span className="label">Min points to redeem</span><input type="number" className="input" {...fnum("loyaltyMinRedeem")} /></label>
//         </div>
//         <div className="text-xs text-slate-500">e.g. 1 point per ₹100 spent · 1 point = ₹1 · minimum 50 points to redeem.</div>
//       </div>

//       <div className="card p-5 space-y-3">
//         <div className="font-semibold text-slate-800">Permissions</div>
//         <div className="space-y-2">
//           <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...fbool("allowCashierDiscount")} /> Allow cashier to give discounts</label>
//           <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...fbool("allowCashierCancel")} /> Allow cashier to cancel bills</label>
//         </div>
//       </div>
//     </div>
//   );
// }
