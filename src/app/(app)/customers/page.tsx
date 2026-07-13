"use client";
import { useEffect, useState } from "react";
import { Search, Phone, Mail, MapPin } from "lucide-react";
import { formatINR } from "@/lib/calc";

type Customer = {
  id: string; name: string; phone: string; email?: string | null; address?: string | null;
  visits: number; totalSpent: number; lastVisit?: string | null;
};

export default function CustomersPage() {
  const [list, setList] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  async function load() {
    const r = await fetch(`/api/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`);
    setList((await r.json()).customers);
  }
  useEffect(() => { load(); }, [q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Customers</h1>
      </div>
      <div className="card p-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input className="input pl-8" placeholder="Search by name or phone..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="table">
          <thead><tr><th>Name</th><th>Contact</th><th>Address</th><th>Visits</th><th className="text-right">Total Spent</th><th>Last Visit</th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="font-medium">{c.name}</td>
                <td>
                  <div className="text-sm flex items-center gap-1"><Phone size={11} /> {c.phone}</div>
                  {c.email && <div className="text-xs text-slate-500 flex items-center gap-1"><Mail size={11} /> {c.email}</div>}
                </td>
                <td className="text-sm text-slate-600">{c.address && <span className="flex items-center gap-1"><MapPin size={11} /> {c.address}</span>}</td>
                <td>{c.visits}</td>
                <td className="text-right">{formatINR(c.totalSpent)}</td>
                <td className="text-xs text-slate-500">{c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : "—"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="text-center text-slate-400 py-8">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
