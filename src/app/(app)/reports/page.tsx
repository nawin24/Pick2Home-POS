"use client";
import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatINR } from "@/lib/calc";
import StatCard from "@/components/ui/StatCard";

function isoDate(d: Date) { return d.toISOString().slice(0, 10); }

const PRESETS = [
  { label: "Today",     range: () => { const d = new Date(); return [d, d]; } },
  { label: "Yesterday", range: () => { const d = new Date(); d.setDate(d.getDate() - 1); return [d, d]; } },
  { label: "This week", range: () => { const t = new Date(); const s = new Date(t); s.setDate(t.getDate() - 6); return [s, t]; } },
  { label: "This month",range: () => { const t = new Date(); const s = new Date(t.getFullYear(), t.getMonth(), 1); return [s, t]; } },
];

export default function ReportsPage() {
  const [from, setFrom] = useState(isoDate(new Date()));
  const [to, setTo] = useState(isoDate(new Date()));
  const [data, setData] = useState<any>(null);

  async function load() {
    const tEnd = new Date(to); tEnd.setDate(tEnd.getDate() + 1);
    const r = await fetch(`/api/reports?from=${from}&to=${tEnd.toISOString()}`);
    setData(await r.json());
  }
  useEffect(() => { load(); }, [from, to]);

  const summary = data?.summary;

  function exportCsv() {
    if (!data) return;
    const rows: string[][] = [["Metric","Value"]];
    rows.push(["Gross sales", String(summary.grossSales)]);
    rows.push(["Net sales", String(summary.netSales)]);
    rows.push(["Total GST", String(summary.totalGst)]);
    rows.push(["Total discount", String(summary.totalDiscount)]);
    rows.push(["Total expenses", String(summary.totalExpenses)]);
    rows.push(["Profit", String(summary.profit)]);
    rows.push([]);
    rows.push(["Top items", "Qty", "Total"]);
    data.topItems.forEach((t: any) => rows.push([t.name, String(t.qty), String(t.total)]));
    const csv = rows.map((r) => r.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `report-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!data) return <div className="text-slate-500">Loading reports...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <div className="flex items-end gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <button key={p.label} className="btn btn-secondary text-xs" onClick={() => {
              const [s, e] = p.range(); setFrom(isoDate(s)); setTo(isoDate(e));
            }}>{p.label}</button>
          ))}
          <label><span className="label">From</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label><span className="label">To</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button className="btn btn-primary" onClick={exportCsv}><Download size={14} /> CSV</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Gross Sales" value={formatINR(summary.grossSales)} />
        <StatCard label="Net Sales" value={formatINR(summary.netSales)} hint="Excluding GST" />
        <StatCard label="Total GST" value={formatINR(summary.totalGst)} />
        <StatCard label="Total Discount" value={formatINR(summary.totalDiscount)} />
        <StatCard label="Total Expenses" value={formatINR(summary.totalExpenses)} accent="bg-red-100 text-red-700" />
        <StatCard label="Estimated Profit" value={formatINR(summary.profit)} accent="bg-emerald-100 text-emerald-700" />
      </div>

      <div className="card p-4">
        <div className="font-semibold text-slate-800 mb-2">Daily Sales</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.dailySales}>
              <CartesianGrid stroke="#f1f5f9" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => formatINR(Number(v))} />
              <Bar dataKey="total" fill="#f97316" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="font-semibold text-slate-800 mb-2">Item-wise Sales</div>
          <table className="table">
            <thead><tr><th>Item</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {data.topItems.map((t: any) => (
                <tr key={t.name}><td>{t.name}</td><td>{t.qty}</td><td className="text-right">{formatINR(t.total)}</td></tr>
              ))}
              {data.topItems.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">No sales</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card p-4">
          <div className="font-semibold text-slate-800 mb-2">Cashier-wise Sales</div>
          <table className="table">
            <thead><tr><th>Cashier</th><th>Bills</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {data.cashiers.map((c: any) => (
                <tr key={c.name}><td>{c.name}</td><td>{c.count}</td><td className="text-right">{formatINR(c.total)}</td></tr>
              ))}
              {data.cashiers.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">No sales</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
