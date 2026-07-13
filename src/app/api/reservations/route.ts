import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const reservations = await prisma.reservation.findMany({
    where: status ? { status } : undefined,
    orderBy: { scheduledAt: "asc" },
    include: { table: true, customer: true },
  });
  return NextResponse.json({ reservations });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const b = await req.json();
  if (!b.name || !b.phone || !b.scheduledAt) {
    return NextResponse.json({ error: "name, phone, scheduledAt required" }, { status: 400 });
  }

  // If we know this customer, link them.
  const customer = await prisma.customer.findUnique({ where: { phone: b.phone } });

  const reservation = await prisma.reservation.create({
    data: {
      name: b.name,
      phone: b.phone,
      partySize: Number(b.partySize ?? 2),
      scheduledAt: new Date(b.scheduledAt),
      tableId: b.tableId ?? null,
      notes: b.notes,
      customerId: customer?.id ?? null,
    },
    include: { table: true, customer: true },
  });

  if (reservation.tableId) {
    await prisma.table.update({ where: { id: reservation.tableId }, data: { status: "RESERVED" } });
  }
  return NextResponse.json({ reservation });
}
