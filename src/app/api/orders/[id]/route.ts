import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// GET - Fetch a specific order
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER"]);
  if (!auth.ok) return auth.response;

  try {
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        items: {
          include: {
            groceryItem: true
          }
        },
        bill: {
          include: {
            cashier: {
              select: {
                id: true,
                name: true,
                email: true,
              }
            },
            customer: true
          }
        },
        pickupCounter: true
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    console.error('Error fetching order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// PATCH - Update order status
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { orderStatus, notes } = body;

    // Check if order exists
    const existingOrder = await prisma.order.findUnique({
      where: { id: params.id }
    });

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Update the order
    const order = await prisma.order.update({
      where: { id: params.id },
      data: {
        orderStatus: orderStatus || existingOrder.orderStatus,
        notes: notes !== undefined ? notes : existingOrder.notes,
      },
      include: {
        items: {
          include: {
            groceryItem: true
          }
        },
        bill: true,
        pickupCounter: true
      }
    });

    return NextResponse.json({ 
      success: true, 
      order 
    });

  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}

// DELETE - Cancel/Delete an order
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;

  try {
    // Get order with items to restore stock
    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: { 
        items: true,
        bill: true 
      }
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Restore stock for each item
    for (const item of order.items) {
      if (item.groceryItemId) {
        await prisma.groceryItem.update({
          where: { id: item.groceryItemId },
          data: {
            stockQuantity: {
              increment: item.quantity
            }
          }
        });
      }
    }

    // Update order status to CANCELLED instead of deleting
    await prisma.order.update({
      where: { id: params.id },
      data: {
        orderStatus: 'CANCELLED',
        bill: {
          update: {
            status: 'CANCELLED'
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling order:', error);
    return NextResponse.json(
      { error: 'Failed to cancel order' },
      { status: 500 }
    );
  }
}