"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatINR } from "@/lib/calc";
import { Printer, RefreshCw, Search } from "lucide-react";

type Bill = {
  id: string; 
  billNumber: string; 
  createdAt: string; 
  grandTotal: number;
  paymentMethod: string; 
  status: string; 
  orderType: string;
  cashier: { name: string }; 
  customer?: { name: string } | null;
  itemCount?: number;
  order: { 
    pickupCounter?: { number: string } | null;
    items?: any[];
  };
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function BillsPage() {
  const searchParams = useSearchParams();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    try {
      const tEnd = new Date(to); 
      tEnd.setDate(tEnd.getDate() + 1);
      const url = `/api/bills?from=${from}&to=${tEnd.toISOString().slice(0,10)}${statusFilter ? `&status=${statusFilter}` : ''}`;
      const r = await fetch(url);
      const data = await r.json();
      setBills(data.bills || []);
    } catch (error) {
      console.error("Error loading bills:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { 
    load(); 
  }, [from, to, statusFilter]);

  function handlePrint(bill: Bill) {
    window.open(`/bills/${bill.id}?print=1`, '_blank');
  }

  function getStatusColor(status: string) {
    switch(status) {
      case "PAID": return "bg-emerald-100 text-emerald-700";
      case "CANCELLED": return "bg-red-100 text-red-700";
      case "REFUNDED": return "bg-amber-100 text-amber-700";
      default: return "bg-slate-100 text-slate-700";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Bills</h1>
        <button 
          onClick={load} 
          className="btn btn-secondary flex items-center gap-2"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <label className="flex flex-col gap-1">
          <span className="label text-xs">From</span>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label text-xs">To</span>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="label text-xs">Status</span>
          <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </label>
        <button onClick={load} className="btn btn-primary h-[38px] flex items-center gap-2">
          <Search size={16} /> Search
        </button>
      </div>

      {/* Bills Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Bill</th>
                <th>Date</th>
                <th>Type</th>
                <th>Items</th>
                <th>Cashier</th>
                <th>Customer</th>
                <th>Payment</th>
                <th className="text-right">Total</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td>
                    <Link href={`/bills/${b.id}`} className="text-brand-700 font-semibold hover:underline">
                      {b.billNumber}
                    </Link>
                  </td>
                  <td className="text-xs text-slate-500">
                    {new Date(b.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <span className="chip">
                      {b.orderType}
                      {b.order?.pickupCounter?.number && ` · C${b.order.pickupCounter.number}`}
                    </span>
                  </td>
                  <td className="text-center">{b.itemCount || b.order?.items?.length || 0}</td>
                  <td className="text-sm">{b.cashier.name}</td>
                  <td className="text-sm">{b.customer?.name ?? "—"}</td>
                  <td>
                    <span className="chip text-xs">{b.paymentMethod}</span>
                  </td>
                  <td className="text-right font-semibold">{formatINR(b.grandTotal)}</td>
                  <td>
                    <span className={`badge ${getStatusColor(b.status)}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <button
                      onClick={() => handlePrint(b)}
                      className="btn btn-ghost p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Print Bill"
                    >
                      <Printer size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-slate-400 py-8">
                    No bills found in this range.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Footer */}
      {bills.length > 0 && (
        <div className="card p-4 flex justify-between items-center">
          <div>
            <span className="text-sm text-slate-500">
              Total Bills: <b>{bills.length}</b>
            </span>
          </div>
          <div>
            <span className="text-sm text-slate-500">
              Total Amount: <b className="text-brand-700 text-lg">
                {formatINR(bills.reduce((sum, b) => sum + b.grandTotal, 0))}
              </b>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

















// "use client";
// import { useEffect, useState } from "react";
// import Link from "next/link";
// import { useSearchParams } from "next/navigation";
// import { formatINR } from "@/lib/calc";
// import { Printer, RefreshCw, Search } from "lucide-react";

// type Bill = {
//   id: string; 
//   billNumber: string; 
//   createdAt: string; 
//   grandTotal: number;
//   paymentMethod: string; 
//   status: string; 
//   orderType: string;
//   cashier: { name: string }; 
//   customer?: { name: string } | null;
//   itemCount?: number;
//   order: { 
//     pickupCounter?: { number: string } | null;
//     items?: any[];
//   };
// };

// const todayISO = () => new Date().toISOString().slice(0, 10);

// export default function BillsPage() {
//   const searchParams = useSearchParams();
//   const [bills, setBills] = useState<Bill[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [from, setFrom] = useState(todayISO());
//   const [to, setTo] = useState(todayISO());
//   const [statusFilter, setStatusFilter] = useState("");

//   async function load() {
//     setLoading(true);
//     try {
//       const tEnd = new Date(to); 
//       tEnd.setDate(tEnd.getDate() + 1);
//       const url = `/api/bills?from=${from}&to=${tEnd.toISOString().slice(0,10)}${statusFilter ? `&status=${statusFilter}` : ''}`;
//       const r = await fetch(url);
//       const data = await r.json();
//       setBills(data.bills || []);
//     } catch (error) {
//       console.error("Error loading bills:", error);
//     } finally {
//       setLoading(false);
//     }
//   }

//   useEffect(() => { 
//     load(); 
//   }, [from, to, statusFilter]);

//   // Auto-print if print parameter is set
//   useEffect(() => {
//     if (searchParams.get('print') === '1') {
//       setTimeout(() => {
//         window.print();
//       }, 1000);
//     }
//   }, [searchParams]);

//   function handlePrint(bill: Bill) {
//     const printWindow = window.open(`/bills/${bill.id}?print=1`, '_blank');
//     if (printWindow) {
//       printWindow.onload = function() {
//         setTimeout(() => {
//           // printWindow.print();
//         }, 500);
//       };
//     }
//   }

//   function getStatusColor(status: string) {
//     switch(status) {
//       case "PAID": return "bg-emerald-100 text-emerald-700";
//       case "CANCELLED": return "bg-red-100 text-red-700";
//       case "REFUNDED": return "bg-amber-100 text-amber-700";
//       default: return "bg-slate-100 text-slate-700";
//     }
//   }

//   return (
//     <div className="space-y-4">
//       <div className="flex items-center justify-between">
//         <h1 className="text-2xl font-bold text-slate-800">Bills</h1>
//         <button 
//           onClick={load} 
//           className="btn btn-secondary flex items-center gap-2"
//           disabled={loading}
//         >
//           <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
//           Refresh
//         </button>
//       </div>

//       {/* Filters */}
//       <div className="card p-4 flex flex-wrap gap-3 items-end">
//         <label className="flex flex-col gap-1">
//           <span className="label text-xs">From</span>
//           <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
//         </label>
//         <label className="flex flex-col gap-1">
//           <span className="label text-xs">To</span>
//           <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
//         </label>
//         <label className="flex flex-col gap-1">
//           <span className="label text-xs">Status</span>
//           <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
//             <option value="">All</option>
//             <option value="PAID">Paid</option>
//             <option value="CANCELLED">Cancelled</option>
//             <option value="REFUNDED">Refunded</option>
//           </select>
//         </label>
//         <button onClick={load} className="btn btn-primary h-[38px] flex items-center gap-2">
//           <Search size={16} /> Search
//         </button>
//       </div>

//       {/* Bills Table */}
//       <div className="card overflow-hidden">
//         <div className="overflow-x-auto">
//           <table className="table">
//             <thead>
//               <tr>
//                 <th>Bill</th>
//                 <th>Date</th>
//                 <th>Type</th>
//                 <th>Items</th>
//                 <th>Cashier</th>
//                 <th>Customer</th>
//                 <th>Payment</th>
//                 <th className="text-right">Total</th>
//                 <th>Status</th>
//                 <th className="text-right">Actions</th>
//               </tr>
//             </thead>
//             <tbody>
//               {bills.map((b) => (
//                 <tr key={b.id} className="hover:bg-slate-50">
//                   <td>
//                     <Link href={`/bills/${b.id}`} className="text-brand-700 font-semibold hover:underline">
//                       {b.billNumber}
//                     </Link>
//                   </td>
//                   <td className="text-xs text-slate-500">
//                     {new Date(b.createdAt).toLocaleString()}
//                   </td>
//                   <td>
//                     <span className="chip">
//                       {b.orderType}
//                       {b.order?.pickupCounter?.number && ` · C${b.order.pickupCounter.number}`}
//                     </span>
//                   </td>
//                   <td className="text-center">{b.itemCount || b.order?.items?.length || 0}</td>
//                   <td className="text-sm">{b.cashier.name}</td>
//                   <td className="text-sm">{b.customer?.name ?? "—"}</td>
//                   <td>
//                     <span className="chip text-xs">{b.paymentMethod}</span>
//                   </td>
//                   <td className="text-right font-semibold">{formatINR(b.grandTotal)}</td>
//                   <td>
//                     <span className={`badge ${getStatusColor(b.status)}`}>
//                       {b.status}
//                     </span>
//                   </td>
//                   <td className="text-right">
//                     <button
//                       onClick={() => handlePrint(b)}
//                       className="btn btn-ghost p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
//                       title="Print Bill"
//                     >
//                       <Printer size={16} />
//                     </button>
//                   </td>
//                 </tr>
//               ))}
//               {bills.length === 0 && (
//                 <tr>
//                   <td colSpan={10} className="text-center text-slate-400 py-8">
//                     No bills found in this range.
//                   </td>
//                 </tr>
//               )}
//             </tbody>
//           </table>
//         </div>
//       </div>

//       {/* Summary Footer */}
//       {bills.length > 0 && (
//         <div className="card p-4 flex justify-between items-center">
//           <div>
//             <span className="text-sm text-slate-500">
//               Total Bills: <b>{bills.length}</b>
//             </span>
//           </div>
//           <div>
//             <span className="text-sm text-slate-500">
//               Total Amount: <b className="text-brand-700 text-lg">
//                 {formatINR(bills.reduce((sum, b) => sum + b.grandTotal, 0))}
//               </b>
//             </span>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
















// // "use client";
// // import { useEffect, useState } from "react";
// // import Link from "next/link";
// // import { formatINR } from "@/lib/calc";

// // type Bill = {
// //   id: string; billNumber: string; createdAt: string; grandTotal: number;
// //   paymentMethod: string; status: string; orderType: string;
// //   cashier: { name: string }; customer?: { name: string } | null;
// //   order: { table?: { number: string } | null };
// // };

// // const todayISO = () => new Date().toISOString().slice(0, 10);

// // export default function BillsPage() {
// //   const [bills, setBills] = useState<Bill[]>([]);
// //   const [from, setFrom] = useState(todayISO());
// //   const [to, setTo] = useState(todayISO());

// //   async function load() {
// //     const tEnd = new Date(to); tEnd.setDate(tEnd.getDate() + 1);
// //     const r = await fetch(`/api/bills?from=${from}&to=${tEnd.toISOString().slice(0,10)}`);
// //     setBills((await r.json()).bills);
// //   }
// //   useEffect(() => { load(); }, [from, to]);

// //   return (
// //     <div className="space-y-4">
// //       <h1 className="text-2xl font-bold text-slate-800">Bills</h1>
// //       <div className="card p-3 flex gap-2 items-end">
// //         <label><span className="label">From</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
// //         <label><span className="label">To</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
// //       </div>

// //       <div className="card overflow-hidden">
// //         <table className="table">
// //           <thead><tr><th>Bill</th><th>Date</th><th>Type</th><th>Cashier</th><th>Customer</th><th>Payment</th><th className="text-right">Total</th><th>Status</th></tr></thead>
// //           <tbody>
// //             {bills.map((b) => (
// //               <tr key={b.id} className="hover:bg-slate-50">
// //                 <td><Link href={`/bills/${b.id}`} className="text-brand-700 font-semibold hover:underline">{b.billNumber}</Link></td>
// //                 <td className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleString()}</td>
// //                 <td><span className="chip">{b.orderType}{b.order?.table?.number ? ` · T${b.order.table.number}` : ""}</span></td>
// //                 <td>{b.cashier.name}</td>
// //                 <td>{b.customer?.name ?? "—"}</td>
// //                 <td>{b.paymentMethod}</td>
// //                 <td className="text-right font-semibold">{formatINR(b.grandTotal)}</td>
// //                 <td>
// //                   <span className={`badge ${b.status === "PAID" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
// //                     {b.status}
// //                   </span>
// //                 </td>
// //               </tr>
// //             ))}
// //             {bills.length === 0 && <tr><td colSpan={8} className="text-center text-slate-400 py-8">No bills in this range.</td></tr>}
// //           </tbody>
// //         </table>
// //       </div>
// //     </div>
// //   );
// // }
