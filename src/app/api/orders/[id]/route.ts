import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

const NEXT: Record<string, string> = {
  NEW: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
};

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER", "KITCHEN"]);
  if (!auth.ok) return auth.response;
  const b = await req.json();
  let status: string | undefined = b.status;
  if (!status && b.advance) {
    const cur = await prisma.order.findUnique({ where: { id: params.id } });
    if (!cur) return NextResponse.json({ error: "Not found" }, { status: 404 });
    status = NEXT[cur.kotStatus] ?? cur.kotStatus;
  }
  if (!status) return NextResponse.json({ error: "status required" }, { status: 400 });

  const order = await prisma.order.update({
    where: { id: params.id },
    data: { kotStatus: status },
  });

  // Free the table when served.
  if (status === "SERVED" && order.tableId) {
    await prisma.table.update({ where: { id: order.tableId }, data: { status: "CLEANING" } });
  }
  await audit({ userId: auth.user.sub, module: "KOT", action: status, details: { id: params.id } });
  return NextResponse.json({ order });
}
