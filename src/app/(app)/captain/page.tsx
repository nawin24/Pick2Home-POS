"use client";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Minus, Trash2, Send, Leaf, Drumstick, Egg } from "lucide-react";
import clsx from "clsx";

type Cat = { id: string; name: string };
type Item = {
  id: string; name: string; price: number; gstPercent: number;
  itemType: string; available: boolean; categoryId: string; category: Cat;
};
type Table = { id: string; number: string; status: string; capacity: number };

const veg = (t: string) =>
  t === "VEG" ? <Leaf size={11} className="text-brand-600" /> :
  t === "EGG" ? <Egg size={11} className="text-yellow-600" /> :
  <Drumstick size={11} className="text-red-600" />;

export default function CaptainPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [cats, setCats] = useState<Cat[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [activeCat, setActiveCat] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [tableId, setTableId] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState<{ menuItemId: string; name: string; quantity: number; notes?: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/menu").then((r) => r.json()).then((d) => setItems(d.items));
    fetch("/api/categories").then((r) => r.json()).then((d) => setCats(d.categories));
    fetch("/api/tables").then((r) => r.json()).then((d) => setTables(d.tables));
  }, []);

  const filtered = useMemo(() => items.filter((i) =>
    i.available &&
    (activeCat === "ALL" || i.categoryId === activeCat) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  ), [items, activeCat, search]);

  function add(i: Item) {
    setCart((c) => {
      const idx = c.findIndex((l) => l.menuItemId === i.id);
      if (idx >= 0) {
        const copy = [...c];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...c, { menuItemId: i.id, name: i.name, quantity: 1 }];
    });
  }
  function bump(idx: number, delta: number) {
    setCart((c) => {
      const copy = [...c];
      copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + delta };
      if (copy[idx].quantity <= 0) copy.splice(idx, 1);
      return copy;
    });
  }

  async function send() {
    if (!cart.length) return;
    if (!tableId) { alert("Select a table"); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/orders/create", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderType: "DINEIN", source: "CAPTAIN", tableId, items: cart, notes }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setSent(d.order.orderNumber);
      setCart([]); setNotes("");
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-xl font-bold text-slate-800 mb-3">Captain — Take Order</h1>

      {sent && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 mb-3 text-sm">
          Sent to kitchen: <b>{sent}</b>
          <button className="ml-2 text-emerald-700 underline text-xs" onClick={() => setSent(null)}>Dismiss</button>
        </div>
      )}

      <div className="card p-3 space-y-2">
        <div>
          <label className="label">Table</label>
          <select className="select" value={tableId} onChange={(e) => setTableId(e.target.value)}>
            <option value="">Select table…</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>Table {t.number} ({t.capacity}) — {t.status}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-8" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button onClick={() => setActiveCat("ALL")} className={clsx("px-3 py-1 rounded-md text-xs whitespace-nowrap",
            activeCat === "ALL" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700")}>All</button>
          {cats.map((c) => (
            <button key={c.id} onClick={() => setActiveCat(c.id)} className={clsx("px-3 py-1 rounded-md text-xs whitespace-nowrap",
              activeCat === c.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700")}>{c.name}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {filtered.map((i) => (
          <button key={i.id} onClick={() => add(i)}
            className="card p-3 text-left hover:border-brand-300 active:scale-[.98]">
            <div className="flex items-center gap-1 mb-1">{veg(i.itemType)}<span className="text-[10px] uppercase text-slate-500 truncate">{i.category?.name}</span></div>
            <div className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{i.name}</div>
            <div className="text-brand-700 font-bold text-sm mt-1">₹{i.price}</div>
          </button>
        ))}
      </div>

      {cart.length > 0 && (
        <div className="card p-3 mt-3 space-y-2">
          <div className="font-semibold text-slate-800">Cart ({cart.length})</div>
          {cart.map((l, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="flex-1">{l.name}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => bump(idx, -1)} className="h-6 w-6 rounded bg-slate-100"><Minus size={12} /></button>
                <span className="w-6 text-center font-medium">{l.quantity}</span>
                <button onClick={() => bump(idx, 1)} className="h-6 w-6 rounded bg-brand-100 text-brand-700"><Plus size={12} /></button>
                <button onClick={() => setCart((c) => c.filter((_, i) => i !== idx))} className="h-6 w-6 rounded text-red-600"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
          <label className="label mt-2">Order note</label>
          <input className="input text-sm" placeholder="e.g., extra spicy" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <button onClick={send} disabled={submitting} className="btn btn-primary w-full mt-2">
            <Send size={14} /> {submitting ? "Sending…" : "Send to Kitchen"}
          </button>
        </div>
      )}
    </div>
  );
}
