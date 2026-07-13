import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ coupons });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const b = await req.json();
  if (!b.code || !b.type || b.value == null) {
    return NextResponse.json({ error: "code, type, value required" }, { status: 400 });
  }
  if (!["PERCENT", "FLAT"].includes(b.type)) {
    return NextResponse.json({ error: "type must be PERCENT or FLAT" }, { status: 400 });
  }
  const coupon = await prisma.coupon.create({
    data: {
      code: String(b.code).toUpperCase().trim(),
      description: b.description,
      type: b.type,
      value: Number(b.value),
      minOrder: Number(b.minOrder ?? 0),
      maxDiscount: b.maxDiscount != null ? Number(b.maxDiscount) : null,
      validUntil: b.validUntil ? new Date(b.validUntil) : null,
      usageLimit: b.usageLimit != null ? Number(b.usageLimit) : null,
      active: b.active ?? true,
    },
  });
  return NextResponse.json({ coupon });
}
