"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus, Trash2, Save, CreditCard, Banknote, Smartphone, SplitSquareHorizontal, Pause, History, Receipt, X, Package, Box, Scale } from "lucide-react";
import { computeBill, formatINR, CartLine } from "@/lib/calc";
import Modal from "@/components/ui/Modal";
import USBScaleReader from "@/components/USBScaleReader";
import clsx from "clsx";

// Category type with icon
type Category = { id: string; name: string; icon?: string | null };

// GroceryItem type
type GroceryItem = {
  id: string;
  name: string;
  price: number;
  mrp: number;
  gstPercent: number;
  unit: string;
  stockQuantity: number;
  minStock: number;
  brand: string | null;
  packaging: string | null;
  isPerishable: boolean;
  available: boolean;
  imageUrl?: string | null;
  categoryId: string;
  category: Category;
  sku: string;
  barcode: string | null;
};

type Held = { 
  id: string; 
  note: string | null; 
  orderType: string; 
  cartJson: string; 
  createdAt: string; 
  createdBy: { name: string } 
};

type Payment = { 
  method: "CASH" | "UPI" | "CARD" | "SPLIT"; 
  cash?: number; 
  upi?: number; 
  card?: number 
};

type OrderType = "WALKIN" | "DELIVERY" | "ONLINE";

type CartLineWithWeight = CartLine & {
  weight?: number;
  isWeightBased: boolean;
};

// Product Icon
const ProductIcon = ({ item }: { item: GroceryItem }) => {
  if (item.isPerishable) {
    return <span className="text-xs text-purple-600">🧊</span>;
  }
  return <Package size={12} className="text-slate-400" />;
};

