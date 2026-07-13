import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const q = new URL(req.url).searchParams.get("q");
  const customers = await prisma.customer.findMany({
    where: q
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ customers });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const b = await req.json();
  if (!b.name || !b.phone) return NextResponse.json({ error: "name, phone required" }, { status: 400 });
  const existing = await prisma.customer.findUnique({ where: { phone: b.phone } });
  if (existing) {
    const updated = await prisma.customer.update({
      where: { id: existing.id },
      data: {
        name: b.name,
        email: b.email ?? existing.email,
        address: b.address ?? existing.address,
        gstNumber: b.gstNumber ?? existing.gstNumber,
      },
    });
    return NextResponse.json({ customer: updated, merged: true });
  }
  const customer = await prisma.customer.create({
    data: {
      name: b.name,
      phone: b.phone,
      email: b.email,
      address: b.address,
      gstNumber: b.gstNumber,
    },
  });
  return NextResponse.json({ customer });
}
