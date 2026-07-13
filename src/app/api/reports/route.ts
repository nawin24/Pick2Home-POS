import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Returns aggregated metrics for the dashboard + Reports module.
// Accepts ?from=ISO&to=ISO. Defaults: today.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER"]);
  if (!auth.ok) return auth.response;
  
  const url = new URL(req.url);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
  const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : startOfToday;
  const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : tomorrow;

  const where = { createdAt: { gte: from, lt: to } };

  // CHANGED: Removed kotStatus references, added orderStatus
  const [bills, expenses, pendingOrders, completedOrders] = await Promise.all([
    prisma.bill.findMany({
      where: { ...where, status: "PAID" },
      include: { 
        order: { 
          include: { 
            items: {
              include: {
                groceryItem: true // CHANGED: Include groceryItem
              }
            } 
          } 
        }, 
        cashier: { select: { id: true, name: true } } 
      },
    }),
    prisma.expense.findMany({
      where: { date: { gte: from, lt: to } },
    }),
    prisma.order.count({ 
      where: { orderStatus: { in: ["PENDING", "PROCESSING"] } } // CHANGED: kotStatus → orderStatus
    }),
    prisma.order.count({ 
      where: { orderStatus: { in: ["READY", "COMPLETED"] } } // CHANGED: kotStatus → orderStatus
    }),
  ]);

  const grossSales = bills.reduce((s, b) => s + b.grandTotal, 0);
  const totalGst = bills.reduce((s, b) => s + b.totalGst, 0);
  const totalDiscount = bills.reduce((s, b) => s + b.itemDiscount + b.billDiscount, 0);
  const netSales = grossSales - totalGst;
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const profit = netSales - totalExpenses;

  const cash = bills.reduce((s, b) => s + b.paymentCash, 0);
  const upi = bills.reduce((s, b) => s + b.paymentUpi, 0);
  const card = bills.reduce((s, b) => s + b.paymentCard, 0);

  // CHANGED: Item-wise sales - groceryItemId instead of menuItemId
  const itemMap = new Map<string, { 
    name: string; 
    sku: string; 
    unit: string; 
    qty: number; 
    total: number;
    avgPrice: number;
  }>();
  
  for (const b of bills) {
    for (const it of b.order.items) {
      const k = it.groceryItemId;
      const cur = itemMap.get(k) ?? { 
        name: it.name, 
        sku: it.groceryItem?.sku || "", 
        unit: it.groceryItem?.unit || "pcs",
        qty: 0, 
        total: 0,
        avgPrice: 0
      };
      cur.qty += it.quantity;
      cur.total += it.price * it.quantity;
      cur.avgPrice = cur.total / cur.qty;
      itemMap.set(k, cur);
    }
  }
  const topItems = [...itemMap.values()]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  // CHANGED: Cashier-wise (same)
  const cashierMap = new Map<string, { name: string; total: number; count: number }>();
  for (const b of bills) {
    const k = b.cashier.id;
    const cur = cashierMap.get(k) ?? { name: b.cashier.name, total: 0, count: 0 };
    cur.total += b.grandTotal;
    cur.count += 1;
    cashierMap.set(k, cur);
  }

  // Day buckets (for charts) — keyed YYYY-MM-DD.
  const dayMap = new Map<string, number>();
  for (const b of bills) {
    const d = b.createdAt.toISOString().slice(0, 10);
    dayMap.set(d, (dayMap.get(d) ?? 0) + b.grandTotal);
  }
  const dailySales = [...dayMap.entries()].sort().map(([day, total]) => ({ day, total }));

  // Source-wise sales (POS, WEBSITE, APP, PHONE, etc.)
  const sourceMap = new Map<string, { source: string; total: number; count: number }>();
  for (const b of bills) {
    const k = b.order.source ?? "POS";
    const cur = sourceMap.get(k) ?? { source: k, total: 0, count: 0 };
    cur.total += b.grandTotal;
    cur.count += 1;
    sourceMap.set(k, cur);
  }

  // NEW: Low stock items count for dashboard alert
  const lowStockItems = await prisma.groceryItem.count({
    where: {
      stockQuantity: {
        lte: prisma.groceryItem.fields.minStock,
      },
      available: true,
    },
  });

  // NEW: Out of stock items count
  const outOfStockItems = await prisma.groceryItem.count({
    where: {
      stockQuantity: 0,
      available: true,
    },
  });

  // NEW: Total product count
  const totalProducts = await prisma.groceryItem.count({
    where: { available: true },
  });

  // NEW: Supplier count
  const totalSuppliers = await prisma.supplier.count({
    where: { active: true },
  });

  // NEW: Average order value
  const avgOrderValue = bills.length > 0 ? grossSales / bills.length : 0;

  // NEW: Perishable items nearing expiry (if expiryDate exists)
  const today = new Date();
  const sevenDaysLater = new Date(today);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  
  const expiringItems = await prisma.groceryItem.count({
    where: {
      isPerishable: true,
      expiryDate: {
        lte: sevenDaysLater,
        gte: today,
      },
    },
  });

  // NEW: Inventory value
  const inventoryItems = await prisma.groceryItem.findMany({
    select: {
      price: true,
      stockQuantity: true,
    },
  });
  const inventoryValue = inventoryItems.reduce(
    (sum, item) => sum + (item.price * item.stockQuantity),
    0
  );

  return NextResponse.json({
    range: { from, to },
    summary: {
      billCount: bills.length,
      grossSales,
      netSales,
      totalGst,
      totalDiscount,
      totalExpenses,
      profit,
      avgOrderValue,
    },
    payments: { cash, upi, card },
    orders: { 
      pending: pendingOrders, 
      completed: completedOrders 
    }, // CHANGED: kot → orders
    topItems,
    cashiers: [...cashierMap.values()].sort((a, b) => b.total - a.total),
    sources: [...sourceMap.values()].sort((a, b) => b.total - a.total),
    dailySales,
    recentBills: bills.slice(0, 10),
    // NEW: Grocery store specific metrics
    inventory: {
      totalProducts,
      lowStockItems,
      outOfStockItems,
      inventoryValue,
      expiringItems,
      totalSuppliers,
    },
  });
}

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";

