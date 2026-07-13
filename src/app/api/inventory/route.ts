import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const items = await prisma.inventoryItem.findMany({ orderBy: { name: "asc" } });
  const enriched = items.map((i) => ({
    ...i,
    available: i.openingStock + i.purchased - i.used,
    lowStock: i.openingStock + i.purchased - i.used <= i.minStock,
  }));
  return NextResponse.json({ items: enriched });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const b = await req.json();
  if (!b.name || !b.unit) return NextResponse.json({ error: "name, unit required" }, { status: 400 });
  const existing = await prisma.inventoryItem.findUnique({ where: { name: b.name } });
  if (existing) return NextResponse.json({ error: "Item exists" }, { status: 409 });
  const item = await prisma.inventoryItem.create({
    data: {
      name: b.name,
      unit: b.unit,
      openingStock: Number(b.openingStock ?? 0),
      minStock: Number(b.minStock ?? 0),
    },
  });
  return NextResponse.json({ item });
}
