"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Search, Plus, Minus, ShoppingCart, Package, Box, CheckCircle2 } from "lucide-react";
import clsx from "clsx";

// CHANGED: Category type with icon
type Cat = { id: string; name: string; icon?: string | null };

// CHANGED: Item → GroceryItem with grocery fields
type GroceryItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  mrp: number;
  unit: string;
  brand: string | null;
  stockQuantity: number;
  available: boolean;
  categoryId: string;
  category: Cat;
  imageUrl?: string | null;
};

type Store = { storeName: string; address: string; phone: string };

// Product icon for grocery items
const ProductIcon = ({ item }: { item: GroceryItem }) => {
  if (item.unit === "kg" || item.unit === "gm") {
    return <span className="text-xs">⚖️</span>;
  }
  if (item.unit === "ltr" || item.unit === "ml") {
    return <span className="text-xs">🧴</span>;
  }
  if (item.unit === "packet" || item.unit === "box") {
    return <span className="text-xs">📦</span>;
  }
  return <Package size={12} className="text-slate-400" />;
};

export default function QRMenuPage() {
  const params = useParams<{ tableNumber: string }>();
  const tableNumber = decodeURIComponent(params.tableNumber);
  const [store, setStore] = useState<Store | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [activeCat, setActiveCat] = useState("ALL");
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<{ groceryItemId: string; name: string; price: number; quantity: number }[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/qr/menu").then((r) => r.json()).then((d) => {
      setStore(d.restaurant || d.store); 
      setCats(d.categories); 
      setItems(d.items);
    });
  }, []);

  const filtered = useMemo(() => items.filter((i) =>
    (activeCat === "ALL" || i.categoryId === activeCat) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase())) &&
    i.available
  ), [items, activeCat, search]);

  function add(i: GroceryItem) {
    // Check if in stock
    if (i.stockQuantity <= 0) {
      alert(`${i.name} is out of stock!`);
      return;
    }
    setCart((c) => {
      const idx = c.findIndex((l) => l.groceryItemId === i.id);
      if (idx >= 0) {
        const copy = [...c];
        if (copy[idx].quantity + 1 > i.stockQuantity) {
          alert(`Only ${i.stockQuantity} ${i.unit} available`);
          return copy;
        }
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
        return copy;
      }
      return [...c, { groceryItemId: i.id, name: i.name, price: i.price, quantity: 1 }];
    });
  }

  function bump(idx: number, delta: number) {
    setCart((c) => {
      const copy = [...c];
      const item = items.find(i => i.id === copy[idx].groceryItemId);
      const newQty = copy[idx].quantity + delta;
      if (item && newQty > item.stockQuantity && delta > 0) {
        alert(`Only ${item.stockQuantity} ${item.unit} available`);
        return copy;
      }
      copy[idx] = { ...copy[idx], quantity: newQty };
      if (copy[idx].quantity <= 0) copy.splice(idx, 1);
      return copy;
    });
  }

  const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const totalQty = cart.reduce((s, l) => s + l.quantity, 0);

  async function place() {
    setSubmitting(true);
    try {
      const r = await fetch("/api/qr/order", {
        method: "POST", 
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ 
          tableNumber, 
          items: cart.map((l) => ({ groceryItemId: l.groceryItemId, quantity: l.quantity })),
          orderType: "WALKIN"
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setPlaced(d.orderNumber); 
      setCart([]); 
      setCartOpen(false);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!store) return <div className="p-6 text-slate-500">Loading products…</div>;

  if (placed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50">
        <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-card text-center">
          <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-slate-800">Order Placed!</h1>
          <p className="text-slate-600 mt-2">Order <b>{placed}</b> sent to the store for Counter {tableNumber}.</p>
          <button className="btn btn-primary mt-4" onClick={() => setPlaced(null)}>Order More</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-20">
        <div className="font-bold text-slate-800 text-lg">{store.storeName}</div>
        <div className="text-xs text-slate-500">Counter {tableNumber} · Scan to order</div>
      </header>

      <div className="p-3 space-y-2 sticky top-[60px] bg-slate-50 z-10">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
          <input 
            className="input pl-8" 
            placeholder="Search products..." 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          <button 
            onClick={() => setActiveCat("ALL")} 
            className={clsx("px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
              activeCat === "ALL" ? "bg-brand-600 text-white" : "bg-white border border-slate-200")}
          >All</button>
          {cats.map((c) => (
            <button 
              key={c.id} 
              onClick={() => setActiveCat(c.id)} 
              className={clsx("px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
                activeCat === c.id ? "bg-brand-600 text-white" : "bg-white border border-slate-200")}
            >
              {c.icon} {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 space-y-2">
        {filtered.map((i) => {
          const inCart = cart.find((l) => l.groceryItemId === i.id);
          const isLowStock = i.stockQuantity <= 5 && i.stockQuantity > 0;
          const isOutOfStock = i.stockQuantity <= 0;
          
          return (
            <div key={i.id} className={clsx("card p-3 flex items-center justify-between",
              isOutOfStock ? "opacity-50" : "",
              isLowStock && !isOutOfStock ? "border-yellow-300" : ""
            )}>
              <div className="flex-1 pr-2">
                <div className="flex items-center gap-1">
                  <ProductIcon item={i} />
                  <span className="font-semibold text-slate-800 text-sm">{i.name}</span>
                  {i.brand && (
                    <span className="text-[10px] text-slate-400">· {i.brand}</span>
                  )}
                </div>
                {i.description && (
                  <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{i.description}</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-brand-700">₹{i.price}</span>
                  {i.mrp > i.price && (
                    <span className="text-xs text-slate-400 line-through">₹{i.mrp}</span>
                  )}
                  <span className="text-[10px] text-slate-400">{i.unit}</span>
                  {isLowStock && !isOutOfStock && (
                    <span className="text-[10px] text-yellow-600">⚠️ Low stock</span>
                  )}
                  {isOutOfStock && (
                    <span className="text-[10px] text-red-600">Out of stock</span>
                  )}
                  {i.stockQuantity > 0 && (
                    <span className="text-[10px] text-slate-400">({i.stockQuantity} left)</span>
                  )}
                </div>
              </div>
              {isOutOfStock ? (
                <span className="text-xs text-red-600">Out of stock</span>
              ) : inCart ? (
                <div className="flex items-center gap-1 bg-brand-50 rounded-lg p-1">
                  <button 
                    onClick={() => bump(cart.indexOf(inCart), -1)} 
                    className="h-7 w-7 rounded bg-white text-brand-700"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center font-semibold text-brand-700">{inCart.quantity}</span>
                  <button 
                    onClick={() => bump(cart.indexOf(inCart), 1)} 
                    className="h-7 w-7 rounded bg-brand-600 text-white"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => add(i)} 
                  className="btn btn-primary px-3 py-1.5 text-sm"
                >
                  <Plus size={12} /> Add
                </button>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-slate-400 py-12">
            No products found.
          </div>
        )}
      </div>

      {totalQty > 0 && (
        <button 
          onClick={() => setCartOpen(true)} 
          className="fixed bottom-4 left-4 right-4 bg-brand-600 text-white rounded-xl py-3 px-4 flex items-center justify-between shadow-xl"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingCart size={16} /> {totalQty} items
          </span>
          <span className="font-bold">₹{subtotal} · Review →</span>
        </button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setCartOpen(false)}>
          <div className="bg-white rounded-t-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 font-semibold">
              Your Order — Counter {tableNumber}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {cart.map((l, idx) => (
                <div key={idx} className="flex items-center justify-between border border-slate-100 rounded-lg p-2">
                  <div className="flex-1">
                    <div className="text-sm font-medium">{l.name}</div>
                    <div className="text-xs text-slate-500">₹{l.price} × {l.quantity}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => bump(idx, -1)} className="h-7 w-7 rounded bg-slate-100"><Minus size={12} /></button>
                    <span className="w-6 text-center font-semibold">{l.quantity}</span>
                    <button onClick={() => bump(idx, 1)} className="h-7 w-7 rounded bg-brand-100 text-brand-700"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center text-slate-400 py-8">Cart is empty</div>
              )}
            </div>
            <div className="border-t border-slate-100 p-3">
              <div className="flex justify-between text-sm mb-2">
                <span>Subtotal</span>
                <span className="font-bold">₹{subtotal}</span>
              </div>
              <div className="text-[11px] text-slate-500 mb-2">
                Taxes calculated at the counter. Pay at the checkout.
              </div>
              <button 
                onClick={place} 
                disabled={submitting || cart.length === 0} 
                className="btn btn-primary w-full text-base py-3"
              >
                {submitting ? "Sending…" : "Place Order"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// "use client";
// import { useEffect, useMemo, useState } from "react";
// import { useParams } from "next/navigation";
// import { Search, Plus, Minus, ShoppingCart, Leaf, Drumstick, Egg, CheckCircle2 } from "lucide-react";
// import clsx from "clsx";

// type Cat = { id: string; name: string };
// type Item = { id: string; name: string; description?: string; price: number; itemType: string; categoryId: string };
// type Restaurant = { name: string; address: string; phone: string };

// const veg = (t: string) =>
//   t === "VEG" ? <Leaf size={12} className="text-brand-600" /> :
//   t === "EGG" ? <Egg size={12} className="text-yellow-600" /> :
//   <Drumstick size={12} className="text-red-600" />;

// export default function QRMenuPage() {
//   const params = useParams<{ tableNumber: string }>();
//   const tableNumber = decodeURIComponent(params.tableNumber);
//   const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
//   const [cats, setCats] = useState<Cat[]>([]);
//   const [items, setItems] = useState<Item[]>([]);
//   const [activeCat, setActiveCat] = useState("ALL");
//   const [search, setSearch] = useState("");
//   const [cart, setCart] = useState<{ menuItemId: string; name: string; price: number; quantity: number }[]>([]);
//   const [cartOpen, setCartOpen] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
//   const [placed, setPlaced] = useState<string | null>(null);

//   useEffect(() => {
//     fetch("/api/qr/menu").then((r) => r.json()).then((d) => {
//       setRestaurant(d.restaurant); setCats(d.categories); setItems(d.items);
//     });
//   }, []);

//   const filtered = useMemo(() => items.filter((i) =>
//     (activeCat === "ALL" || i.categoryId === activeCat) &&
//     (!search || i.name.toLowerCase().includes(search.toLowerCase()))
//   ), [items, activeCat, search]);

//   function add(i: Item) {
//     setCart((c) => {
//       const idx = c.findIndex((l) => l.menuItemId === i.id);
//       if (idx >= 0) {
//         const copy = [...c]; copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 }; return copy;
//       }
//       return [...c, { menuItemId: i.id, name: i.name, price: i.price, quantity: 1 }];
//     });
//   }
//   function bump(idx: number, delta: number) {
//     setCart((c) => {
//       const copy = [...c];
//       copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + delta };
//       if (copy[idx].quantity <= 0) copy.splice(idx, 1);
//       return copy;
//     });
//   }

//   const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
//   const totalQty = cart.reduce((s, l) => s + l.quantity, 0);

//   async function place() {
//     setSubmitting(true);
//     try {
//       const r = await fetch("/api/qr/order", {
//         method: "POST", headers: { "content-type": "application/json" },
//         body: JSON.stringify({ tableNumber, items: cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity })) }),
//       });
//       const d = await r.json();
//       if (!r.ok) throw new Error(d.error || "Failed");
//       setPlaced(d.orderNumber); setCart([]); setCartOpen(false);
//     } catch (e: any) {
//       alert(e.message);
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   if (!restaurant) return <div className="p-6 text-slate-500">Loading menu…</div>;

//   if (placed) {
//     return (
//       <div className="min-h-screen flex items-center justify-center p-6 bg-emerald-50">
//         <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-card text-center">
//           <CheckCircle2 size={48} className="text-emerald-500 mx-auto mb-3" />
//           <h1 className="text-xl font-bold text-slate-800">Order Placed!</h1>
//           <p className="text-slate-600 mt-2">Order <b>{placed}</b> sent to the kitchen for Table {tableNumber}.</p>
//           <button className="btn btn-primary mt-4" onClick={() => setPlaced(null)}>Order More</button>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-slate-50 pb-24">
//       <header className="bg-white border-b border-slate-100 px-4 py-3 sticky top-0 z-20">
//         <div className="font-bold text-slate-800 text-lg">{restaurant.name}</div>
//         <div className="text-xs text-slate-500">Table {tableNumber} · Scan to order</div>
//       </header>

//       <div className="p-3 space-y-2 sticky top-[60px] bg-slate-50 z-10">
//         <div className="relative">
//           <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
//           <input className="input pl-8" placeholder="Search dishes..." value={search} onChange={(e) => setSearch(e.target.value)} />
//         </div>
//         <div className="flex gap-1 overflow-x-auto pb-1">
//           <button onClick={() => setActiveCat("ALL")} className={clsx("px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
//             activeCat === "ALL" ? "bg-brand-600 text-white" : "bg-white border border-slate-200")}>All</button>
//           {cats.map((c) => (
//             <button key={c.id} onClick={() => setActiveCat(c.id)} className={clsx("px-3 py-1.5 rounded-md text-xs whitespace-nowrap",
//               activeCat === c.id ? "bg-brand-600 text-white" : "bg-white border border-slate-200")}>{c.name}</button>
//           ))}
//         </div>
//       </div>

//       <div className="px-3 space-y-2">
//         {filtered.map((i) => {
//           const inCart = cart.find((l) => l.menuItemId === i.id);
//           return (
//             <div key={i.id} className="card p-3 flex items-center justify-between">
//               <div className="flex-1 pr-2">
//                 <div className="flex items-center gap-1">{veg(i.itemType)}<span className="font-semibold text-slate-800 text-sm">{i.name}</span></div>
//                 {i.description && <div className="text-xs text-slate-500 line-clamp-2 mt-0.5">{i.description}</div>}
//                 <div className="font-bold text-brand-700 mt-1">₹{i.price}</div>
//               </div>
//               {inCart ? (
//                 <div className="flex items-center gap-1 bg-brand-50 rounded-lg p-1">
//                   <button onClick={() => bump(cart.indexOf(inCart), -1)} className="h-7 w-7 rounded bg-white text-brand-700"><Minus size={12} /></button>
//                   <span className="w-6 text-center font-semibold text-brand-700">{inCart.quantity}</span>
//                   <button onClick={() => bump(cart.indexOf(inCart), 1)} className="h-7 w-7 rounded bg-brand-600 text-white"><Plus size={12} /></button>
//                 </div>
//               ) : (
//                 <button onClick={() => add(i)} className="btn btn-primary px-3 py-1.5 text-sm"><Plus size={12} /> Add</button>
//               )}
//             </div>
//           );
//         })}
//       </div>

//       {totalQty > 0 && (
//         <button onClick={() => setCartOpen(true)} className="fixed bottom-4 left-4 right-4 bg-brand-600 text-white rounded-xl py-3 px-4 flex items-center justify-between shadow-xl">
//           <span className="flex items-center gap-2 font-semibold"><ShoppingCart size={16} /> {totalQty} items</span>
//           <span className="font-bold">₹{subtotal} · Review →</span>
//         </button>
//       )}

//       {cartOpen && (
//         <div className="fixed inset-0 z-50 bg-black/40 flex items-end" onClick={() => setCartOpen(false)}>
//           <div className="bg-white rounded-t-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
//             <div className="p-4 border-b border-slate-100 font-semibold">Your Order — Table {tableNumber}</div>
//             <div className="flex-1 overflow-y-auto p-3 space-y-2">
//               {cart.map((l, idx) => (
//                 <div key={idx} className="flex items-center justify-between border border-slate-100 rounded-lg p-2">
//                   <div className="flex-1">
//                     <div className="text-sm font-medium">{l.name}</div>
//                     <div className="text-xs text-slate-500">₹{l.price} × {l.quantity}</div>
//                   </div>
//                   <div className="flex items-center gap-1">
//                     <button onClick={() => bump(idx, -1)} className="h-7 w-7 rounded bg-slate-100"><Minus size={12} /></button>
//                     <span className="w-6 text-center font-semibold">{l.quantity}</span>
//                     <button onClick={() => bump(idx, 1)} className="h-7 w-7 rounded bg-brand-100 text-brand-700"><Plus size={12} /></button>
//                   </div>
//                 </div>
//               ))}
//             </div>
//             <div className="border-t border-slate-100 p-3">
//               <div className="flex justify-between text-sm mb-2">
//                 <span>Subtotal</span><span className="font-bold">₹{subtotal}</span>
//               </div>
//               <div className="text-[11px] text-slate-500 mb-2">Taxes calculated at the counter. Pay your bill at the counter.</div>
//               <button onClick={place} disabled={submitting} className="btn btn-primary w-full text-base py-3">
//                 {submitting ? "Sending…" : "Send to Kitchen"}
//               </button>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