// // Returns aggregated metrics for the dashboard + Reports module.
// // Accepts ?from=ISO&to=ISO. Defaults: today.
// export async function GET(req: NextRequest) {
//   const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER"]);
//   if (!auth.ok) return auth.response;
//   const url = new URL(req.url);
//   const now = new Date();
//   const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
//   const tomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);
//   const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : startOfToday;
//   const to = url.searchParams.get("to") ? new Date(url.searchParams.get("to")!) : tomorrow;

//   const where = { createdAt: { gte: from, lt: to } };

//   const [bills, expenses, kotPending, kotCompleted] = await Promise.all([
//     prisma.bill.findMany({
//       where: { ...where, status: "PAID" },
//       include: { order: { include: { items: true } }, cashier: { select: { id: true, name: true } } },
//     }),
//     prisma.expense.findMany({
//       where: { date: { gte: from, lt: to } },
//     }),
//     prisma.order.count({ where: { kotStatus: { in: ["NEW", "PREPARING"] } } }),
//     prisma.order.count({ where: { kotStatus: { in: ["READY", "SERVED"] } } }),
//   ]);

//   const grossSales = bills.reduce((s, b) => s + b.grandTotal, 0);
//   const totalGst = bills.reduce((s, b) => s + b.totalGst, 0);
//   const totalDiscount = bills.reduce((s, b) => s + b.itemDiscount + b.billDiscount, 0);
//   const netSales = grossSales - totalGst;
//   const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
//   const profit = netSales - totalExpenses;

//   const cash = bills.reduce((s, b) => s + b.paymentCash, 0);
//   const upi = bills.reduce((s, b) => s + b.paymentUpi, 0);
//   const card = bills.reduce((s, b) => s + b.paymentCard, 0);

//   // Item-wise sales.
//   const itemMap = new Map<string, { name: string; qty: number; total: number }>();
//   for (const b of bills) {
//     for (const it of b.order.items) {
//       const k = it.menuItemId;
//       const cur = itemMap.get(k) ?? { name: it.name, qty: 0, total: 0 };
//       cur.qty += it.quantity;
//       cur.total += it.price * it.quantity;
//       itemMap.set(k, cur);
//     }
//   }
//   const topItems = [...itemMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 10);

//   // Cashier-wise.
//   const cashierMap = new Map<string, { name: string; total: number; count: number }>();
//   for (const b of bills) {
//     const k = b.cashier.id;
//     const cur = cashierMap.get(k) ?? { name: b.cashier.name, total: 0, count: 0 };
//     cur.total += b.grandTotal;
//     cur.count += 1;
//     cashierMap.set(k, cur);
//   }

//   // Day buckets (for charts) — keyed YYYY-MM-DD.
//   const dayMap = new Map<string, number>();
//   for (const b of bills) {
//     const d = b.createdAt.toISOString().slice(0, 10);
//     dayMap.set(d, (dayMap.get(d) ?? 0) + b.grandTotal);
//   }
//   const dailySales = [...dayMap.entries()].sort().map(([day, total]) => ({ day, total }));

//   // Source-wise sales (POS, SWIGGY, ZOMATO, QR, CAPTAIN, PHONE).
//   const sourceMap = new Map<string, { source: string; total: number; count: number }>();
//   for (const b of bills) {
//     const k = b.order.source ?? "POS";
//     const cur = sourceMap.get(k) ?? { source: k, total: 0, count: 0 };
//     cur.total += b.grandTotal;
//     cur.count += 1;
//     sourceMap.set(k, cur);
//   }

//   return NextResponse.json({
//     range: { from, to },
//     summary: {
//       billCount: bills.length,
//       grossSales,
//       netSales,
//       totalGst,
//       totalDiscount,
//       totalExpenses,
//       profit,
//     },
//     payments: { cash, upi, card },
//     kot: { pending: kotPending, completed: kotCompleted },
//     topItems,
//     cashiers: [...cashierMap.values()].sort((a, b) => b.total - a.total),
//     sources: [...sourceMap.values()].sort((a, b) => b.total - a.total),
//     dailySales,
//     recentBills: bills.slice(0, 10),
//   });
// }
