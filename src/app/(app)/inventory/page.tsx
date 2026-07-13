"use client";
import { useEffect, useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import Modal from "@/components/ui/Modal";

type Item = {
  id: string; name: string; unit: string; openingStock: number;
  purchased: number; used: number; minStock: number; available: number; lowStock: boolean;
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", unit: "kg", openingStock: 0, minStock: 0 });
  const [adjustOpen, setAdjustOpen] = useState<string | null>(null);
  const [delta, setDelta] = useState({ purchased: 0, used: 0 });

  async function load() { setItems((await (await fetch("/api/inventory")).json()).items); }
  useEffect(() => { load(); }, []);

  async function add() {
    if (!form.name) return;
    await fetch("/api/inventory", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    setOpen(false); setForm({ name: "", unit: "kg", openingStock: 0, minStock: 0 }); load();
  }
  async function adjust() {
    if (!adjustOpen) return;
    await fetch(`/api/inventory/${adjustOpen}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ purchasedDelta: delta.purchased, usedDelta: delta.used }),
    });
    setAdjustOpen(null); setDelta({ purchased: 0, used: 0 }); load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Add Item</button>
      </div>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Item</th><th>Unit</th><th>Opening</th><th>Purchased</th><th>Used</th><th>Min</th><th>Available</th><th></th></tr></thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className={`hover:bg-slate-50 ${i.lowStock ? "bg-red-50" : ""}`}>
                <td className="font-medium flex items-center gap-1">
                  {i.lowStock && <AlertTriangle size={14} className="text-red-600" />}
                  {i.name}
                </td>
                <td>{i.unit}</td>
                <td>{i.openingStock}</td>
                <td>{i.purchased}</td>
                <td>{i.used}</td>
                <td>{i.minStock}</td>
                <td className="font-semibold">{i.available}</td>
                <td><button className="btn btn-secondary text-xs" onClick={() => setAdjustOpen(i.id)}>Adjust</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8">No inventory items.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Inventory Item"
        footer={<><button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={add}>Save</button></>}>
        <div className="space-y-2">
          <label><span className="label">Name</span><input className="input" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></label>
          <div className="grid grid-cols-3 gap-2">
            <label><span className="label">Unit</span>
              <select className="select" value={form.unit} onChange={(e) => setForm({...form, unit: e.target.value})}>
                <option>kg</option><option>gm</option><option>ltr</option><option>ml</option><option>pcs</option><option>pack</option>
              </select>
            </label>
            <label><span className="label">Opening</span><input type="number" className="input" value={form.openingStock} onChange={(e) => setForm({...form, openingStock: Number(e.target.value)})} /></label>
            <label><span className="label">Min Stock</span><input type="number" className="input" value={form.minStock} onChange={(e) => setForm({...form, minStock: Number(e.target.value)})} /></label>
          </div>
        </div>
      </Modal>

      <Modal open={!!adjustOpen} onClose={() => setAdjustOpen(null)} title="Adjust Stock"
        footer={<><button className="btn btn-secondary" onClick={() => setAdjustOpen(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={adjust}>Apply</button></>}>
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">+ Purchased</span><input type="number" className="input" value={delta.purchased} onChange={(e) => setDelta({...delta, purchased: Number(e.target.value)})} /></label>
          <label><span className="label">+ Used</span><input type="number" className="input" value={delta.used} onChange={(e) => setDelta({...delta, used: Number(e.target.value)})} /></label>
        </div>
      </Modal>
    </div>
  );
}
