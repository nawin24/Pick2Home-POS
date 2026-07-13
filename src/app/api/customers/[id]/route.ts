import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: { bills: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ customer });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const b = await req.json();
  const data: any = {};
  for (const k of ["name","phone","email","address","gstNumber"] as const)
    if (b[k] !== undefined) data[k] = b[k];
  const customer = await prisma.customer.update({ where: { id: params.id }, data });
  return NextResponse.json({ customer });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  await prisma.customer.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
