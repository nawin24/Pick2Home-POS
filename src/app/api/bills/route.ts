import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { computeBill, CartLine } from "@/lib/calc";
import { nextBillNumber, nextOrderNumber } from "@/lib/billNumber";
import { audit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  const bills = await prisma.bill.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lt: new Date(to) } : {}),
            },
          }
        : {}),
    },
    include: {
      order: { 
        include: { 
          pickupCounter: true,
          items: {
            include: {
              groceryItem: true
            }
          } 
        } 
      },
      customer: true,
      cashier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return NextResponse.json({ bills });
}

type CreatePayload = {
  orderType: "WALKIN" | "DELIVERY" | "ONLINE";
  source?: "POS" | "WEBSITE" | "APP" | "PHONE";
  pickupCounterId?: string;
  notes?: string;
  customer?: { name: string; phone: string; email?: string; address?: string; gstNumber?: string };
  cart: CartLine[];
  extras?: {
    packingCharge?: number;
    serviceCharge?: number;
    deliveryCharge?: number;
    billDiscount?: number;
    billDiscountPercent?: number;
  };
  couponCode?: string;
  redeemPoints?: number;
  payment: { method: "CASH" | "UPI" | "CARD" | "SPLIT" | "ONLINE"; cash?: number; upi?: number; card?: number; online?: number };
  delivery?: { name?: string; phone?: string; address?: string; partner?: string };
  fromOrderId?: string;
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER"]);
  if (!auth.ok) return auth.response;
  try {
    const body = (await req.json()) as CreatePayload;
    if (!body.cart?.length) {
      return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
    }
    if (!body.orderType) {
      return NextResponse.json({ error: "orderType required" }, { status: 400 });
    }

    const settings = await prisma.settings.upsert({
      where: { id: "singleton" }, update: {}, create: { id: "singleton" },
    });

    const pre = computeBill(body.cart);

    // Validate coupon.
    let couponDiscount = 0;
    let coupon: any = null;
    if (body.couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: body.couponCode.toUpperCase() } });
      if (!coupon || !coupon.active) {
        return NextResponse.json({ error: "Invalid coupon" }, { status: 400 });
      }
      if (coupon.validUntil && coupon.validUntil < new Date()) {
        return NextResponse.json({ error: "Coupon expired" }, { status: 400 });
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
      }
      if (coupon.minOrder && pre.subtotal < coupon.minOrder) {
        return NextResponse.json({ error: `Coupon needs min order ₹${coupon.minOrder}` }, { status: 400 });
      }
      couponDiscount = coupon.type === "PERCENT"
        ? Math.min(pre.subtotal * (coupon.value / 100), coupon.maxDiscount ?? Infinity)
        : Math.min(coupon.value, pre.subtotal);
    }

    // Validate loyalty redeem.
    let redeemPoints = 0;
    let loyaltyValue = 0;
    let customerForRedeem: any = null;
    if (body.redeemPoints && body.redeemPoints > 0) {
      if (!settings.loyaltyEnabled) {
        return NextResponse.json({ error: "Loyalty disabled" }, { status: 400 });
      }
      if (!body.customer?.phone) {
        return NextResponse.json({ error: "Customer phone required to redeem points" }, { status: 400 });
      }
      customerForRedeem = await prisma.customer.findUnique({ where: { phone: body.customer.phone } });
      if (!customerForRedeem) {
        return NextResponse.json({ error: "Customer not found for redemption" }, { status: 400 });
      }
      const requested = Math.floor(body.redeemPoints);
      if (requested < settings.loyaltyMinRedeem) {
        return NextResponse.json({ error: `Minimum redemption is ${settings.loyaltyMinRedeem} points` }, { status: 400 });
      }
      if (requested > customerForRedeem.loyaltyPoints) {
        return NextResponse.json({ error: "Not enough loyalty points" }, { status: 400 });
      }
      redeemPoints = requested;
      loyaltyValue = redeemPoints * settings.loyaltyRedeemValue;
    }

    const computed = computeBill(body.cart, {
      ...body.extras,
      couponDiscount,
      loyaltyRedeemValue: loyaltyValue,
    });

    const loyaltyEarned = settings.loyaltyEnabled && settings.loyaltyEarnRupees > 0
      ? Math.floor(computed.grandTotal / settings.loyaltyEarnRupees)
      : 0;

    let customerId: string | null = null;
    if (body.customer?.phone) {
      const existing = await prisma.customer.findUnique({ where: { phone: body.customer.phone } });
      const pointDelta = loyaltyEarned - redeemPoints;
      const c = existing
        ? await prisma.customer.update({
            where: { id: existing.id },
            data: {
              name: body.customer.name || existing.name,
              email: body.customer.email ?? existing.email,
              address: body.customer.address ?? existing.address,
              gstNumber: body.customer.gstNumber ?? existing.gstNumber,
              visits: { increment: 1 },
              totalSpent: { increment: computed.grandTotal },
              loyaltyPoints: { increment: pointDelta },
              lastVisit: new Date(),
            },
          })
        : await prisma.customer.create({
            data: {
              name: body.customer.name,
              phone: body.customer.phone,
              email: body.customer.email,
              address: body.customer.address,
              gstNumber: body.customer.gstNumber,
              visits: 1,
              totalSpent: computed.grandTotal,
              loyaltyPoints: pointDelta,
              lastVisit: new Date(),
            },
          });
      customerId = c.id;
    }

    const billNumber = await nextBillNumber();

    const result = await prisma.$transaction(async (tx) => {
      let order;
      if (body.fromOrderId) {
        order = await tx.order.update({
          where: { id: body.fromOrderId },
          data: { orderStatus: "PROCESSING" },
          include: { items: true },
        });
      } else {
        const orderNumber = await nextOrderNumber();
        order = await tx.order.create({
          data: {
            orderNumber,
            orderType: body.orderType,
            source: body.source ?? "POS",
            pickupCounterId: body.orderType === "WALKIN" ? body.pickupCounterId ?? null : null,
            notes: body.notes,
            orderStatus: "PENDING",
            items: {
              create: computed.lines.map((l) => ({
                groceryItemId: l.menuItemId,
                name: l.name,
                price: l.price,
                quantity: l.quantity,
                gstPercent: l.gstPercent,
                discount: l.discount ?? 0,
                notes: l.notes,
              })),
            },
          },
          include: { items: true },
        });
      }

      // Update pickup counter if WALKIN
      if (body.orderType === "WALKIN" && body.pickupCounterId) {
        await tx.pickupCounter.update({ 
          where: { id: body.pickupCounterId }, 
          data: { status: "OCCUPIED" } 
        });
      }

      const payCash = body.payment.method === "CASH" ? computed.grandTotal :
        body.payment.method === "SPLIT" ? Number(body.payment.cash ?? 0) : 0;
      const payUpi = body.payment.method === "UPI" ? computed.grandTotal :
        body.payment.method === "SPLIT" ? Number(body.payment.upi ?? 0) : 0;
      const payCard = body.payment.method === "CARD" ? computed.grandTotal :
        body.payment.method === "SPLIT" ? Number(body.payment.card ?? 0) : 0;
      const payOnline = body.payment.method === "ONLINE" ? computed.grandTotal :
        body.payment.method === "SPLIT" ? Number(body.payment.online ?? 0) : 0;

      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      // FIXED: Removed serviceCharge from bill creation
      const bill = await tx.bill.create({
        data: {
          billNumber,
          orderId: order.id,
          customerId,
          cashierId: auth.user.sub,
          orderType: body.orderType,
          subtotal: computed.subtotal,
          itemDiscount: computed.itemDiscount,
          billDiscount: computed.billDiscount,
          cgst: computed.cgst,
          sgst: computed.sgst,
          totalGst: computed.totalGst,
          packingCharge: computed.packingCharge,
          // serviceCharge: computed.serviceCharge, // ← REMOVED
          deliveryCharge: computed.deliveryCharge,
          roundOff: computed.roundOff,
          grandTotal: computed.grandTotal,
          paymentMethod: body.payment.method,
          paymentCash: payCash,
          paymentUpi: payUpi,
          paymentCard: payCard,
          paymentOnline: payOnline,
          couponCode: coupon?.code ?? null,
          couponDiscount,
          loyaltyEarned,
          loyaltyRedeemed: redeemPoints,
          loyaltyValue,
          deliveryName: body.delivery?.name,
          deliveryPhone: body.delivery?.phone,
          deliveryAddress: body.delivery?.address,
          deliveryPartner: body.delivery?.partner,
          itemCount: body.cart.reduce((sum, item) => sum + item.quantity, 0),
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

      // Update stock quantities
      for (const item of body.cart) {
        await tx.groceryItem.update({
          where: { id: item.menuItemId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      return bill;
    });

    await audit({
      userId: auth.user.sub,
      module: "BILL",
      action: "CREATE",
      details: { 
        id: result.id, 
        billNumber, 
        grandTotal: computed.grandTotal, 
        couponCode: coupon?.code, 
        redeemPoints, 
        loyaltyEarned 
      },
    });

    return NextResponse.json({ bill: result });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Failed to create bill" }, { status: 500 });
  }
}



// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";
// import { computeBill, CartLine } from "@/lib/calc";
// import { nextBillNumber, nextOrderNumber } from "@/lib/billNumber";
// import { audit } from "@/lib/audit";

// export async function GET(req: NextRequest) {
//   const auth = await requireAuth();
//   if (!auth.ok) return auth.response;
//   const url = new URL(req.url);
//   const from = url.searchParams.get("from");
//   const to = url.searchParams.get("to");
//   const status = url.searchParams.get("status");
//   const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

//   const bills = await prisma.bill.findMany({
//     where: {
//       ...(status ? { status } : {}),
//       ...(from || to
//         ? {
//             createdAt: {
//               ...(from ? { gte: new Date(from) } : {}),
//               ...(to ? { lt: new Date(to) } : {}),
//             },
//           }
//         : {}),
//     },
//     include: {
//       order: { include: { table: true, items: true } },
//       customer: true,
//       cashier: { select: { id: true, name: true } },
//     },
//     orderBy: { createdAt: "desc" },
//     take: limit,
//   });
//   return NextResponse.json({ bills });
// }

// type CreatePayload = {
//   orderType: "DINEIN" | "TAKEAWAY" | "DELIVERY";
//   source?: "POS" | "SWIGGY" | "ZOMATO" | "QR" | "CAPTAIN" | "PHONE";
//   tableId?: string;
//   notes?: string;
//   customer?: { name: string; phone: string; email?: string; address?: string; gstNumber?: string };
//   cart: CartLine[];
//   extras?: {
//     packingCharge?: number;
//     serviceCharge?: number;
//     deliveryCharge?: number;
//     billDiscount?: number;
//     billDiscountPercent?: number;
//   };
//   couponCode?: string;
//   redeemPoints?: number;
//   payment: { method: "CASH" | "UPI" | "CARD" | "SPLIT" | "ONLINE"; cash?: number; upi?: number; card?: number };
//   delivery?: { name?: string; phone?: string; address?: string; partner?: string };
//   fromOrderId?: string; // when finalizing a captain/QR order
// };

// export async function POST(req: NextRequest) {
//   const auth = await requireAuth(["ADMIN", "MANAGER", "CASHIER"]);
//   if (!auth.ok) return auth.response;
//   try {
//     const body = (await req.json()) as CreatePayload;
//     if (!body.cart?.length) {
//       return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
//     }
//     if (!body.orderType) {
//       return NextResponse.json({ error: "orderType required" }, { status: 400 });
//     }

//     const settings = await prisma.settings.upsert({
//       where: { id: "singleton" }, update: {}, create: { id: "singleton" },
//     });

//     // Compute subtotal (pre-discount) so we can validate coupon + redeem.
//     const pre = computeBill(body.cart);

//     // Validate coupon.
//     let couponDiscount = 0;
//     let coupon: any = null;
//     if (body.couponCode) {
//       coupon = await prisma.coupon.findUnique({ where: { code: body.couponCode.toUpperCase() } });
//       if (!coupon || !coupon.active) {
//         return NextResponse.json({ error: "Invalid coupon" }, { status: 400 });
//       }
//       if (coupon.validUntil && coupon.validUntil < new Date()) {
//         return NextResponse.json({ error: "Coupon expired" }, { status: 400 });
//       }
//       if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
//         return NextResponse.json({ error: "Coupon usage limit reached" }, { status: 400 });
//       }
//       if (coupon.minOrder && pre.subtotal < coupon.minOrder) {
//         return NextResponse.json({ error: `Coupon needs min order ₹${coupon.minOrder}` }, { status: 400 });
//       }
//       couponDiscount = coupon.type === "PERCENT"
//         ? Math.min(pre.subtotal * (coupon.value / 100), coupon.maxDiscount ?? Infinity)
//         : Math.min(coupon.value, pre.subtotal);
//     }

//     // Validate loyalty redeem.
//     let redeemPoints = 0;
//     let loyaltyValue = 0;
//     let customerForRedeem: any = null;
//     if (body.redeemPoints && body.redeemPoints > 0) {
//       if (!settings.loyaltyEnabled) {
//         return NextResponse.json({ error: "Loyalty disabled" }, { status: 400 });
//       }
//       if (!body.customer?.phone) {
//         return NextResponse.json({ error: "Customer phone required to redeem points" }, { status: 400 });
//       }
//       customerForRedeem = await prisma.customer.findUnique({ where: { phone: body.customer.phone } });
//       if (!customerForRedeem) {
//         return NextResponse.json({ error: "Customer not found for redemption" }, { status: 400 });
//       }
//       const requested = Math.floor(body.redeemPoints);
//       if (requested < settings.loyaltyMinRedeem) {
//         return NextResponse.json({ error: `Minimum redemption is ${settings.loyaltyMinRedeem} points` }, { status: 400 });
//       }
//       if (requested > customerForRedeem.loyaltyPoints) {
//         return NextResponse.json({ error: "Not enough loyalty points" }, { status: 400 });
//       }
//       redeemPoints = requested;
//       loyaltyValue = redeemPoints * settings.loyaltyRedeemValue;
//     }

//     const computed = computeBill(body.cart, {
//       ...body.extras,
//       couponDiscount,
//       loyaltyRedeemValue: loyaltyValue,
//     });

//     // Points earned (after redemption is applied, on the final paid amount).
//     const loyaltyEarned = settings.loyaltyEnabled && settings.loyaltyEarnRupees > 0
//       ? Math.floor(computed.grandTotal / settings.loyaltyEarnRupees)
//       : 0;

//     // Upsert customer + adjust points.
//     let customerId: string | null = null;
//     if (body.customer?.phone) {
//       const existing = await prisma.customer.findUnique({ where: { phone: body.customer.phone } });
//       const pointDelta = loyaltyEarned - redeemPoints;
//       const c = existing
//         ? await prisma.customer.update({
//             where: { id: existing.id },
//             data: {
//               name: body.customer.name || existing.name,
//               email: body.customer.email ?? existing.email,
//               address: body.customer.address ?? existing.address,
//               gstNumber: body.customer.gstNumber ?? existing.gstNumber,
//               visits: { increment: 1 },
//               totalSpent: { increment: computed.grandTotal },
//               loyaltyPoints: { increment: pointDelta },
//               lastVisit: new Date(),
//             },
//           })
//         : await prisma.customer.create({
//             data: {
//               name: body.customer.name,
//               phone: body.customer.phone,
//               email: body.customer.email,
//               address: body.customer.address,
//               gstNumber: body.customer.gstNumber,
//               visits: 1,
//               totalSpent: computed.grandTotal,
//               loyaltyPoints: pointDelta,
//               lastVisit: new Date(),
//             },
//           });
//       customerId = c.id;
//     }

//     const billNumber = await nextBillNumber();

//     const result = await prisma.$transaction(async (tx) => {
//       // Use an existing order (captain/QR flow) or create a fresh one.
//       let order;
//       if (body.fromOrderId) {
//         order = await tx.order.update({
//           where: { id: body.fromOrderId },
//           data: { kotStatus: "PREPARING" },
//           include: { items: true },
//         });
//       } else {
//         const orderNumber = await nextOrderNumber();
//         order = await tx.order.create({
//           data: {
//             orderNumber,
//             orderType: body.orderType,
//             source: body.source ?? "POS",
//             tableId: body.orderType === "DINEIN" ? body.tableId ?? null : null,
//             notes: body.notes,
//             kotStatus: "NEW",
//             items: {
//               create: computed.lines.map((l) => ({
//                 menuItemId: l.menuItemId,
//                 name: l.name,
//                 price: l.price,
//                 quantity: l.quantity,
//                 gstPercent: l.gstPercent,
//                 discount: l.discount ?? 0,
//                 notes: l.notes,
//               })),
//             },
//           },
//           include: { items: true },
//         });
//       }

//       if (body.orderType === "DINEIN" && body.tableId) {
//         await tx.table.update({ where: { id: body.tableId }, data: { status: "OCCUPIED" } });
//       }

//       const payCash = body.payment.method === "CASH" ? computed.grandTotal :
//         body.payment.method === "SPLIT" ? Number(body.payment.cash ?? 0) : 0;
//       const payUpi = body.payment.method === "UPI" ? computed.grandTotal :
//         body.payment.method === "SPLIT" ? Number(body.payment.upi ?? 0) : 0;
//       const payCard = body.payment.method === "CARD" ? computed.grandTotal :
//         body.payment.method === "SPLIT" ? Number(body.payment.card ?? 0) : 0;

//       if (coupon) {
//         await tx.coupon.update({
//           where: { id: coupon.id },
//           data: { usedCount: { increment: 1 } },
//         });
//       }

//       const bill = await tx.bill.create({
//         data: {
//           billNumber,
//           orderId: order.id,
//           customerId,
//           cashierId: auth.user.sub,
//           orderType: body.orderType,
//           subtotal: computed.subtotal,
//           itemDiscount: computed.itemDiscount,
//           billDiscount: computed.billDiscount,
//           cgst: computed.cgst,
//           sgst: computed.sgst,
//           totalGst: computed.totalGst,
//           packingCharge: computed.packingCharge,
//           serviceCharge: computed.serviceCharge,
//           deliveryCharge: computed.deliveryCharge,
//           roundOff: computed.roundOff,
//           grandTotal: computed.grandTotal,
//           paymentMethod: body.payment.method,
//           paymentCash: payCash,
//           paymentUpi: payUpi,
//           paymentCard: payCard,
//           couponCode: coupon?.code ?? null,
//           couponDiscount,
//           loyaltyEarned,
//           loyaltyRedeemed: redeemPoints,
//           loyaltyValue,
//           deliveryName: body.delivery?.name,
//           deliveryPhone: body.delivery?.phone,
//           deliveryAddress: body.delivery?.address,
//           deliveryPartner: body.delivery?.partner,
//         },
//         include: {
//           order: { include: { items: true, table: true } },
//           customer: true,
//           cashier: { select: { id: true, name: true } },
//         },
//       });

//       return bill;
//     });

//     await audit({
//       userId: auth.user.sub,
//       module: "BILL",
//       action: "CREATE",
//       details: { id: result.id, billNumber, grandTotal: computed.grandTotal, couponCode: coupon?.code, redeemPoints, loyaltyEarned },
//     });

//     return NextResponse.json({ bill: result });
//   } catch (e: any) {
//     console.error(e);
//     return NextResponse.json({ error: e.message || "Failed to create bill" }, { status: 500 });
//   }
// }
