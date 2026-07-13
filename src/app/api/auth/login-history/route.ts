import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const userId = url.searchParams.get("userId");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 100);

  const where: any = {};
  if (userId) {
    where.userId = userId;
  }

  const history = await prisma.loginHistory.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      loginTime: "desc",
    },
    take: limit,
  });

  return NextResponse.json({ history });
}