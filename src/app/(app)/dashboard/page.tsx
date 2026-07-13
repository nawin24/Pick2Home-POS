"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { IndianRupee, Receipt, Package, CheckCircle2, Banknote, Smartphone, CreditCard, TrendingUp, AlertTriangle, ShoppingBag, Truck } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { formatINR } from "@/lib/calc";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

const PIE = ["#f97316", "#22c55e", "#3b82f6"];

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading || !data) return <div className="text-slate-500">Loading dashboard...</div>;

  const { summary, payments, orders, topItems, dailySales, recentBills, inventory } = data;
  
  // CHANGED: Use 'orders' instead of 'kot'
  const paymentChart = [
    { name: "Cash", value: payments.cash },
    { name: "UPI", value: payments.upi },
    { name: "Card", value: payments.card },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <div className="flex gap-2">
          <Link href="/pos" className="btn btn-primary">New Sale</Link>
          <Link href="/products" className="btn btn-secondary">Products</Link>
        </div>
      </div>

      {/* CHANGED: Stats row - replaced Kitchen stats with Inventory stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Today's Sales" value={formatINR(summary.grossSales)} icon={<IndianRupee size={18} />} />
        <StatCard label="Bills Today" value={summary.billCount} icon={<Receipt size={18} />} accent="bg-blue-100 text-blue-700" />
        <StatCard label="Pending Orders" value={orders?.pending || 0} icon={<ShoppingBag size={18} />} accent="bg-amber-100 text-amber-700" />
        <StatCard label="Completed Orders" value={orders?.completed || 0} icon={<CheckCircle2 size={18} />} accent="bg-emerald-100 text-emerald-700" />
      </div>

      {/* NEW: Inventory Stats Row */}
      {inventory && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            label="Total Products" 
            value={inventory.totalProducts || 0} 
            icon={<Package size={18} />} 
            accent="bg-purple-100 text-purple-700" 
          />
          <StatCard 
            label="Low Stock Items" 
            value={inventory.lowStockItems || 0} 
            icon={<AlertTriangle size={18} />} 
            accent="bg-yellow-100 text-yellow-700" 
          />
          <StatCard 
            label="Out of Stock" 
            value={inventory.outOfStockItems || 0} 
            icon={<AlertTriangle size={18} />} 
            accent="bg-red-100 text-red-700" 
          />
          <StatCard 
            label="Inventory Value" 
            value={formatINR(inventory.inventoryValue || 0)} 
            icon={<IndianRupee size={18} />} 
            accent="bg-indigo-100 text-indigo-700" 
          />
        </div>
      )}

      {/* Payment stats row - Added Online payment */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Cash" value={formatINR(payments.cash)} icon={<Banknote size={18} />} accent="bg-emerald-100 text-emerald-700" />
        <StatCard label="UPI" value={formatINR(payments.upi)} icon={<Smartphone size={18} />} accent="bg-violet-100 text-violet-700" />
        <StatCard label="Card" value={formatINR(payments.card)} icon={<CreditCard size={18} />} accent="bg-sky-100 text-sky-700" />
        <StatCard label="Online" value={formatINR(payments.online || 0)} icon={<Truck size={18} />} accent="bg-pink-100 text-pink-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-slate-800">Daily Sales</div>
            <TrendingUp size={16} className="text-slate-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySales}>
                <CartesianGrid stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => formatINR(Number(v))} />
                <Bar dataKey="total" fill="#f97316" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <div className="font-semibold text-slate-800 mb-2">Payment Mix</div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentChart} dataKey="value" nameKey="name" outerRadius={80} label>
                  {paymentChart.map((_, i) => <Cell key={i} fill={PIE[i]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => formatINR(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CHANGED: Top Selling Items - now shows grocery items with unit */}
        <div className="card p-4">
          <div className="font-semibold text-slate-800 mb-3">Top Selling Products</div>
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {topItems.length === 0 && (
                <tr><td colSpan={3} className="text-center text-slate-400 py-6">No sales yet</td></tr>
              )}
              {topItems.map((t: any) => (
                <tr key={t.name}>
                  <td>
                    <div className="font-medium">{t.name}</div>
                    {t.sku && <div className="text-[10px] text-slate-400">SKU: {t.sku}</div>}
                  </td>
                  <td>
                    {t.qty} {t.unit || 'pcs'}
                  </td>
                  <td className="text-right">{formatINR(t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CHANGED: Recent Bills - updated for grocery */}
        <div className="card p-4">
          <div className="font-semibold text-slate-800 mb-3">Recent Bills</div>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Type</th>
                <th>Items</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {recentBills.length === 0 && (
                <tr><td colSpan={4} className="text-center text-slate-400 py-6">No bills yet</td></tr>
              )}
              {recentBills.map((b: any) => (
                <tr key={b.id}>
                  <td>
                    <Link href={`/bills/${b.id}`} className="text-brand-600 hover:underline font-medium">
                      {b.billNumber}
                    </Link>
                  </td>
                  <td><span className="chip">{b.orderType}</span></td>
                  <td>{b.itemCount || b.order?.items?.length || 0}</td>
                  <td className="text-right">{formatINR(b.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW: Quick Actions for Grocery Store */}
      <div className="card p-4">
        <div className="font-semibold text-slate-800 mb-3">Quick Actions</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link href="/pos" className="btn btn-primary text-center">New Sale</Link>
          <Link href="/products" className="btn btn-secondary text-center">Manage Products</Link>
          <Link href="/inventory" className="btn btn-secondary text-center">Inventory</Link>
          <Link href="/suppliers" className="btn btn-secondary text-center">Suppliers</Link>
        </div>
      </div>
    </div>
  );
}


// "use client";
// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { IndianRupee, Receipt, ChefHat, CheckCircle2, Banknote, Smartphone, CreditCard, TrendingUp } from "lucide-react";
// import StatCard from "@/components/ui/StatCard";
// import { formatINR } from "@/lib/calc";
// import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";

// const PIE = ["#f97316", "#22c55e", "#3b82f6"];

// export default function Dashboard() {
//   const [data, setData] = useState<any>(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     fetch("/api/reports")
//       .then((r) => r.json())
//       .then((d) => { setData(d); setLoading(false); });
//   }, []);

//   if (loading || !data) return <div className="text-slate-500">Loading dashboard...</div>;

//   const { summary, payments, kot, topItems, dailySales, recentBills } = data;
//   const paymentChart = [
//     { name: "Cash", value: payments.cash },
//     { name: "UPI", value: payments.upi },
//     { name: "Card", value: payments.card },
//   ];

//   return (
//     <div className="space-y-6">
//       <div className="flex items-center justify-between">
//         <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
//         <div className="flex gap-2">
//           <Link href="/pos" className="btn btn-primary">New Bill</Link>
//           <Link href="/kitchen" className="btn btn-secondary">Kitchen</Link>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
//         <StatCard label="Today's Sales" value={formatINR(summary.grossSales)} icon={<IndianRupee size={18} />} />
//         <StatCard label="Bills Today" value={summary.billCount} icon={<Receipt size={18} />} accent="bg-blue-100 text-blue-700" />
//         <StatCard label="Kitchen Pending" value={kot.pending} icon={<ChefHat size={18} />} accent="bg-amber-100 text-amber-700" />
//         <StatCard label="Completed" value={kot.completed} icon={<CheckCircle2 size={18} />} accent="bg-emerald-100 text-emerald-700" />
//       </div>

//       <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
//         <StatCard label="Cash" value={formatINR(payments.cash)} icon={<Banknote size={18} />} accent="bg-emerald-100 text-emerald-700" />
//         <StatCard label="UPI" value={formatINR(payments.upi)} icon={<Smartphone size={18} />} accent="bg-violet-100 text-violet-700" />
//         <StatCard label="Card" value={formatINR(payments.card)} icon={<CreditCard size={18} />} accent="bg-sky-100 text-sky-700" />
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
//         <div className="card p-4 lg:col-span-2">
//           <div className="flex items-center justify-between mb-2">
//             <div className="font-semibold text-slate-800">Daily Sales</div>
//             <TrendingUp size={16} className="text-slate-400" />
//           </div>
//           <div className="h-64">
//             <ResponsiveContainer width="100%" height="100%">
//               <BarChart data={dailySales}>
//                 <CartesianGrid stroke="#f1f5f9" />
//                 <XAxis dataKey="day" tick={{ fontSize: 11 }} />
//                 <YAxis tick={{ fontSize: 11 }} />
//                 <Tooltip formatter={(v: any) => formatINR(Number(v))} />
//                 <Bar dataKey="total" fill="#f97316" radius={[6, 6, 0, 0]} />
//               </BarChart>
//             </ResponsiveContainer>
//           </div>
//         </div>
//         <div className="card p-4">
//           <div className="font-semibold text-slate-800 mb-2">Payment Mix</div>
//           <div className="h-64">
//             <ResponsiveContainer width="100%" height="100%">
//               <PieChart>
//                 <Pie data={paymentChart} dataKey="value" nameKey="name" outerRadius={80} label>
//                   {paymentChart.map((_, i) => <Cell key={i} fill={PIE[i]} />)}
//                 </Pie>
//                 <Tooltip formatter={(v: any) => formatINR(Number(v))} />
//               </PieChart>
//             </ResponsiveContainer>
//           </div>
//         </div>
//       </div>

//       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
//         <div className="card p-4">
//           <div className="font-semibold text-slate-800 mb-3">Top Selling Items</div>
//           <table className="table">
//             <thead><tr><th>Item</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
//             <tbody>
//               {topItems.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">No sales yet</td></tr>}
//               {topItems.map((t: any) => (
//                 <tr key={t.name}>
//                   <td className="font-medium">{t.name}</td>
//                   <td>{t.qty}</td>
//                   <td className="text-right">{formatINR(t.total)}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//         <div className="card p-4">
//           <div className="font-semibold text-slate-800 mb-3">Recent Bills</div>
//           <table className="table">
//             <thead><tr><th>#</th><th>Type</th><th className="text-right">Total</th></tr></thead>
//             <tbody>
//               {recentBills.length === 0 && <tr><td colSpan={3} className="text-center text-slate-400 py-6">No bills yet</td></tr>}
//               {recentBills.map((b: any) => (
//                 <tr key={b.id}>
//                   <td>
//                     <Link href={`/bills/${b.id}`} className="text-brand-600 hover:underline font-medium">
//                       {b.billNumber}
//                     </Link>
//                   </td>
//                   <td><span className="chip">{b.orderType}</span></td>
//                   <td className="text-right">{formatINR(b.grandTotal)}</td>
//                 </tr>
//               ))}
//             </tbody>
//           </table>
//         </div>
//       </div>
//     </div>
//   );
// }
