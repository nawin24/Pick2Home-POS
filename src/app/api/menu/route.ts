import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Helper to generate SKU
function generateSKU(category: string, name: string): string {
  const prefix = category.substring(0, 3).toUpperCase();
  const namePart = name.substring(0, 3).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${namePart}${random}`;
}

// Helper to generate barcode
function generateBarcode(): string {
  return `890${Math.random().toString().substring(2, 11)}`;
}

// Helper to generate batch number
function generateBatchNumber(): string {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const day = String(new Date().getDate()).padStart(2, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BATCH-${year}${month}${day}-${random}`;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  
  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId");
  const q = url.searchParams.get("q");
  const lowStock = url.searchParams.get("lowStock");
  const available = url.searchParams.get("available");
  const expiring = url.searchParams.get("expiring"); // NEW: Filter expiring products

  // Build where clause
  const where: any = {};
  
  if (categoryId) {
    where.categoryId = categoryId;
  }
  
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { sku: { contains: q } },
      { brand: { contains: q } },
    ];
  }
  
  if (available === "true") {
    where.available = true;
  } else if (available === "false") {
    where.available = false;
  }
  
  if (lowStock === "true") {
    where.stockQuantity = { lte: where.minStock || 0 };
  }

  // NEW: Filter expiring products
  if (expiring === "true") {
    const today = new Date();
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    
    where.isManufactured = true;
    where.expiryDate = {
      lte: thirtyDaysLater,
      gte: today,
    };
  }

  const items = await prisma.groceryItem.findMany({
    where,
    orderBy: { name: "asc" },
    include: { category: true },
  });

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  
  const b = await req.json();
  
  // Validate required fields
  if (!b.name || !b.categoryId || b.price == null) {
    return NextResponse.json(
      { error: "name, categoryId, price required" },
      { status: 400 }
    );
  }

  // Get category for SKU generation
  const category = await prisma.category.findUnique({
    where: { id: b.categoryId },
  });

  // Generate SKU and barcode
  const sku = generateSKU(category?.name || "PRD", b.name);
  const barcode = generateBarcode();

  // NEW: Generate batch number if manufactured
  const batchNumber = b.isManufactured ? generateBatchNumber() : null;

  // NEW: Set manufacturing and expiry dates
  const manufacturedDate = b.isManufactured ? (b.manufacturedDate ? new Date(b.manufacturedDate) : new Date()) : null;
  const expiryDate = b.isManufactured ? (b.expiryDate ? new Date(b.expiryDate) : null) : null;

  const item = await prisma.groceryItem.create({
    data: {
      // Basic info
      name: b.name,
      description: b.description,
      categoryId: b.categoryId,
      
      // SKU & Barcode
      sku: b.sku || sku,
      barcode: b.barcode || barcode,
      
      // Pricing
      price: Number(b.price),
      mrp: Number(b.mrp || b.price),
      gstPercent: Number(b.gstPercent ?? 5),
      hsnCode: b.hsnCode || "",
      
      // Product details
      unit: b.unit || "pcs",
      weight: b.weight ? Number(b.weight) : null,
      brand: b.brand || "FreshMart",
      packaging: b.packaging || "standard",
      
      // Inventory
      stockQuantity: Number(b.stockQuantity ?? 0),
      minStock: Number(b.minStock ?? 0),
      reorderPoint: Number(b.minStock ? Math.round(Number(b.minStock) * 0.6) : 0),
      isPerishable: b.isPerishable ?? false,
      
      // Status
      available: b.available ?? true,
      featured: b.featured ?? false,
      discountEligible: b.discountEligible ?? true,
      discountPercent: Number(b.discountPercent ?? 0),
      
      // Image
      imageUrl: b.imageUrl || "",

      // NEW: Manufacturing & Expiry Fields
      isManufactured: b.isManufactured ?? false,
      manufacturedDate: manufacturedDate,
      expiryDate: expiryDate,
      batchNumber: batchNumber,
    },
    include: { category: true },
  });

  // Also create inventory item
  await prisma.inventoryItem.create({
    data: {
      name: item.name,
      groceryItemId: item.id,
      unit: item.unit,
      openingStock: item.stockQuantity,
      minStock: item.minStock,
    },
  });

  await audit({
    userId: auth.user.sub,
    module: "MENU",
    action: "CREATE",
    details: { 
      id: item.id, 
      name: item.name,
      isManufactured: item.isManufactured,
      batchNumber: item.batchNumber,
    },
  });

  return NextResponse.json({ item });
}

// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";
// import { audit } from "@/lib/audit";

// export async function GET(req: NextRequest) {
//   const auth = await requireAuth();
//   if (!auth.ok) return auth.response;
//   const url = new URL(req.url);
//   const categoryId = url.searchParams.get("categoryId");
//   const q = url.searchParams.get("q");
//   const items = await prisma.menuItem.findMany({
//     where: {
//       ...(categoryId ? { categoryId } : {}),
//       ...(q ? { name: { contains: q } } : {}),
//     },
//     orderBy: { name: "asc" },
//     include: { category: true },
//   });
//   return NextResponse.json({ items });
// }

// export async function POST(req: NextRequest) {
//   const auth = await requireAuth(["ADMIN", "MANAGER"]);
//   if (!auth.ok) return auth.response;
//   const b = await req.json();
//   if (!b.name || !b.categoryId || b.price == null) {
//     return NextResponse.json({ error: "name, categoryId, price required" }, { status: 400 });
//   }
//   const item = await prisma.menuItem.create({
//     data: {
//       name: b.name,
//       subcategory: b.subcategory,
//       description: b.description,
//       price: Number(b.price),
//       gstPercent: Number(b.gstPercent ?? 5),
//       itemType: b.itemType ?? "VEG",
//       imageUrl: b.imageUrl,
//       available: b.available ?? true,
//       prepTimeMinutes: Number(b.prepTimeMinutes ?? 10),
//       discountEligible: b.discountEligible ?? true,
//       categoryId: b.categoryId,
//     },
//   });
//   await audit({ userId: auth.user.sub, module: "MENU", action: "CREATE", details: { id: item.id } });
//   return NextResponse.json({ item });
// }
