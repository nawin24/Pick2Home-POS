import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const { code, subtotal } = await req.json();
  if (!code) return NextResponse.json({ error: "Code required" }, { status: 400 });

  const c = await prisma.coupon.findUnique({ where: { code: String(code).toUpperCase() } });
  if (!c || !c.active) return NextResponse.json({ error: "Invalid coupon" }, { status: 400 });
  if (c.validUntil && c.validUntil < new Date()) return NextResponse.json({ error: "Expired" }, { status: 400 });
  if (c.usageLimit && c.usedCount >= c.usageLimit) return NextResponse.json({ error: "Limit reached" }, { status: 400 });
  if (c.minOrder && Number(subtotal) < c.minOrder) {
    return NextResponse.json({ error: `Needs min order ₹${c.minOrder}` }, { status: 400 });
  }
  const discount = c.type === "PERCENT"
    ? Math.min((Number(subtotal) * c.value) / 100, c.maxDiscount ?? Infinity)
    : Math.min(c.value, Number(subtotal));

  return NextResponse.json({ coupon: c, discount: Math.round(discount * 100) / 100 });
}
