import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const b = await req.json();
  const data: any = {};
  for (const k of ["description","type","minOrder","maxDiscount","usageLimit","active"] as const)
    if (b[k] !== undefined) data[k] = b[k];
  if (b.value !== undefined) data.value = Number(b.value);
  if (b.validUntil !== undefined) data.validUntil = b.validUntil ? new Date(b.validUntil) : null;
  const coupon = await prisma.coupon.update({ where: { id: params.id }, data });
  return NextResponse.json({ coupon });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;
  await prisma.coupon.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
