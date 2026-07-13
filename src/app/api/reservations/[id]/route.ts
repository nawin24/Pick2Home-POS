// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";

// export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth();
//   if (!auth.ok) return auth.response;
//   const b = await req.json();
//   const data: any = {};
//   for (const k of ["name","phone","partySize","tableId","notes","status"] as const)
//     if (b[k] !== undefined) data[k] = b[k];
//   if (b.scheduledAt) data.scheduledAt = new Date(b.scheduledAt);
//   const r = await prisma.reservation.update({ where: { id: params.id }, data, include: { table: true } });

//   // Reflect status onto the table when the reservation ends.
//   if (b.status === "SEATED" && r.tableId) {
//     await prisma.table.update({ where: { id: r.tableId }, data: { status: "OCCUPIED" } });
//   }
//   if ((b.status === "CANCELLED" || b.status === "NOSHOW") && r.tableId) {
//     await prisma.table.update({ where: { id: r.tableId }, data: { status: "AVAILABLE" } });
//   }
//   return NextResponse.json({ reservation: r });
// }

// export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth(["ADMIN", "MANAGER"]);
//   if (!auth.ok) return auth.response;
//   await prisma.reservation.delete({ where: { id: params.id } });
//   return NextResponse.json({ ok: true });
// }
