import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { 
      id: "singleton",
      // Default grocery store settings
      storeName: "Pick2Home",
      storeType: "GROCERY",
      address: "123, Main Street, City",
      phone: "+91 9876543210",
      email: "hello@freshmart.com",
      gstin: "22AAAAA0000A1Z5",
      currency: "INR",
      defaultGst: 5,
      packingCharge: 0,
      deliveryCharge: 0,
      printSize: "80mm",
      invoiceFooter: "Thank you for shopping with us!",
      loyaltyEnabled: true,
      loyaltyEarnRupees: 100,
      loyaltyRedeemValue: 1,
      loyaltyMinRedeem: 50,
      allowOnlineOrders: true,
      allowDelivery: true,
      allowCashierDiscount: true,
      allowCashierCancel: false,
      allowStockAdjustment: false,
      lowStockThreshold: 10,
      autoReorderQty: 50,
    },
  });
  return NextResponse.json({ settings });
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;
  
  const b = await req.json();
  const data: any = {};
  
  // CHANGED: Updated allowed fields for grocery
  const allow = [
    // Store info
    "storeName",        // CHANGED: was storeName
    "storeType",        // NEW
    "logoUrl",
    "address",
    "phone",
    "email",
    "gstin",
    "fssai",
    
    // Financial
    "currency",
    "defaultGst",
    "packingCharge",
    "deliveryCharge",   // NEW: was serviceCharge (removed)
    
    // Printing
    "printSize",
    "invoiceFooter",
    "paymentQrUrl",
    
    // Permissions
    "allowCashierDiscount",
    "allowCashierCancel",
    "allowStockAdjustment", // NEW
    "allowOnlineOrders",    // NEW
    "allowDelivery",        // NEW
    
    // Loyalty
    "loyaltyEnabled",
    "loyaltyEarnRupees",
    "loyaltyRedeemValue",
    "loyaltyMinRedeem",
    
    // Inventory (NEW)
    "lowStockThreshold",
    "autoReorderQty",
  ] as const;
  
  for (const k of allow) {
    if (b[k] !== undefined) data[k] = b[k];
  }
  
  // Convert number fields
  const numberFields = [
    "defaultGst",
    "packingCharge",
    "deliveryCharge",
    "loyaltyEarnRupees",
    "loyaltyRedeemValue",
    "loyaltyMinRedeem",
    "lowStockThreshold",
    "autoReorderQty",
  ] as const;
  
  for (const n of numberFields) {
    if (data[n] !== undefined) data[n] = Number(data[n]);
  }

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { 
      id: "singleton", 
      ...data,
      // Ensure required fields have defaults if not provided
      storeName: data.storeName || "Pick2Home",
      storeType: data.storeType || "GROCERY",
    },
  });
  
  await audit({ 
    userId: auth.user.sub, 
    module: "SETTINGS", 
    action: "UPDATE" 
  });
  
  return NextResponse.json({ settings });
}   
  
  
  
  
  // import { NextRequest, NextResponse } from "next/server";
  // import { prisma } from "@/lib/prisma";
  // import { requireAuth } from "@/lib/auth";
  // import { audit } from "@/lib/audit";

  // export async function GET() {
  //   const auth = await requireAuth();
  //   if (!auth.ok) return auth.response;
  //   const settings = await prisma.settings.upsert({
  //     where: { id: "singleton" },
  //     update: {},
  //     create: { id: "singleton" },
  //   });
  //   return NextResponse.json({ settings });
  // }

  // export async function PUT(req: NextRequest) {
  //   const auth = await requireAuth(["ADMIN"]);
  //   if (!auth.ok) return auth.response;
  //   const b = await req.json();
  //   const data: any = {};
  //   const allow = [
  //     "storeName","logoUrl","address","phone","email","gstin","fssai",
  //     "currency","defaultGst","packingCharge","serviceCharge","printSize",
  //     "invoiceFooter","paymentQrUrl","allowCashierDiscount","allowCashierCancel",
  //     "loyaltyEnabled","loyaltyEarnRupees","loyaltyRedeemValue","loyaltyMinRedeem",
  //   ] as const;
  //   for (const k of allow) if (b[k] !== undefined) data[k] = b[k];
  //   for (const n of ["defaultGst","packingCharge","serviceCharge","loyaltyEarnRupees","loyaltyRedeemValue","loyaltyMinRedeem"] as const)
  //     if (data[n] !== undefined) data[n] = Number(data[n]);

  //   const settings = await prisma.settings.upsert({
  //     where: { id: "singleton" },
  //     update: data,
  //     create: { id: "singleton", ...data },
  //   });
  //   await audit({ userId: auth.user.sub, module: "SETTINGS", action: "UPDATE" });
  //   return NextResponse.json({ settings });
  // }
