import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const b = await req.json();
  const data: any = {};
  if (b.purchasedDelta) data.purchased = { increment: Number(b.purchasedDelta) };
  if (b.usedDelta) data.used = { increment: Number(b.usedDelta) };
  for (const k of ["name","unit","minStock"] as const) if (b[k] !== undefined) data[k] = b[k];
  if (data.minStock !== undefined) data.minStock = Number(data.minStock);
  const item = await prisma.inventoryItem.update({ where: { id: params.id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;
  await prisma.inventoryItem.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
