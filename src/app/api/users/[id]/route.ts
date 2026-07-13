import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;
  
  const body = await req.json();
  const data: any = {};
  
  for (const k of ["name", "email", "phone", "role", "active"] as const) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  if (data.email) {
    const existing = await prisma.user.findFirst({
      where: {
        email: data.email,
        NOT: { id: params.id },
      },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use by another user" },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { 
      id: true, 
      name: true, 
      email: true, 
      phone: true,
      role: true, 
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  
  await audit({ 
    userId: auth.user.sub, 
    module: "USER", 
    action: "UPDATE", 
    details: { id: params.id, email: user.email } 
  });
  
  return NextResponse.json({ user });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuth(["ADMIN"]);
    if (!auth.ok) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 401 }
      );
    }
    
    // Prevent deleting yourself
    if (params.id === auth.user.sub) {
      return NextResponse.json(
        { error: "Cannot delete your own account" },
        { status: 400 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      include: {
        billsCreated: true,
        expenses: true,
        heldOrders: true,
        loginHistory: true,
        auditLogs: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Use a transaction to delete all related records
    await prisma.$transaction(async (tx) => {
      // 1. Delete login history
      await tx.loginHistory.deleteMany({
        where: { userId: params.id },
      });

      // 2. Delete audit logs
      await tx.auditLog.deleteMany({
        where: { userId: params.id },
      });

      // 3. Delete held orders
      await tx.heldOrder.deleteMany({
        where: { createdById: params.id },
      });

      // 4. Update bills - reassign to admin or set cashierId to null
      await tx.bill.updateMany({
        where: { cashierId: params.id },
        data: { cashierId: auth.user.sub },
      });

      // 5. Update expenses - reassign to admin
      await tx.expense.updateMany({
        where: { addedById: params.id },
        data: { addedById: auth.user.sub },
      });

      // 6. Finally delete the user
      await tx.user.delete({
        where: { id: params.id },
      });
    });

    await audit({ 
      userId: auth.user.sub, 
      module: "USER", 
      action: "DELETE", 
      details: { id: params.id, email: user.email } 
    });
    
    return NextResponse.json({ 
      ok: true, 
      message: "User deleted successfully" 
    });
  } catch (error: any) {
    console.error("Delete error:", error);
    
    // Check for specific Prisma errors
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: "Cannot delete user - they have existing records (bills, orders, etc.)" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}

// import { NextRequest, NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";
// import { audit } from "@/lib/audit";

// export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth(["ADMIN"]);
//   if (!auth.ok) return auth.response;
//   const body = await req.json();
//   const data: any = {};
//   for (const k of ["name", "phone", "role", "active"] as const) {
//     if (body[k] !== undefined) data[k] = body[k];
//   }
//   if (body.password) data.passwordHash = await bcrypt.hash(body.password, 10);

//   const user = await prisma.user.update({
//     where: { id: params.id },
//     data,
//     select: { id: true, name: true, email: true, role: true, active: true },
//   });
//   await audit({ userId: auth.user.sub, module: "USER", action: "UPDATE", details: { id: params.id } });
//   return NextResponse.json({ user });
// }

// export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth(["ADMIN"]);
//   if (!auth.ok) return auth.response;
//   if (params.id === auth.user.sub) {
//     return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
//   }
//   await prisma.user.update({ where: { id: params.id }, data: { active: false } });
//   await audit({ userId: auth.user.sub, module: "USER", action: "DEACTIVATE", details: { id: params.id } });
//   return NextResponse.json({ ok: true });
// }
