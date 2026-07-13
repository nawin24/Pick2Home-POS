import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const items = await prisma.heldOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER"]);
  if (!auth.ok) return auth.response;
  const b = await req.json();
  const hold = await prisma.heldOrder.create({
    data: {
      note: b.note,
      orderType: b.orderType ?? "DINEIN",
      tableId: b.tableId,
      cartJson: JSON.stringify(b.cart ?? []),
      createdById: auth.user.sub,
    },
  });
  return NextResponse.json({ hold });
}
