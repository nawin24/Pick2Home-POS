"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { formatINR } from "@/lib/calc";

const CATS = ["RENT","SALARY","PURCHASE","VEGETABLES","GROCERIES","GAS","ELECTRICITY","MAINTENANCE","OTHER"];
const METHODS = ["CASH","UPI","CARD","BANK"];

type Expense = {
  id: string; title: string; category: string; amount: number; paymentMethod: string;
  notes?: string | null; date: string; addedBy: { name: string };
};

export default function ExpensesPage() {
  const [list, setList] = useState<Expense[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ title: "", category: "RENT", amount: 0, paymentMethod: "CASH", notes: "" });

  async function load() { setList((await (await fetch("/api/expenses")).json()).expenses); }
  useEffect(() => { load(); }, []);

  async function save() {
    if (!form.title || !form.amount) { alert("Title & amount required"); return; }
    await fetch("/api/expenses", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    setOpen(false); setForm({ title: "", category: "RENT", amount: 0, paymentMethod: "CASH", notes: "" }); load();
  }
  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" }); load();
  }

  const total = list.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Expenses</h1>
        <button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> Add Expense</button>
      </div>
      <div className="card p-4">
        <div className="text-sm text-slate-500">Total expenses</div>
        <div className="text-2xl font-bold text-slate-800">{formatINR(total)}</div>
      </div>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Title</th><th>Category</th><th>Method</th><th>Date</th><th>Added By</th><th className="text-right">Amount</th><th></th></tr></thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="font-medium">{e.title}</td>
                <td><span className="chip">{e.category}</span></td>
                <td>{e.paymentMethod}</td>
                <td className="text-xs text-slate-500">{new Date(e.date).toLocaleDateString()}</td>
                <td>{e.addedBy?.name}</td>
                <td className="text-right">{formatINR(e.amount)}</td>
                <td><button className="btn btn-ghost p-1.5 text-red-600" onClick={() => remove(e.id)}><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="text-center text-slate-400 py-8">No expenses.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Add Expense"
        footer={<><button className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                  <button className="btn btn-primary" onClick={save}>Save</button></>}>
        <div className="space-y-2">
          <label><span className="label">Title</span><input className="input" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="label">Category</span>
              <select className="select" value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                {CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label><span className="label">Method</span>
              <select className="select" value={form.paymentMethod} onChange={(e) => setForm({...form, paymentMethod: e.target.value})}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>
          <label><span className="label">Amount</span><input type="number" className="input" value={form.amount} onChange={(e) => setForm({...form, amount: Number(e.target.value)})} /></label>
          <label><span className="label">Notes</span><input className="input" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></label>
        </div>
      </Modal>
    </div>
  );
}
