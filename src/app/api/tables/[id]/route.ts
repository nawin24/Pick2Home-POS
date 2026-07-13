import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  
  const b = await req.json();
  const data: any = {};
  
  // CHANGED: Removed "capacity", kept "number" and "status"
  for (const k of ["number", "status"] as const) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  
  // CHANGED: table → pickupCounter
  const counter = await prisma.pickupCounter.update({
    where: { id: params.id },
    data,
  });
  
  // Keep response format same for frontend compatibility
  return NextResponse.json({ table: counter });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  
  // CHANGED: table → pickupCounter
  await prisma.pickupCounter.delete({
    where: { id: params.id },
  });
  
  return NextResponse.json({ ok: true });
}


// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";

// export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth();
//   if (!auth.ok) return auth.response;
//   const b = await req.json();
//   const data: any = {};
//   for (const k of ["number","capacity","status"] as const) if (b[k] !== undefined) data[k] = b[k];
//   if (data.capacity) data.capacity = Number(data.capacity);
//   const table = await prisma.table.update({ where: { id: params.id }, data });
//   return NextResponse.json({ table });
// }

// export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth(["ADMIN", "MANAGER"]);
//   if (!auth.ok) return auth.response;
//   await prisma.table.delete({ where: { id: params.id } });
//   return NextResponse.json({ ok: true });
// }
