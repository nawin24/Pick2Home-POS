// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";
// import { nextOrderNumber } from "@/lib/billNumber";
// import { audit } from "@/lib/audit";

// // Create a KOT-only order (no bill yet). Used by the Captain app and any flow
// // that needs to fire the kitchen before payment is taken.
// export async function POST(req: NextRequest) {
//   const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER"]);
//   if (!auth.ok) return auth.response;
//   const b = await req.json();
//   if (!Array.isArray(b.items) || !b.items.length) {
//     return NextResponse.json({ error: "items required" }, { status: 400 });
//   }
//   const menuItems = await prisma.menuItem.findMany({
//     where: { id: { in: b.items.map((i: any) => i.menuItemId) } },
//   });
//   const map = new Map(menuItems.map((m) => [m.id, m]));
//   const lines = b.items
//     .map((i: any) => {
//       const m = map.get(i.menuItemId);
//       if (!m) return null;
//       return {
//         menuItemId: m.id,
//         name: m.name,
//         price: m.price,
//         quantity: Number(i.quantity || 1),
//         gstPercent: m.gstPercent,
//         discount: 0,
//         notes: i.notes ?? null,
//       };
//     })
//     .filter(Boolean) as any[];
//   if (!lines.length) return NextResponse.json({ error: "no valid items" }, { status: 400 });

//   const orderNumber = await nextOrderNumber();
//   const order = await prisma.order.create({
//     data: {
//       orderNumber,
//       orderType: b.orderType ?? "DINEIN",
//       source: b.source ?? "CAPTAIN",
//       tableId: b.tableId ?? null,
//       notes: b.notes,
//       kotStatus: "NEW",
//       items: { create: lines },
//     },
//     include: { items: true, table: true },
//   });

//   if (order.tableId) {
//     await prisma.table.update({ where: { id: order.tableId }, data: { status: "OCCUPIED" } });
//   }

//   await audit({ userId: auth.user.sub, module: "ORDER", action: "CREATE", details: { id: order.id, source: order.source } });
//   return NextResponse.json({ order });
// }
