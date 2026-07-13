import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const expenses = await prisma.expense.findMany({
    where:
      from || to
        ? {
            date: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lt: new Date(to) } : {}),
            },
          }
        : undefined,
    orderBy: { date: "desc" },
    include: { addedBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const b = await req.json();
  if (!b.title || !b.amount || !b.category) {
    return NextResponse.json({ error: "title, amount, category required" }, { status: 400 });
  }
  const exp = await prisma.expense.create({
    data: {
      title: b.title,
      category: b.category,
      amount: Number(b.amount),
      paymentMethod: b.paymentMethod ?? "CASH",
      notes: b.notes,
      date: b.date ? new Date(b.date) : new Date(),
      addedById: auth.user.sub,
    },
  });
  await audit({ userId: auth.user.sub, module: "EXPENSE", action: "CREATE", details: { id: exp.id } });
  return NextResponse.json({ expense: exp });
}
