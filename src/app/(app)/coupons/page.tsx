"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Power } from "lucide-react";
import Modal from "@/components/ui/Modal";

type Coupon = {
  id: string; code: string; description?: string | null; type: string; value: number;
  minOrder: number; maxDiscount?: number | null; validUntil?: string | null;
  usageLimit?: number | null; usedCount: number; active: boolean;
};

export default function CouponsPage() {
  const [list, setList] = useState<Coupon[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ code: "", type: "PERCENT", value: 10, minOrder: 0, maxDiscount: "", validUntil: "", usageLimit: "" });

  async function load() { setList((await (await fetch("/api/coupons")).json()).coupons); }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.code) return;
    const body = {
      ...form,
      maxDiscount: form.maxDiscount === "" ? null : Number(form.maxDiscount),
      usageLimit: form.usageLimit === "" ? null : Number(form.usageLimit),
      validUntil: form.validUntil || null,
    };
    const r = await fetch("/api/coupons", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) { alert((await r.json()).error || "Failed"); return; }
    setOpen(false); setForm({ code: "", type: "PERCENT", value: 10, minOrder: 0, maxDiscount: "", validUntil: "", usageLimit: "" }); load();
  }
  async function toggle(c: Coupon) {
    await fetch(`/api/coupons/${c.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !c.active }) });
    load();
  }
  async function remove(id: string) {
    if (!confirm("Delete coupon?")) return;
    await fetch(`/api/coupons/${id}`, { method: "DELETE" }); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Coupons</h1>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Add Coupon</button>
      </div>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Max Disc</th><th>Used</th><th>Expires</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="font-mono font-semibold">{c.code}</td>
                <td><span className="chip">{c.type}</span></td>
                <td>{c.type === "PERCENT" ? `${c.value}%` : `₹${c.value}`}</td>
                <td>₹{c.minOrder}</td>
                <td>{c.maxDiscount ? `₹${c.maxDiscount}` : "—"}</td>
                <td>{c.usedCount}{c.usageLimit ? `/${c.usageLimit}` : ""}</td>
                <td className="text-xs text-slate-500">{c.validUntil ? new Date(c.validUntil).toLocaleDateString() : "—"}</td>
                <td>
                  <button onClick={() => toggle(c)} className={`badge ${c.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                    <Power size={11} /> {c.active ? "Active" : "Off"}
                  </button>
                </td>
                <td><button className="btn btn-ghost p-1.5 text-red-600" onClick={() => remove(c.id)}><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={9} className="text-center text-slate-400 py-8">No coupons yet.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Coupon" size="lg"
        footer={<><button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Code</span><input className="input uppercase" value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} /></label>
          <label><span className="label">Type</span>
            <select className="select" value={form.type} onChange={(e) => setForm({...form, type: e.target.value})}>
              <option value="PERCENT">Percent</option><option value="FLAT">Flat ₹</option>
            </select>
          </label>
          <label><span className="label">Value</span><input type="number" className="input" value={form.value} onChange={(e) => setForm({...form, value: Number(e.target.value)})} /></label>
          <label><span className="label">Min Order ₹</span><input type="number" className="input" value={form.minOrder} onChange={(e) => setForm({...form, minOrder: Number(e.target.value)})} /></label>
          <label><span className="label">Max Discount ₹ (optional)</span><input type="number" className="input" value={form.maxDiscount} onChange={(e) => setForm({...form, maxDiscount: e.target.value})} /></label>
          <label><span className="label">Usage Limit (optional)</span><input type="number" className="input" value={form.usageLimit} onChange={(e) => setForm({...form, usageLimit: e.target.value})} /></label>
          <label><span className="label">Valid Until</span><input type="date" className="input" value={form.validUntil} onChange={(e) => setForm({...form, validUntil: e.target.value})} /></label>
          <label className="col-span-2"><span className="label">Description</span><input className="input" value={form.description ?? ""} onChange={(e) => setForm({...form, description: e.target.value})} /></label>
        </div>
      </Modal>
    </div>
  );
}