export default function GroceryPOSPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [held, setHeld] = useState<Held[]>([]);
  const [activeCat, setActiveCat] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("WALKIN");
  const [cart, setCart] = useState<CartLineWithWeight[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [billDiscountPercent, setBillDiscountPercent] = useState<number>(0);
  const [packing, setPacking] = useState<number>(0);
  const [delivery, setDelivery] = useState<number>(0);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
  const [customerProfile, setCustomerProfile] = useState<{ loyaltyPoints: number } | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [settings, setSettings] = useState<{ loyaltyEnabled: boolean; loyaltyRedeemValue: number; loyaltyMinRedeem: number } | null>(null);
  const [deliveryInfo, setDeliveryInfo] = useState({ name: "", phone: "", address: "", partner: "" });
  const [payment, setPayment] = useState<Payment>({ method: "CASH" });
  const [payOpen, setPayOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [holdNote, setHoldNote] = useState("");
  const [recallOpen, setRecallOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Scale related states
  const [showScaleReader, setShowScaleReader] = useState(false);
  const [selectedProductForScale, setSelectedProductForScale] = useState<GroceryItem | null>(null);

  useEffect(() => {
    fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories));
    fetch("/api/menu").then((r) => r.json()).then((d) => setItems(d.items));
    fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings));
  }, []);

  // Lookup customer when phone changes
  useEffect(() => {
    const phone = customer.phone.trim();
    if (phone.length < 8) { setCustomerProfile(null); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/customers?q=${encodeURIComponent(phone)}`);
      const d = await r.json();
      const match = (d.customers ?? []).find((c: any) => c.phone === phone);
      setCustomerProfile(match ? { loyaltyPoints: match.loyaltyPoints ?? 0 } : null);
    }, 300);
    return () => clearTimeout(t);
  }, [customer.phone]);

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    const subtotal = cart.reduce((s, l) => s + l.price * l.quantity - (l.discount ?? 0), 0);
    const r = await fetch("/api/coupons/validate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: couponInput.trim().toUpperCase(), subtotal }),
    });
    const d = await r.json();
    if (!r.ok) { alert(d.error || "Invalid coupon"); return; }
    setCouponCode(d.coupon.code);
    setCouponDiscount(d.discount);
  }
  function removeCoupon() { setCouponCode(""); setCouponDiscount(0); setCouponInput(""); }

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (!i.available) return false;
      if (activeCat !== "ALL" && i.categoryId !== activeCat) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, activeCat, search]);

  // Check if item is weight-based (unit is kg or gm)
  function isWeightBased(item: GroceryItem): boolean {
    return item.unit === "kg" || item.unit === "gm";
  }

  // Add item to cart - shows scale reader for weight-based items
  function addItem(i: GroceryItem) {
    if (i.stockQuantity <= 0) {
      alert(`${i.name} is out of stock!`);
      return;
    }

    const isWeightBasedItem = isWeightBased(i);
    
    if (isWeightBasedItem) {
      setSelectedProductForScale(i);
      setShowScaleReader(true);
    } else {
      // For non-weight items, add normally
      setCart((c) => {
        const idx = c.findIndex((l) => l.menuItemId === i.id);
        if (idx >= 0) {
          const copy = [...c];
          if (copy[idx].quantity + 1 > i.stockQuantity) {
            alert(`Only ${i.stockQuantity} ${i.unit} available in stock`);
            return copy;
          }
          copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
          return copy;
        }
        return [...c, { 
          menuItemId: i.id, 
          name: i.name, 
          price: i.price, 
          gstPercent: i.gstPercent, 
          quantity: 1, 
          discount: 0,
          isWeightBased: false
        }];
      });
    }
  }

  // Handle weight from scale - auto-adds to cart
  function handleWeightFromScale(weight: number) {
    if (!selectedProductForScale) return;
    
    const product = selectedProductForScale;
    if (weight <= 0) {
      setShowScaleReader(false);
      setSelectedProductForScale(null);
      return;
    }
    
    if (weight > product.stockQuantity) {
      alert(`Only ${product.stockQuantity} kg available in stock`);
      setShowScaleReader(false);
      setSelectedProductForScale(null);
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.menuItemId === product.id);
      
      if (existingIndex >= 0) {
        const updatedCart = [...prevCart];
        const existing = updatedCart[existingIndex];
        const newWeight = (existing.weight || 0) + weight;
        
        updatedCart[existingIndex] = {
          ...existing,
          weight: newWeight,
          quantity: newWeight,
          price: product.price,
          isWeightBased: true
        };
        return updatedCart;
      } else {
        const newItem = {
          menuItemId: product.id,
          name: product.name,
          price: product.price,
          gstPercent: product.gstPercent,
          quantity: weight,
          discount: 0,
          weight: weight,
          isWeightBased: true
        };
        return [...prevCart, newItem];
      }
    });

    setShowScaleReader(false);
    setSelectedProductForScale(null);
  }

  function changeQty(idx: number, delta: number) {
    setCart((c) => {
      const copy = [...c];
      const item = items.find(i => i.id === copy[idx].menuItemId);
      const newQty = copy[idx].quantity + delta;
      
      if (item && newQty > item.stockQuantity) {
        alert(`Only ${item.stockQuantity} ${item.unit} available in stock`);
        return copy;
      }
      
      copy[idx] = { ...copy[idx], quantity: newQty };
      
      if (copy[idx].isWeightBased) {
        copy[idx].weight = newQty;
      }
      
      if (copy[idx].quantity <= 0) copy.splice(idx, 1);
      return copy;
    });
  }

  function removeLine(idx: number) { 
    setCart((c) => c.filter((_, i) => i !== idx)); 
  }

  function changeLineDiscount(idx: number, value: number) {
    setCart((c) => c.map((l, i) => i === idx ? { ...l, discount: value } : l));
  }

  const totalWeight = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.weight || item.quantity), 0);
  }, [cart]);

  const loyaltyValue = useMemo(() => {
    if (!settings?.loyaltyEnabled || !redeemPoints) return 0;
    return redeemPoints * settings.loyaltyRedeemValue;
  }, [settings, redeemPoints]);

  const computed = useMemo(() => computeBill(cart, {
    packingCharge: packing,
    serviceCharge: 0,
    deliveryCharge: orderType === "DELIVERY" ? delivery : 0,
    billDiscount,
    billDiscountPercent,
    couponDiscount,
    loyaltyRedeemValue: loyaltyValue,
  }), [cart, packing, delivery, orderType, billDiscount, billDiscountPercent, couponDiscount, loyaltyValue]);

  // UPDATED: Save Bill - Only router.push, no window.open
  async function saveBill() {
    if (!cart.length) {
      alert("Cart is empty!");
      return;
    }
    
    if (payment.method === "SPLIT") {
      const sum = (payment.cash ?? 0) + (payment.upi ?? 0) + (payment.card ?? 0);
      if (Math.abs(sum - computed.grandTotal) > 0.5) {
        alert(`Split total ${formatINR(sum)} must equal grand total ${formatINR(computed.grandTotal)}`);
        return;
      }
    }
    
    setSubmitting(true);
    try {
      const r = await fetch("/api/bills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderType,
          source: "POS",
          customer: customer.phone && customer.name ? customer : undefined,
          cart: cart.map(item => ({
            ...item,
            quantity: item.weight || item.quantity
          })),
          extras: {
            packingCharge: packing,
            serviceCharge: 0,
            deliveryCharge: orderType === "DELIVERY" ? delivery : 0,
            billDiscount,
            billDiscountPercent,
          },
          couponCode: couponCode || undefined,
          redeemPoints: redeemPoints || undefined,
          payment,
          delivery: orderType === "DELIVERY" ? deliveryInfo : undefined,
        }),
      });
      
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed");
      
      // ✅ FIXED: Only use router.push - bill page handles auto-print
      router.push(`/bills/${json.bill.id}?print=1`);
      
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSubmitting(false);
      setCart([]);
      setCustomer({ name: "", phone: "", email: "", address: "" });
      setDeliveryInfo({ name: "", phone: "", address: "", partner: "" });
      setPayment({ method: "CASH" });
      setPacking(0);
      setDelivery(0);
      setBillDiscount(0);
      setCouponCode("");
      setCouponDiscount(0);
      setRedeemPoints(0);
    }
  }

  async function holdOrder() {
    if (!cart.length) return;
    await fetch("/api/held", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderType, cart, note: holdNote }),
    });
    setCart([]); 
    setHoldNote(""); 
    setHoldOpen(false);
    alert("Order held.");
  }

  async function openRecall() {
    const r = await fetch("/api/held");
    const d = await r.json();
    setHeld(d.items);
    setRecallOpen(true);
  }

  async function recall(h: Held) {
    const recalledCart = JSON.parse(h.cartJson);
    const processedCart = recalledCart.map((item: any) => ({
      ...item,
      isWeightBased: item.weight !== undefined && item.weight > 0,
      weight: item.weight || 0
    }));
    setCart(processedCart);
    setOrderType(h.orderType as OrderType);
    await fetch(`/api/held/${h.id}`, { method: "DELETE" });
    setRecallOpen(false);
  }

  async function deleteHeld(id: string) {
    await fetch(`/api/held/${id}`, { method: "DELETE" });
    setHeld((h) => h.filter((x) => x.id !== id));
  }

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-7rem)]">
      {/* LEFT: product catalog */}
      <div className="col-span-8 flex flex-col card overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center gap-2">
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(["WALKIN", "DELIVERY", "ONLINE"] as OrderType[]).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={clsx("px-3 py-1.5 rounded-md text-xs font-medium",
                  orderType === t ? "bg-white shadow-sm text-brand-700" : "text-slate-600")}
              >
                {t === "WALKIN" ? "Walk-in" : t === "DELIVERY" ? "Delivery" : "Online"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 pt-3 flex gap-2 overflow-x-auto pb-2">
          <button
            className={clsx("px-3 py-1.5 rounded-lg text-sm whitespace-nowrap",
              activeCat === "ALL" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700")}
            onClick={() => setActiveCat("ALL")}
          >All</button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={clsx("px-3 py-1.5 rounded-lg text-sm whitespace-nowrap",
                activeCat === c.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700")}
              onClick={() => setActiveCat(c.id)}
            >{c.icon} {c.name}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-3 content-start">
          {filtered.map((i) => {
            const isLowStock = i.stockQuantity <= i.minStock;
            const isOutOfStock = i.stockQuantity <= 0;
            const isWeightBasedItem = isWeightBased(i);
            
            return (
            <button
              key={i.id}
              onClick={() => addItem(i)}
              disabled={isOutOfStock}
              className={clsx("card p-3 text-left transition active:scale-[.99]",
                isOutOfStock ? "opacity-50 cursor-not-allowed" : "hover:border-brand-300 hover:shadow-md",
                isLowStock && !isOutOfStock ? "border-yellow-300" : "border-slate-200"
              )}
            >
              {i.imageUrl && (
                <img src={i.imageUrl} alt="" className="h-20 w-full object-cover rounded-md mb-2" />
              )}
              <div className="flex items-center gap-1 mb-1">
                <ProductIcon item={i} />
                <span className="text-[10px] uppercase tracking-wide text-slate-500">{i.category?.name}</span>
                {i.isPerishable && (
                  <span className="text-[10px] text-purple-600">🧊</span>
                )}
                {isWeightBasedItem && (
                  <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
                    <Scale size={10} />
                  </span>
                )}
              </div>
              <div className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{i.name}</div>
              <div className="text-xs text-slate-400 truncate">{i.brand || "Pick2Home"} · {i.unit}</div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <span className="text-brand-700 font-bold">
                    {isWeightBasedItem ? `${formatINR(i.price)}/kg` : formatINR(i.price)}
                  </span>
                  {i.mrp > i.price && (
                    <span className="text-xs text-slate-400 line-through ml-1">{formatINR(i.mrp)}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {isLowStock && !isOutOfStock && (
                    <span className="text-[10px] text-yellow-600">⚠️ Low</span>
                  )}
                  {isOutOfStock && (
                    <span className="text-[10px] text-red-600">Out</span>
                  )}
                  <span className="text-[10px] text-slate-400">{i.stockQuantity} {i.unit}</span>
                </div>
              </div>
              {isWeightBasedItem && (
                <div className="mt-1 text-[10px] text-blue-600">⚖️ Weight-based</div>
              )}
            
            </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-slate-400 py-12">No products match.</div>
          )}
        </div>
      </div>

      {/* RIGHT: cart */}
      <div className="col-span-4 flex flex-col card overflow-hidden">
        <div className="p-3 border-b border-slate-100 flex items-center justify-between">
          <div className="font-semibold text-slate-800 flex items-center gap-2">
            <Receipt size={16} />
            Current Order
          </div>
          <div className="flex gap-1">
            <button onClick={() => setHoldOpen(true)} className="btn btn-ghost px-2 py-1 text-xs"><Pause size={14} />Hold</button>
            <button onClick={openRecall} className="btn btn-ghost px-2 py-1 text-xs"><History size={14} />Recall</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {cart.length === 0 && <div className="text-center text-slate-400 py-12 text-sm">Cart is empty.<br />Tap products to add.</div>}
          {cart.map((l, idx) => {
            const item = items.find(i => i.id === l.menuItemId);
            const itemTotal = l.price * l.quantity;
            
            return (
              <div key={idx} className="border border-slate-100 rounded-lg p-2 text-sm">
                <div className="flex items-start justify-between">
                  <div className="font-medium text-slate-800 flex-1">{l.name}</div>
                  <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                </div>
                <div className="text-xs text-slate-400">
                  {item?.brand || "Pick2Home"} · {l.isWeightBased ? 'Weight-based' : item?.unit || ''}
                  {l.isWeightBased && l.weight && (
                    <span className="ml-1">({l.weight.toFixed(2)} kg)</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-1">
                    <button onClick={() => changeQty(idx, -1)} className="h-6 w-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Minus size={12} /></button>
                    <span className="w-7 text-center font-medium">{l.quantity}</span>
                    <button onClick={() => changeQty(idx, +1)} className="h-6 w-6 rounded-md bg-brand-100 text-brand-700 hover:bg-brand-200 flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-500 text-xs">
                      {l.isWeightBased && l.weight 
                        ? `${formatINR(l.price)} × ${l.weight.toFixed(2)}kg`
                        : `${formatINR(l.price)} × ${l.quantity}`
                      }
                    </div>
                    <div className="font-semibold">{formatINR(itemTotal)}</div>
                  </div>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Discount ₹</span>
                  <input
                    type="number" min={0}
                    value={l.discount ?? 0}
                    onChange={(e) => changeLineDiscount(idx, Number(e.target.value))}
                    className="input py-1 text-xs h-7 w-24"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {cart.length > 0 && (
          <div className="px-3 py-1 border-t border-slate-100 bg-slate-50">
            <div className="text-xs text-slate-500 flex justify-between">
              <span>Total Weight:</span>
              <span className="font-medium">{totalWeight.toFixed(2)} kg</span>
            </div>
          </div>
        )}

        {orderType === "DELIVERY" && (
          <div className="px-3 pb-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-xs" placeholder="Name" value={deliveryInfo.name} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, name: e.target.value })} />
              <input className="input text-xs" placeholder="Phone" value={deliveryInfo.phone} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })} />
            </div>
            <input className="input text-xs" placeholder="Address" value={deliveryInfo.address} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })} />
            <input className="input text-xs" placeholder="Delivery partner (optional)" value={deliveryInfo.partner} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, partner: e.target.value })} />
          </div>
        )}

        <div className="px-3 pt-2 pb-1 border-t border-slate-100 space-y-2 bg-slate-50">
          {couponCode ? (
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 text-xs">
              <span className="text-emerald-700 font-medium">Coupon <b>{couponCode}</b> applied · − {formatINR(couponDiscount)}</span>
              <button onClick={removeCoupon} className="text-emerald-700">×</button>
            </div>
          ) : (
            <div className="flex gap-1">
              <input className="input py-1 text-xs h-7 flex-1 uppercase" placeholder="Coupon code"
                value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} />
              <button onClick={applyCoupon} className="btn btn-secondary text-xs py-1 px-2">Apply</button>
            </div>
          )}
          {settings?.loyaltyEnabled && customerProfile && customerProfile.loyaltyPoints >= (settings.loyaltyMinRedeem ?? 1) && (
            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-md px-2 py-1 text-xs">
              <span className="text-violet-700">Available: <b>{customerProfile.loyaltyPoints} pts</b></span>
              <input type="number" min={0} max={customerProfile.loyaltyPoints}
                className="input py-0.5 text-xs h-6 w-20"
                placeholder="Redeem"
                value={redeemPoints || ""}
                onChange={(e) => setRedeemPoints(Math.min(customerProfile.loyaltyPoints, Math.max(0, Number(e.target.value))))} />
              <span className="text-violet-700">= {formatINR(loyaltyValue)}</span>
            </div>
          )}
        </div>
        <div className="px-3 py-2 space-y-1 text-sm bg-slate-50">
          <Line label="Subtotal" value={formatINR(computed.subtotal)} />
          {computed.itemDiscount > 0 && <Line label="Item discount" value={`− ${formatINR(computed.itemDiscount)}`} />}
          {couponDiscount > 0 && <Line label={`Coupon ${couponCode}`} value={`− ${formatINR(couponDiscount)}`} />}
          {loyaltyValue > 0 && <Line label={`Loyalty (${redeemPoints} pts)`} value={`− ${formatINR(loyaltyValue)}`} />}
          <Line label={`GST (CGST ${formatINR(computed.cgst)} + SGST ${formatINR(computed.sgst)})`} value={formatINR(computed.totalGst)} />
          <div className="grid grid-cols-2 gap-1 pt-1">
            <label className="text-xs"><span className="text-slate-500">Packing</span>
              <input type="number" className="input py-1 text-xs h-7" value={packing} min={0} onChange={(e) => setPacking(Number(e.target.value))} />
            </label>
            <label className="text-xs"><span className="text-slate-500">Bill disc ₹</span>
              <input type="number" className="input py-1 text-xs h-7" value={billDiscount} min={0} onChange={(e) => setBillDiscount(Number(e.target.value))} />
            </label>
          </div>
          {orderType === "DELIVERY" && (
            <Line label="Delivery" value={
              <input type="number" className="input py-0.5 text-xs h-6 w-24 text-right" value={delivery} min={0} onChange={(e) => setDelivery(Number(e.target.value))} />
            } />
          )}
          {computed.roundOff !== 0 && <Line label="Round off" value={formatINR(computed.roundOff)} />}
          <div className="border-t border-slate-200 mt-2 pt-2 flex items-baseline justify-between">
            <span className="font-semibold text-slate-800">Grand Total</span>
            <span className="text-xl font-bold text-brand-700">{formatINR(computed.grandTotal)}</span>
          </div>
        </div>

        <div className="p-3 border-t border-slate-100">
          <button
            disabled={!cart.length}
            onClick={() => setPayOpen(true)}
            className="btn btn-primary w-full text-base py-3"
          >
            <Save size={16} /> Save & Pay
          </button>
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Payment" size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPayOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveBill} disabled={submitting}>
              {submitting ? "Saving..." : "Confirm & Print"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <div className="label">Payment Method</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { k: "CASH", label: "Cash", icon: <Banknote size={16} /> },
                { k: "UPI", label: "UPI", icon: <Smartphone size={16} /> },
                { k: "CARD", label: "Card", icon: <CreditCard size={16} /> },
                { k: "SPLIT", label: "Split", icon: <SplitSquareHorizontal size={16} /> },
              ].map((m) => (
                <button
                  key={m.k}
                  onClick={() => setPayment({ method: m.k as any })}
                  className={clsx("border rounded-lg p-3 flex items-center gap-2 transition",
                    payment.method === m.k ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 hover:bg-slate-50")}
                >
                  {m.icon}{m.label}
                </button>
              ))}
            </div>
            {payment.method === "SPLIT" && (
              <div className="mt-3 space-y-2">
                {(["cash","upi","card"] as const).map((k) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-600 capitalize w-16">{k}</span>
                    <input
                      type="number" min={0}
                      className="input py-1 text-sm"
                      value={(payment as any)[k] ?? 0}
                      onChange={(e) => setPayment({ ...payment, [k]: Number(e.target.value) } as any)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="label mt-4">Customer (optional)</div>
            <div className="space-y-2">
              <input className="input" placeholder="Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
              <input className="input" placeholder="Mobile" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 text-sm">
            <Line label="Subtotal" value={formatINR(computed.subtotal)} />
            <Line label="Discount" value={`− ${formatINR(computed.itemDiscount + computed.billDiscount)}`} />
            <Line label="GST" value={formatINR(computed.totalGst)} />
            <Line label="Extras" value={formatINR(computed.packingCharge + computed.deliveryCharge)} />
            <Line label="Round off" value={formatINR(computed.roundOff)} />
            <div className="border-t my-2" />
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-slate-700">Payable</span>
              <span className="text-2xl font-bold text-brand-700">{formatINR(computed.grandTotal)}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Scale Reader Modal */}
      <Modal 
        open={showScaleReader} 
        onClose={() => {
          setShowScaleReader(false);
          setSelectedProductForScale(null);
        }} 
        title="⚖️ Weigh Product" 
        size="lg"
      >
        {selectedProductForScale && (
          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="text-sm text-slate-600">Product</div>
              <div className="font-semibold text-lg">{selectedProductForScale.name}</div>
              <div className="text-sm text-brand-600">Rate: {formatINR(selectedProductForScale.price)}/kg</div>
              <div className="text-sm text-slate-500">Stock: {selectedProductForScale.stockQuantity} kg</div>
            </div>
            
            <USBScaleReader 
              onWeightRead={(weight) => {
                console.log('Current weight:', weight);
              }}
              onWeightStable={handleWeightFromScale}
              productName={selectedProductForScale.name}
              autoAdd={true}
              persistentConnection={true}
              onClose={() => {
                setShowScaleReader(false);
                setSelectedProductForScale(null);
              }}
            />
            
            <div className="text-xs text-slate-400 text-center">
              💡 Scale stays connected - just place item and weight will auto-add
            </div>
          </div>
        )}
      </Modal>

      {/* Hold modal */}
      <Modal open={holdOpen} onClose={() => setHoldOpen(false)} title="Hold this order"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setHoldOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={holdOrder}>Hold</button>
          </>
        }
      >
        <label className="label">Note</label>
        <input className="input" placeholder="e.g., waiting for customer" value={holdNote} onChange={(e) => setHoldNote(e.target.value)} />
      </Modal>

      {/* Recall modal */}
      <Modal open={recallOpen} onClose={() => setRecallOpen(false)} title="Held orders" size="lg">
        <div className="space-y-2">
          {held.length === 0 && <div className="text-slate-400 text-center py-6 text-sm">No held orders.</div>}
          {held.map((h) => {
            const cartLines: CartLine[] = JSON.parse(h.cartJson);
            const qty = cartLines.reduce((s, l) => s + l.quantity, 0);
            return (
              <div key={h.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{h.note || "Untitled"} <span className="chip ml-2">{h.orderType}</span></div>
                  <div className="text-xs text-slate-500">{qty} items · by {h.createdBy.name} · {new Date(h.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => recall(h)} className="btn btn-secondary text-xs">Recall</button>
                  <button onClick={() => deleteHeld(h.id)} className="btn btn-ghost text-xs text-red-600"><X size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function Line({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}





















// "use client";
// import { useEffect, useMemo, useState } from "react";
// import { useRouter } from "next/navigation";
// import { Search, Plus, Minus, Trash2, Save, CreditCard, Banknote, Smartphone, SplitSquareHorizontal, Pause, History, Receipt, X, Package, Box, Scale } from "lucide-react";
// import { computeBill, formatINR, CartLine } from "@/lib/calc";
// import Modal from "@/components/ui/Modal";
// import USBScaleReader from "@/components/USBScaleReader";
// import clsx from "clsx";

// // Category type with icon
// type Category = { id: string; name: string; icon?: string | null };

// // GroceryItem type
// type GroceryItem = {
//   id: string;
//   name: string;
//   price: number;
//   mrp: number;
//   gstPercent: number;
//   unit: string;
//   stockQuantity: number;
//   minStock: number;
//   brand: string | null;
//   packaging: string | null;
//   isPerishable: boolean;
//   available: boolean;
//   imageUrl?: string | null;
//   categoryId: string;
//   category: Category;
//   sku: string;
//   barcode: string | null;
// };

// type Held = { 
//   id: string; 
//   note: string | null; 
//   orderType: string; 
//   cartJson: string; 
//   createdAt: string; 
//   createdBy: { name: string } 
// };

// type Payment = { 
//   method: "CASH" | "UPI" | "CARD" | "SPLIT"; 
//   cash?: number; 
//   upi?: number; 
//   card?: number 
// };

// type OrderType = "WALKIN" | "DELIVERY" | "ONLINE";

// type CartLineWithWeight = CartLine & {
//   weight?: number;
//   isWeightBased: boolean;
// };

// // Product Icon
// const ProductIcon = ({ item }: { item: GroceryItem }) => {
//   if (item.isPerishable) {
//     return <span className="text-xs text-purple-600">🧊</span>;
//   }
//   return <Package size={12} className="text-slate-400" />;
// };

// export default function GroceryPOSPage() {
//   const router = useRouter();
//   const [categories, setCategories] = useState<Category[]>([]);
//   const [items, setItems] = useState<GroceryItem[]>([]);
//   const [held, setHeld] = useState<Held[]>([]);
//   const [activeCat, setActiveCat] = useState<string>("ALL");
//   const [search, setSearch] = useState("");
//   const [orderType, setOrderType] = useState<OrderType>("WALKIN");
//   const [cart, setCart] = useState<CartLineWithWeight[]>([]);
//   const [billDiscount, setBillDiscount] = useState<number>(0);
//   const [billDiscountPercent, setBillDiscountPercent] = useState<number>(0);
//   const [packing, setPacking] = useState<number>(0);
//   const [delivery, setDelivery] = useState<number>(0);
//   const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "" });
//   const [customerProfile, setCustomerProfile] = useState<{ loyaltyPoints: number } | null>(null);
//   const [couponInput, setCouponInput] = useState("");
//   const [couponCode, setCouponCode] = useState("");
//   const [couponDiscount, setCouponDiscount] = useState(0);
//   const [redeemPoints, setRedeemPoints] = useState(0);
//   const [settings, setSettings] = useState<{ loyaltyEnabled: boolean; loyaltyRedeemValue: number; loyaltyMinRedeem: number } | null>(null);
//   const [deliveryInfo, setDeliveryInfo] = useState({ name: "", phone: "", address: "", partner: "" });
//   const [payment, setPayment] = useState<Payment>({ method: "CASH" });
//   const [payOpen, setPayOpen] = useState(false);
//   const [holdOpen, setHoldOpen] = useState(false);
//   const [holdNote, setHoldNote] = useState("");
//   const [recallOpen, setRecallOpen] = useState(false);
//   const [submitting, setSubmitting] = useState(false);
  
//   // Scale related states
//   const [showScaleReader, setShowScaleReader] = useState(false);
//   const [selectedProductForScale, setSelectedProductForScale] = useState<GroceryItem | null>(null);

//   useEffect(() => {
//     fetch("/api/categories").then((r) => r.json()).then((d) => setCategories(d.categories));
//     fetch("/api/menu").then((r) => r.json()).then((d) => setItems(d.items));
//     fetch("/api/settings").then((r) => r.json()).then((d) => setSettings(d.settings));
//   }, []);

//   // Lookup customer when phone changes
//   useEffect(() => {
//     const phone = customer.phone.trim();
//     if (phone.length < 8) { setCustomerProfile(null); return; }
//     const t = setTimeout(async () => {
//       const r = await fetch(`/api/customers?q=${encodeURIComponent(phone)}`);
//       const d = await r.json();
//       const match = (d.customers ?? []).find((c: any) => c.phone === phone);
//       setCustomerProfile(match ? { loyaltyPoints: match.loyaltyPoints ?? 0 } : null);
//     }, 300);
//     return () => clearTimeout(t);
//   }, [customer.phone]);

//   async function applyCoupon() {
//     if (!couponInput.trim()) return;
//     const subtotal = cart.reduce((s, l) => s + l.price * l.quantity - (l.discount ?? 0), 0);
//     const r = await fetch("/api/coupons/validate", {
//       method: "POST", headers: { "content-type": "application/json" },
//       body: JSON.stringify({ code: couponInput.trim().toUpperCase(), subtotal }),
//     });
//     const d = await r.json();
//     if (!r.ok) { alert(d.error || "Invalid coupon"); return; }
//     setCouponCode(d.coupon.code);
//     setCouponDiscount(d.discount);
//   }
//   function removeCoupon() { setCouponCode(""); setCouponDiscount(0); setCouponInput(""); }

//   const filtered = useMemo(() => {
//     return items.filter((i) => {
//       if (!i.available) return false;
//       if (activeCat !== "ALL" && i.categoryId !== activeCat) return false;
//       if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
//       return true;
//     });
//   }, [items, activeCat, search]);

//   // Check if item is weight-based (unit is kg or gm)
//   function isWeightBased(item: GroceryItem): boolean {
//     return item.unit === "kg" || item.unit === "gm";
//   }

//   // Add item to cart - shows scale reader for weight-based items
//   function addItem(i: GroceryItem) {
//     if (i.stockQuantity <= 0) {
//       alert(`${i.name} is out of stock!`);
//       return;
//     }

//     const isWeightBasedItem = isWeightBased(i);
    
//     if (isWeightBasedItem) {
//       setSelectedProductForScale(i);
//       setShowScaleReader(true);
//     } else {
//       // For non-weight items, add normally
//       setCart((c) => {
//         const idx = c.findIndex((l) => l.menuItemId === i.id);
//         if (idx >= 0) {
//           const copy = [...c];
//           if (copy[idx].quantity + 1 > i.stockQuantity) {
//             alert(`Only ${i.stockQuantity} ${i.unit} available in stock`);
//             return copy;
//           }
//           copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
//           return copy;
//         }
//         return [...c, { 
//           menuItemId: i.id, 
//           name: i.name, 
//           price: i.price, 
//           gstPercent: i.gstPercent, 
//           quantity: 1, 
//           discount: 0,
//           isWeightBased: false
//         }];
//       });
//     }
//   }

//   // Handle weight from scale - auto-adds to cart
//   function handleWeightFromScale(weight: number) {
//     if (!selectedProductForScale) return;
    
//     const product = selectedProductForScale;
//     if (weight <= 0) {
//       setShowScaleReader(false);
//       setSelectedProductForScale(null);
//       return;
//     }
    
//     if (weight > product.stockQuantity) {
//       alert(`Only ${product.stockQuantity} kg available in stock`);
//       setShowScaleReader(false);
//       setSelectedProductForScale(null);
//       return;
//     }

//     setCart((prevCart) => {
//       const existingIndex = prevCart.findIndex((item) => item.menuItemId === product.id);
      
//       if (existingIndex >= 0) {
//         const updatedCart = [...prevCart];
//         const existing = updatedCart[existingIndex];
//         const newWeight = (existing.weight || 0) + weight;
        
//         updatedCart[existingIndex] = {
//           ...existing,
//           weight: newWeight,
//           quantity: newWeight,
//           price: product.price,
//           isWeightBased: true
//         };
//         return updatedCart;
//       } else {
//         const newItem = {
//           menuItemId: product.id,
//           name: product.name,
//           price: product.price,
//           gstPercent: product.gstPercent,
//           quantity: weight,
//           discount: 0,
//           weight: weight,
//           isWeightBased: true
//         };
//         return [...prevCart, newItem];
//       }
//     });

//     setShowScaleReader(false);
//     setSelectedProductForScale(null);
//   }

//   function changeQty(idx: number, delta: number) {
//     setCart((c) => {
//       const copy = [...c];
//       const item = items.find(i => i.id === copy[idx].menuItemId);
//       const newQty = copy[idx].quantity + delta;
      
//       if (item && newQty > item.stockQuantity) {
//         alert(`Only ${item.stockQuantity} ${item.unit} available in stock`);
//         return copy;
//       }
      
//       copy[idx] = { ...copy[idx], quantity: newQty };
      
//       if (copy[idx].isWeightBased) {
//         copy[idx].weight = newQty;
//       }
      
//       if (copy[idx].quantity <= 0) copy.splice(idx, 1);
//       return copy;
//     });
//   }

//   function removeLine(idx: number) { 
//     setCart((c) => c.filter((_, i) => i !== idx)); 
//   }

//   function changeLineDiscount(idx: number, value: number) {
//     setCart((c) => c.map((l, i) => i === idx ? { ...l, discount: value } : l));
//   }

//   const totalWeight = useMemo(() => {
//     return cart.reduce((sum, item) => sum + (item.weight || item.quantity), 0);
//   }, [cart]);

//   const loyaltyValue = useMemo(() => {
//     if (!settings?.loyaltyEnabled || !redeemPoints) return 0;
//     return redeemPoints * settings.loyaltyRedeemValue;
//   }, [settings, redeemPoints]);

//   const computed = useMemo(() => computeBill(cart, {
//     packingCharge: packing,
//     serviceCharge: 0,
//     deliveryCharge: orderType === "DELIVERY" ? delivery : 0,
//     billDiscount,
//     billDiscountPercent,
//     couponDiscount,
//     loyaltyRedeemValue: loyaltyValue,
//   }), [cart, packing, delivery, orderType, billDiscount, billDiscountPercent, couponDiscount, loyaltyValue]);

//   async function saveBill() {
//     if (!cart.length) {
//       alert("Cart is empty!");
//       return;
//     }
    
//     if (payment.method === "SPLIT") {
//       const sum = (payment.cash ?? 0) + (payment.upi ?? 0) + (payment.card ?? 0);
//       if (Math.abs(sum - computed.grandTotal) > 0.5) {
//         alert(`Split total ${formatINR(sum)} must equal grand total ${formatINR(computed.grandTotal)}`);
//         return;
//       }
//     }
    
//     setSubmitting(true);
//     try {
//       const r = await fetch("/api/bills", {
//         method: "POST",
//         headers: { "content-type": "application/json" },
//         body: JSON.stringify({
//           orderType,
//           source: "POS",
//           customer: customer.phone && customer.name ? customer : undefined,
//           cart: cart.map(item => ({
//             ...item,
//             quantity: item.weight || item.quantity
//           })),
//           extras: {
//             packingCharge: packing,
//             serviceCharge: 0,
//             deliveryCharge: orderType === "DELIVERY" ? delivery : 0,
//             billDiscount,
//             billDiscountPercent,
//           },
//           couponCode: couponCode || undefined,
//           redeemPoints: redeemPoints || undefined,
//           payment,
//           delivery: orderType === "DELIVERY" ? deliveryInfo : undefined,
//         }),
//       });
      
//       const json = await r.json();
//       if (!r.ok) throw new Error(json.error || "Failed");
      
//       const printWindow = window.open(`/bills/${json.bill.id}?print=1`, '_blank');
//       if (printWindow) {
//         printWindow.onload = function() {
//           setTimeout(() => {
//             printWindow.print();
//           }, 500);
//         };
//       }
      
//       router.push(`/bills/${json.bill.id}`);
//     } catch (e: any) {
//       alert(e.message);
//     } finally {
//       setSubmitting(false);
//       setCart([]);
//       setCustomer({ name: "", phone: "", email: "", address: "" });
//       setDeliveryInfo({ name: "", phone: "", address: "", partner: "" });
//       setPayment({ method: "CASH" });
//       setPacking(0);
//       setDelivery(0);
//       setBillDiscount(0);
//       setCouponCode("");
//       setCouponDiscount(0);
//       setRedeemPoints(0);
//     }
//   }

//   async function holdOrder() {
//     if (!cart.length) return;
//     await fetch("/api/held", {
//       method: "POST",
//       headers: { "content-type": "application/json" },
//       body: JSON.stringify({ orderType, cart, note: holdNote }),
//     });
//     setCart([]); 
//     setHoldNote(""); 
//     setHoldOpen(false);
//     alert("Order held.");
//   }

//   async function openRecall() {
//     const r = await fetch("/api/held");
//     const d = await r.json();
//     setHeld(d.items);
//     setRecallOpen(true);
//   }

//   async function recall(h: Held) {
//     const recalledCart = JSON.parse(h.cartJson);
//     const processedCart = recalledCart.map((item: any) => ({
//       ...item,
//       isWeightBased: item.weight !== undefined && item.weight > 0,
//       weight: item.weight || 0
//     }));
//     setCart(processedCart);
//     setOrderType(h.orderType as OrderType);
//     await fetch(`/api/held/${h.id}`, { method: "DELETE" });
//     setRecallOpen(false);
//   }

//   async function deleteHeld(id: string) {
//     await fetch(`/api/held/${id}`, { method: "DELETE" });
//     setHeld((h) => h.filter((x) => x.id !== id));
//   }

//   return (
//     <div className="grid grid-cols-12 gap-4 h-[calc(100vh-7rem)]">
//       {/* LEFT: product catalog */}
//       <div className="col-span-8 flex flex-col card overflow-hidden">
//         <div className="p-3 border-b border-slate-100 flex items-center gap-2">
//           <div className="flex-1 relative">
//             <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
//             <input
//               className="input pl-9"
//               placeholder="Search products..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//             />
//           </div>
//           <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
//             {(["WALKIN", "DELIVERY", "ONLINE"] as OrderType[]).map((t) => (
//               <button
//                 key={t}
//                 onClick={() => setOrderType(t)}
//                 className={clsx("px-3 py-1.5 rounded-md text-xs font-medium",
//                   orderType === t ? "bg-white shadow-sm text-brand-700" : "text-slate-600")}
//               >
//                 {t === "WALKIN" ? "Walk-in" : t === "DELIVERY" ? "Delivery" : "Online"}
//               </button>
//             ))}
//           </div>
//         </div>

//         <div className="px-3 pt-3 flex gap-2 overflow-x-auto pb-2">
//           <button
//             className={clsx("px-3 py-1.5 rounded-lg text-sm whitespace-nowrap",
//               activeCat === "ALL" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700")}
//             onClick={() => setActiveCat("ALL")}
//           >All</button>
//           {categories.map((c) => (
//             <button
//               key={c.id}
//               className={clsx("px-3 py-1.5 rounded-lg text-sm whitespace-nowrap",
//                 activeCat === c.id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700")}
//               onClick={() => setActiveCat(c.id)}
//             >{c.icon} {c.name}</button>
//           ))}
//         </div>

//         <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 content-start">
//           {filtered.map((i) => {
//             const isLowStock = i.stockQuantity <= i.minStock;
//             const isOutOfStock = i.stockQuantity <= 0;
//             const isWeightBasedItem = isWeightBased(i);
            
//             return (
//               <button
//                 key={i.id}
//                 onClick={() => addItem(i)}
//                 disabled={isOutOfStock}
//                 className={clsx("card p-3 text-left transition active:scale-[.99]",
//                   isOutOfStock ? "opacity-50 cursor-not-allowed" : "hover:border-brand-300 hover:shadow-md",
//                   isLowStock && !isOutOfStock ? "border-yellow-300" : "border-slate-200"
//                 )}
//               >
//                 {i.imageUrl && (
//                   <img src={i.imageUrl} alt="" className="h-20 w-full object-cover rounded-md mb-2" />
//                 )}
//                 <div className="flex items-center gap-1 mb-1">
//                   <ProductIcon item={i} />
//                   <span className="text-[10px] uppercase tracking-wide text-slate-500">{i.category?.name}</span>
//                   {i.isPerishable && (
//                     <span className="text-[10px] text-purple-600">🧊</span>
//                   )}
//                   {isWeightBasedItem && (
//                     <span className="text-[10px] text-blue-600 flex items-center gap-0.5">
//                       <Scale size={10} />
//                     </span>
//                   )}
//                 </div>
//                 <div className="font-semibold text-slate-800 text-sm leading-tight line-clamp-2">{i.name}</div>
//                 <div className="text-xs text-slate-400 truncate">{i.brand || "Pick2Home"} · {i.unit}</div>
//                 <div className="mt-2 flex items-end justify-between">
//                   <div>
//                     <span className="text-brand-700 font-bold">
//                       {isWeightBasedItem ? `${formatINR(i.price)}/kg` : formatINR(i.price)}
//                     </span>
//                     {i.mrp > i.price && (
//                       <span className="text-xs text-slate-400 line-through ml-1">{formatINR(i.mrp)}</span>
//                     )}
//                   </div>
//                   <div className="flex items-center gap-1">
//                     {isLowStock && !isOutOfStock && (
//                       <span className="text-[10px] text-yellow-600">⚠️ Low</span>
//                     )}
//                     {isOutOfStock && (
//                       <span className="text-[10px] text-red-600">Out</span>
//                     )}
//                     <span className="text-[10px] text-slate-400">{i.stockQuantity} {i.unit}</span>
//                   </div>
//                 </div>
//                 {isWeightBasedItem && (
//                   <div className="mt-1 text-[10px] text-blue-600">⚖️ Weight-based</div>
//                 )}
//                 {i.discountPercent > 0 && (
//                   <div className="mt-1 text-xs text-red-600">{i.discountPercent}% OFF</div>
//                 )}
//               </button>
//             );
//           })}
//           {filtered.length === 0 && (
//             <div className="col-span-full text-center text-slate-400 py-12">No products match.</div>
//           )}
//         </div>
//       </div>

//       {/* RIGHT: cart */}
//       <div className="col-span-4 flex flex-col card overflow-hidden">
//         <div className="p-3 border-b border-slate-100 flex items-center justify-between">
//           <div className="font-semibold text-slate-800 flex items-center gap-2">
//             <Receipt size={16} />
//             Current Order
//           </div>
//           <div className="flex gap-1">
//             <button onClick={() => setHoldOpen(true)} className="btn btn-ghost px-2 py-1 text-xs"><Pause size={14} />Hold</button>
//             <button onClick={openRecall} className="btn btn-ghost px-2 py-1 text-xs"><History size={14} />Recall</button>
//           </div>
//         </div>

//         <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
//           {cart.length === 0 && <div className="text-center text-slate-400 py-12 text-sm">Cart is empty.<br />Tap products to add.</div>}
//           {cart.map((l, idx) => {
//             const item = items.find(i => i.id === l.menuItemId);
//             const itemTotal = l.price * l.quantity;
            
//             return (
//               <div key={idx} className="border border-slate-100 rounded-lg p-2 text-sm">
//                 <div className="flex items-start justify-between">
//                   <div className="font-medium text-slate-800 flex-1">{l.name}</div>
//                   <button onClick={() => removeLine(idx)} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
//                 </div>
//                 <div className="text-xs text-slate-400">
//                   {item?.brand || "Pick2Home"} · {l.isWeightBased ? 'Weight-based' : item?.unit || ''}
//                   {l.isWeightBased && l.weight && (
//                     <span className="ml-1">({l.weight.toFixed(2)} kg)</span>
//                   )}
//                 </div>
//                 <div className="flex items-center justify-between mt-1">
//                   <div className="flex items-center gap-1">
//                     <button onClick={() => changeQty(idx, -1)} className="h-6 w-6 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center"><Minus size={12} /></button>
//                     <span className="w-7 text-center font-medium">{l.quantity}</span>
//                     <button onClick={() => changeQty(idx, +1)} className="h-6 w-6 rounded-md bg-brand-100 text-brand-700 hover:bg-brand-200 flex items-center justify-center"><Plus size={12} /></button>
//                   </div>
//                   <div className="text-right">
//                     <div className="text-slate-500 text-xs">
//                       {l.isWeightBased && l.weight 
//                         ? `${formatINR(l.price)} × ${l.weight.toFixed(2)}kg`
//                         : `${formatINR(l.price)} × ${l.quantity}`
//                       }
//                     </div>
//                     <div className="font-semibold">{formatINR(itemTotal)}</div>
//                   </div>
//                 </div>
//                 <div className="mt-1 flex items-center gap-2">
//                   <span className="text-xs text-slate-500">Discount ₹</span>
//                   <input
//                     type="number" min={0}
//                     value={l.discount ?? 0}
//                     onChange={(e) => changeLineDiscount(idx, Number(e.target.value))}
//                     className="input py-1 text-xs h-7 w-24"
//                   />
//                 </div>
//               </div>
//             );
//           })}
//         </div>

//         {cart.length > 0 && (
//           <div className="px-3 py-1 border-t border-slate-100 bg-slate-50">
//             <div className="text-xs text-slate-500 flex justify-between">
//               <span>Total Weight:</span>
//               <span className="font-medium">{totalWeight.toFixed(2)} kg</span>
//             </div>
//           </div>
//         )}

//         {orderType === "DELIVERY" && (
//           <div className="px-3 pb-2 space-y-2">
//             <div className="grid grid-cols-2 gap-2">
//               <input className="input text-xs" placeholder="Name" value={deliveryInfo.name} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, name: e.target.value })} />
//               <input className="input text-xs" placeholder="Phone" value={deliveryInfo.phone} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, phone: e.target.value })} />
//             </div>
//             <input className="input text-xs" placeholder="Address" value={deliveryInfo.address} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, address: e.target.value })} />
//             <input className="input text-xs" placeholder="Delivery partner (optional)" value={deliveryInfo.partner} onChange={(e) => setDeliveryInfo({ ...deliveryInfo, partner: e.target.value })} />
//           </div>
//         )}

//         <div className="px-3 pt-2 pb-1 border-t border-slate-100 space-y-2 bg-slate-50">
//           {couponCode ? (
//             <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 text-xs">
//               <span className="text-emerald-700 font-medium">Coupon <b>{couponCode}</b> applied · − {formatINR(couponDiscount)}</span>
//               <button onClick={removeCoupon} className="text-emerald-700">×</button>
//             </div>
//           ) : (
//             <div className="flex gap-1">
//               <input className="input py-1 text-xs h-7 flex-1 uppercase" placeholder="Coupon code"
//                 value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} />
//               <button onClick={applyCoupon} className="btn btn-secondary text-xs py-1 px-2">Apply</button>
//             </div>
//           )}
//           {settings?.loyaltyEnabled && customerProfile && customerProfile.loyaltyPoints >= (settings.loyaltyMinRedeem ?? 1) && (
//             <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-md px-2 py-1 text-xs">
//               <span className="text-violet-700">Available: <b>{customerProfile.loyaltyPoints} pts</b></span>
//               <input type="number" min={0} max={customerProfile.loyaltyPoints}
//                 className="input py-0.5 text-xs h-6 w-20"
//                 placeholder="Redeem"
//                 value={redeemPoints || ""}
//                 onChange={(e) => setRedeemPoints(Math.min(customerProfile.loyaltyPoints, Math.max(0, Number(e.target.value))))} />
//               <span className="text-violet-700">= {formatINR(loyaltyValue)}</span>
//             </div>
//           )}
//         </div>
//         <div className="px-3 py-2 space-y-1 text-sm bg-slate-50">
//           <Line label="Subtotal" value={formatINR(computed.subtotal)} />
//           {computed.itemDiscount > 0 && <Line label="Item discount" value={`− ${formatINR(computed.itemDiscount)}`} />}
//           {couponDiscount > 0 && <Line label={`Coupon ${couponCode}`} value={`− ${formatINR(couponDiscount)}`} />}
//           {loyaltyValue > 0 && <Line label={`Loyalty (${redeemPoints} pts)`} value={`− ${formatINR(loyaltyValue)}`} />}
//           <Line label={`GST (CGST ${formatINR(computed.cgst)} + SGST ${formatINR(computed.sgst)})`} value={formatINR(computed.totalGst)} />
//           <div className="grid grid-cols-2 gap-1 pt-1">
//             <label className="text-xs"><span className="text-slate-500">Packing</span>
//               <input type="number" className="input py-1 text-xs h-7" value={packing} min={0} onChange={(e) => setPacking(Number(e.target.value))} />
//             </label>
//             <label className="text-xs"><span className="text-slate-500">Bill disc ₹</span>
//               <input type="number" className="input py-1 text-xs h-7" value={billDiscount} min={0} onChange={(e) => setBillDiscount(Number(e.target.value))} />
//             </label>
//           </div>
//           {orderType === "DELIVERY" && (
//             <Line label="Delivery" value={
//               <input type="number" className="input py-0.5 text-xs h-6 w-24 text-right" value={delivery} min={0} onChange={(e) => setDelivery(Number(e.target.value))} />
//             } />
//           )}
//           {computed.roundOff !== 0 && <Line label="Round off" value={formatINR(computed.roundOff)} />}
//           <div className="border-t border-slate-200 mt-2 pt-2 flex items-baseline justify-between">
//             <span className="font-semibold text-slate-800">Grand Total</span>
//             <span className="text-xl font-bold text-brand-700">{formatINR(computed.grandTotal)}</span>
//           </div>
//         </div>

//         <div className="p-3 border-t border-slate-100">
//           <button
//             disabled={!cart.length}
//             onClick={() => setPayOpen(true)}
//             className="btn btn-primary w-full text-base py-3"
//           >
//             <Save size={16} /> Save & Pay
//           </button>
//         </div>
//       </div>

//       {/* Payment modal */}
//       <Modal open={payOpen} onClose={() => setPayOpen(false)} title="Payment" size="lg"
//         footer={
//           <>
//             <button className="btn btn-secondary" onClick={() => setPayOpen(false)}>Cancel</button>
//             <button className="btn btn-primary" onClick={saveBill} disabled={submitting}>
//               {submitting ? "Saving..." : "Confirm & Print"}
//             </button>
//           </>
//         }
//       >
//         <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
//           <div>
//             <div className="label">Payment Method</div>
//             <div className="grid grid-cols-2 gap-2">
//               {[
//                 { k: "CASH", label: "Cash", icon: <Banknote size={16} /> },
//                 { k: "UPI", label: "UPI", icon: <Smartphone size={16} /> },
//                 { k: "CARD", label: "Card", icon: <CreditCard size={16} /> },
//                 { k: "SPLIT", label: "Split", icon: <SplitSquareHorizontal size={16} /> },
//               ].map((m) => (
//                 <button
//                   key={m.k}
//                   onClick={() => setPayment({ method: m.k as any })}
//                   className={clsx("border rounded-lg p-3 flex items-center gap-2 transition",
//                     payment.method === m.k ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 hover:bg-slate-50")}
//                 >
//                   {m.icon}{m.label}
//                 </button>
//               ))}
//             </div>
//             {payment.method === "SPLIT" && (
//               <div className="mt-3 space-y-2">
//                 {(["cash","upi","card"] as const).map((k) => (
//                   <div key={k} className="flex items-center justify-between gap-2">
//                     <span className="text-sm text-slate-600 capitalize w-16">{k}</span>
//                     <input
//                       type="number" min={0}
//                       className="input py-1 text-sm"
//                       value={(payment as any)[k] ?? 0}
//                       onChange={(e) => setPayment({ ...payment, [k]: Number(e.target.value) } as any)}
//                     />
//                   </div>
//                 ))}
//               </div>
//             )}

//             <div className="label mt-4">Customer (optional)</div>
//             <div className="space-y-2">
//               <input className="input" placeholder="Name" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
//               <input className="input" placeholder="Mobile" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
//             </div>
//           </div>

//           <div className="bg-slate-50 rounded-lg p-4 text-sm">
//             <Line label="Subtotal" value={formatINR(computed.subtotal)} />
//             <Line label="Discount" value={`− ${formatINR(computed.itemDiscount + computed.billDiscount)}`} />
//             <Line label="GST" value={formatINR(computed.totalGst)} />
//             <Line label="Extras" value={formatINR(computed.packingCharge + computed.deliveryCharge)} />
//             <Line label="Round off" value={formatINR(computed.roundOff)} />
//             <div className="border-t my-2" />
//             <div className="flex items-baseline justify-between">
//               <span className="font-semibold text-slate-700">Payable</span>
//               <span className="text-2xl font-bold text-brand-700">{formatINR(computed.grandTotal)}</span>
//             </div>
//           </div>
//         </div>
//       </Modal>

//       {/* Scale Reader Modal - No Ref */}
//       <Modal 
//         open={showScaleReader} 
//         onClose={() => {
//           setShowScaleReader(false);
//           setSelectedProductForScale(null);
//         }} 
//         title="⚖️ Weigh Product" 
//         size="lg"
//       >
//         {selectedProductForScale && (
//           <div className="space-y-4">
//             <div className="bg-slate-50 p-4 rounded-lg">
//               <div className="text-sm text-slate-600">Product</div>
//               <div className="font-semibold text-lg">{selectedProductForScale.name}</div>
//               <div className="text-sm text-brand-600">Rate: {formatINR(selectedProductForScale.price)}/kg</div>
//               <div className="text-sm text-slate-500">Stock: {selectedProductForScale.stockQuantity} kg</div>
//             </div>
            
//             <USBScaleReader 
//               onWeightRead={(weight) => {
//                 console.log('Current weight:', weight);
//               }}
//               onWeightStable={handleWeightFromScale}
//               productName={selectedProductForScale.name}
//               autoAdd={true}
//               persistentConnection={true}
//               onClose={() => {
//                 setShowScaleReader(false);
//                 setSelectedProductForScale(null);
//               }}
//             />
            
//             <div className="text-xs text-slate-400 text-center">
//               💡 Scale stays connected - just place item and weight will auto-add
//             </div>
//           </div>
//         )}
//       </Modal>

//       {/* Hold modal */}
//       <Modal open={holdOpen} onClose={() => setHoldOpen(false)} title="Hold this order"
//         footer={
//           <>
//             <button className="btn btn-secondary" onClick={() => setHoldOpen(false)}>Cancel</button>
//             <button className="btn btn-primary" onClick={holdOrder}>Hold</button>
//           </>
//         }
//       >
//         <label className="label">Note</label>
//         <input className="input" placeholder="e.g., waiting for customer" value={holdNote} onChange={(e) => setHoldNote(e.target.value)} />
//       </Modal>

//       {/* Recall modal */}
//       <Modal open={recallOpen} onClose={() => setRecallOpen(false)} title="Held orders" size="lg">
//         <div className="space-y-2">
//           {held.length === 0 && <div className="text-slate-400 text-center py-6 text-sm">No held orders.</div>}
//           {held.map((h) => {
//             const cartLines: CartLine[] = JSON.parse(h.cartJson);
//             const qty = cartLines.reduce((s, l) => s + l.quantity, 0);
//             return (
//               <div key={h.id} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between">
//                 <div>
//                   <div className="font-medium">{h.note || "Untitled"} <span className="chip ml-2">{h.orderType}</span></div>
//                   <div className="text-xs text-slate-500">{qty} items · by {h.createdBy.name} · {new Date(h.createdAt).toLocaleString()}</div>
//                 </div>
//                 <div className="flex gap-1">
//                   <button onClick={() => recall(h)} className="btn btn-secondary text-xs">Recall</button>
//                   <button onClick={() => deleteHeld(h.id)} className="btn btn-ghost text-xs text-red-600"><X size={14} /></button>
//                 </div>
//               </div>
//             );
//           })}
//         </div>
//       </Modal>
//     </div>
//   );
// }

// function Line({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
//   return (
//     <div className="flex items-baseline justify-between text-sm">
//       <span className="text-slate-600">{label}</span>
//       <span className="font-medium">{value}</span>
//     </div>
//   );
// }











