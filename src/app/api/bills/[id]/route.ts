import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  
  const bill = await prisma.bill.findUnique({
    where: { id: params.id },
    include: {
      order: { 
        include: { 
          items: {
            include: {
              groceryItem: true // CHANGED: include groceryItem
            }
          }, 
          pickupCounter: true // CHANGED: table → pickupCounter
        } 
      },
      customer: true,
      cashier: { select: { id: true, name: true } },
    },
  });
  
  if (!bill) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ bill });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) {
    // Allow cashier cancel only if setting permits.
    const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
    if (!settings?.allowCashierCancel) return auth.response;
  }
  
  const b = await req.json();
  
  if (b.action === "CANCEL") {
    // Get the bill first to restore stock
    const existingBill = await prisma.bill.findUnique({
      where: { id: params.id },
      include: {
        order: {
          include: {
            items: true
          }
        }
      }
    });

    if (!existingBill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 });
    }

    // CHANGED: Restore stock for grocery items
    if (existingBill.status === "PAID") {
      for (const item of existingBill.order.items) {
        await prisma.groceryItem.update({
          where: { id: item.groceryItemId },
          data: {
            stockQuantity: {
              increment: item.quantity,
            },
          },
        });
      }
    }

    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: {
        status: "CANCELLED",
        cancelReason: b.reason ?? "Unspecified",
        refundAmount: Number(b.refundAmount ?? 0),
        refundMethod: b.refundMethod ?? null,
      },
      include: {
        order: { 
          include: { 
            items: {
              include: {
                groceryItem: true
              }
            }, 
            pickupCounter: true 
          } 
        },
        customer: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    // CHANGED: Update pickup counter status if occupied
    if (bill.order.pickupCounterId) {
      await prisma.pickupCounter.update({
        where: { id: bill.order.pickupCounterId },
        data: { status: "AVAILABLE" },
      });
    }

    await audit({
      userId: auth.ok ? auth.user.sub : undefined,
      module: "BILL",
      action: "CANCEL",
      details: { id: params.id, reason: b.reason },
    });
    
    return NextResponse.json({ bill });
  }

  // NEW: Refund action for grocery store
  if (b.action === "REFUND") {
    const bill = await prisma.bill.update({
      where: { id: params.id },
      data: {
        status: "REFUNDED",
        refundAmount: Number(b.refundAmount ?? 0),
        refundMethod: b.refundMethod ?? null,
        cancelReason: b.reason ?? "Refunded",
      },
      include: {
        order: { 
          include: { 
            items: {
              include: {
                groceryItem: true
              }
            }, 
            pickupCounter: true 
          } 
        },
        customer: true,
        cashier: { select: { id: true, name: true } },
      },
    });

    // Restore stock on refund
    for (const item of bill.order.items) {
      await prisma.groceryItem.update({
        where: { id: item.groceryItemId },
        data: {
          stockQuantity: {
            increment: item.quantity,
          },
        },
      });
    }

    // Update pickup counter
    if (bill.order.pickupCounterId) {
      await prisma.pickupCounter.update({
        where: { id: bill.order.pickupCounterId },
        data: { status: "AVAILABLE" },
      });
    }

    await audit({
      userId: auth.ok ? auth.user.sub : undefined,
      module: "BILL",
      action: "REFUND",
      details: { id: params.id, amount: b.refundAmount },
    });

    return NextResponse.json({ bill });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}


