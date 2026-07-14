import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Check authentication using your custom auth
    const auth = await requireAuth();
    if (!auth.ok) {
      return auth.response;
    }

    const user = auth.user;
    const body = await request.json();
    
    // Validate required fields
    const { 
      items, 
      orderType = 'WALKIN',
      source = 'POS',
      pickupCounterId,
      notes,
      subtotal,
      grandTotal,
      itemDiscount = 0,
      billDiscount = 0,
      cgst = 0,
      sgst = 0,
      packingCharge = 0,
      deliveryCharge = 0,
      roundOff = 0,
      couponDiscount = 0,
      loyaltyValue = 0,
      paymentCash = 0,
      paymentUpi = 0,
      paymentCard = 0,
      paymentOnline = 0,
      paymentMethod = 'CASH',
      customerId,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Items are required' },
        { status: 400 }
      );
    }

    // Generate order number
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const lastOrder = await prisma.order.findFirst({
      where: {
        createdAt: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
          lte: new Date(today.setHours(23, 59, 59, 999)),
        }
      },
      orderBy: { orderNumber: 'desc' },
    });

    let sequence = 1;
    if (lastOrder?.orderNumber) {
      const lastSeq = parseInt(lastOrder.orderNumber.split('-')[1]);
      if (!isNaN(lastSeq)) sequence = lastSeq + 1;
    }
    const orderNumber = `ORD-${dateStr}-${String(sequence).padStart(4, '0')}`;

    // Calculate totals if not provided
    let calculatedSubtotal = subtotal || 0;
    let calculatedGrandTotal = grandTotal || 0;
    
    if (!subtotal || !grandTotal) {
      calculatedSubtotal = items.reduce((sum: number, item: any) => {
        return sum + (item.price * item.quantity);
      }, 0);
      
      calculatedGrandTotal = calculatedSubtotal - itemDiscount - billDiscount + cgst + sgst + packingCharge + deliveryCharge - couponDiscount - loyaltyValue + roundOff;
    }

    // Create the order with all items
    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderType: orderType || 'WALKIN',
        source: source || 'POS',
        pickupCounterId: pickupCounterId || null,
        orderStatus: 'COMPLETED',
        notes: notes || null,
        
        // Create Bill along with Order
        bill: {
          create: {
            billNumber: orderNumber.replace('ORD', 'BILL'),
            orderType: orderType || 'WALKIN',  // ← ADDED THIS LINE
            status: 'PAID',
            paymentMethod: paymentMethod || 'CASH',
            subtotal: calculatedSubtotal,
            grandTotal: calculatedGrandTotal,
            itemDiscount: itemDiscount || 0,
            billDiscount: billDiscount || 0,
            cgst: cgst || 0,
            sgst: sgst || 0,
            packingCharge: packingCharge || 0,
            deliveryCharge: deliveryCharge || 0,
            roundOff: roundOff || 0,
            couponDiscount: couponDiscount || 0,
            loyaltyValue: loyaltyValue || 0,
            paymentCash: paymentCash || 0,
            paymentUpi: paymentUpi || 0,
            paymentCard: paymentCard || 0,
            paymentOnline: paymentOnline || 0,
            cashierId: user.sub,
            customerId: customerId || null,
          }
        },

        // Order items
        items: {
          create: items.map((item: any) => ({
            groceryItemId: item.groceryItemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            gstPercent: item.gstPercent || 0,
            discount: item.discount || 0,
            weight: item.weight || null,
            notes: item.notes || null,
          }))
        }
      },
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

    // Update inventory/stockQuantity for grocery items
    for (const item of items) {
      if (item.groceryItemId) {
        await prisma.groceryItem.update({
          where: { id: item.groceryItemId },
          data: {
            stockQuantity: {
              decrement: item.quantity
            }
          }
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      order,
      orderNumber,
      billNumber: order.bill?.billNumber,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order', details: String(error) },
      { status: 500 }
    );
  }
}

// DELETE method for cancelling orders
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const auth = await requireAuth();
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Get order items to restore stockQuantity
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { 
        items: true,
        bill: true 
      }
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Restore stockQuantity for each item
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
      where: { id: orderId },
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

// GET method for fetching orders
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const auth = await requireAuth();
    if (!auth.ok) {
      return auth.response;
    }

    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
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
        return NextResponse.json(
          { error: 'Order not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ order });
    }

    // Get all orders with pagination
    const orders = await prisma.order.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json({ orders });

  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// PATCH method for updating order status
export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const auth = await requireAuth();
    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json();
    const { orderId, orderStatus, notes } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        orderStatus: orderStatus || undefined,
        notes: notes || undefined,
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
      order: updatedOrder
    });

  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}