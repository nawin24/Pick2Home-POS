import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextOrderNumber } from "@/lib/billNumber";
import { audit } from "@/lib/audit";

// Aggregator webhook stub — accepts Swiggy / Zomato orders.
// Auth: require a shared secret header. Use INTEGRATION_TOKEN env or fallback to JWT_SECRET.
// Payload (normalized):
// {
//   source: "SWIGGY" | "ZOMATO",
//   externalRef: "ZOM-123",
//   orderType: "DELIVERY" | "TAKEAWAY",
//   notes?: string,
//   items: [{ menuItemId: "...", quantity: 2, notes?: "no onion" }]
// }
export async function POST(req: NextRequest) {
  const token = req.headers.get("x-integration-token");
  const expected = process.env.INTEGRATION_TOKEN || process.env.JWT_SECRET || "";
  if (!token || token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    if (!body.source || !["SWIGGY", "ZOMATO"].includes(body.source)) {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    if (!Array.isArray(body.items) || !body.items.length) {
      return NextResponse.json({ error: "No items" }, { status: 400 });
    }

    const menuItems = await prisma.menuItem.findMany({
      where: { id: { in: body.items.map((i: any) => i.menuItemId) } },
    });
    const map = new Map(menuItems.map((m) => [m.id, m]));

    const lines = body.items
      .map((i: any) => {
        const m = map.get(i.menuItemId);
        if (!m) return null;
        return {
          menuItemId: m.id,
          name: m.name,
          price: m.price,
          quantity: Number(i.quantity || 1),
          gstPercent: m.gstPercent,
          discount: 0,
          notes: i.notes ?? null,
        };
      })
      .filter(Boolean) as any[];

    if (!lines.length) return NextResponse.json({ error: "No valid items" }, { status: 400 });

    const orderNumber = await nextOrderNumber();
    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderType: body.orderType ?? "DELIVERY",
        source: body.source,
        externalRef: body.externalRef ?? null,
        kotStatus: "NEW",
        notes: body.notes,
        items: { create: lines },
      },
      include: { items: true },
    });

    await audit({ module: "ONLINE", action: "INGEST", details: { source: body.source, orderId: order.id } });
    return NextResponse.json({ ok: true, order });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Failed" }, { status: 500 });
  }
}
