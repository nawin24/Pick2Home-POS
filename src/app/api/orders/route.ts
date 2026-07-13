import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const status = new URL(req.url).searchParams.get("status");
  const orders = await prisma.order.findMany({
    where: status ? { kotStatus: status } : undefined,
    orderBy: { createdAt: "desc" },
    include: { items: true, table: true, bill: true },
    take: 200,
  });
  return NextResponse.json({ orders });
}
