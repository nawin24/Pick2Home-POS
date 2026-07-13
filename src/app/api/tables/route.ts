import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  
  // CHANGED: table → pickupCounter
  const counters = await prisma.pickupCounter.findMany({ 
    orderBy: { number: "asc" } 
  });
  
  // Keep response format same for frontend compatibility
  return NextResponse.json({ tables: counters });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  
  const { number, capacity } = await req.json();
  if (!number) {
    return NextResponse.json({ error: "number required" }, { status: 400 });
  }
  
  // CHANGED: table → pickupCounter
  const counter = await prisma.pickupCounter.create({
    data: { 
      number: String(number), 
      status: "AVAILABLE" 
    },
  });
  
  return NextResponse.json({ table: counter });
}

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";

// export async function GET() {
//   const auth = await requireAuth();
//   if (!auth.ok) return auth.response;
//   const tables = await prisma.table.findMany({ orderBy: { number: "asc" } });
//   return NextResponse.json({ tables });
// }

// export async function POST(req: NextRequest) {
//   const auth = await requireAuth(["ADMIN", "MANAGER"]);
//   if (!auth.ok) return auth.response;
//   const { number, capacity } = await req.json();
//   if (!number) return NextResponse.json({ error: "number required" }, { status: 400 });
//   const table = await prisma.table.create({
//     data: { number: String(number), capacity: Number(capacity ?? 4) },
//   });
//   return NextResponse.json({ table });
// }
