import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  
  try {
    const b = await req.json();
    const data: any = {};
    
    const allow = [
      "name",
      "description",
      "price",
      "mrp",
      "gstPercent",
      "hsnCode",
      "unit",
      "weight",
      "brand",
      "packaging",
      "stockQuantity",
      "minStock",
      "maxStock",
      "reorderPoint",
      "isPerishable",
      "available",
      "featured",
      "discountEligible",
      "discountPercent",
      "imageUrl",
      "categoryId",
      "sku",
      "barcode",
      "isManufactured",
      "manufacturedDate",
      "expiryDate",
      "batchNumber",
    ] as const;
    
    for (const k of allow) {
      if (b[k] !== undefined) data[k] = b[k];
    }
    
    if (data.price !== undefined) data.price = Number(data.price);
    if (data.mrp !== undefined) data.mrp = Number(data.mrp);
    if (data.gstPercent !== undefined) data.gstPercent = Number(data.gstPercent);
    if (data.weight !== undefined) data.weight = Number(data.weight);
    if (data.stockQuantity !== undefined) data.stockQuantity = Number(data.stockQuantity);
    if (data.minStock !== undefined) {
      data.minStock = Number(data.minStock);
      data.reorderPoint = Math.round(data.minStock * 0.6);
    }
    if (data.maxStock !== undefined) data.maxStock = Number(data.maxStock);
    if (data.discountPercent !== undefined) data.discountPercent = Number(data.discountPercent);
    
    if (data.manufacturedDate !== undefined) {
      data.manufacturedDate = data.manufacturedDate ? new Date(data.manufacturedDate) : null;
    }
    if (data.expiryDate !== undefined) {
      data.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
    }
    
    const item = await prisma.groceryItem.update({
      where: { id: params.id },
      data,
      include: { category: true },
    });
    
    if (b.stockQuantity !== undefined || b.minStock !== undefined || b.name !== undefined || b.unit !== undefined) {
      await prisma.inventoryItem.updateMany({
        where: { groceryItemId: params.id },
        data: {
          name: item.name,
          unit: item.unit,
          openingStock: item.stockQuantity,
          minStock: item.minStock,
        },
      });
    }
    
    await audit({
      userId: auth.user.sub,
      module: "MENU",
      action: "UPDATE",
      details: { 
        id: params.id, 
        name: item.name,
        isManufactured: item.isManufactured,
        batchNumber: item.batchNumber,
      },
    });
    
    return NextResponse.json({ item });
    
  } catch (error: any) {
    console.error("PATCH error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update product" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log(`[DELETE] Force deleting product: ${params.id}`);
    
    const auth = await requireAuth(["ADMIN", "MANAGER"]);
    if (!auth.ok) {
      console.log("[DELETE] Unauthorized");
      return auth.response;
    }
    
    // Check if product exists
    const existingItem = await prisma.groceryItem.findUnique({
      where: { id: params.id },
    });
    
    if (!existingItem) {
      console.log(`[DELETE] Product not found: ${params.id}`);
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }
    
    console.log(`[DELETE] Force deleting: ${existingItem.name} (${existingItem.sku})`);
    
    // FIRST: Delete all order items associated with this product
    console.log(`[DELETE] Deleting order items...`);
    await prisma.orderItem.deleteMany({
      where: { groceryItemId: params.id },
    });
    
    // SECOND: Delete inventory items
    console.log(`[DELETE] Deleting inventory items...`);
    await prisma.inventoryItem.deleteMany({
      where: { groceryItemId: params.id },
    });
    
    // THIRD: Delete the grocery item
    console.log(`[DELETE] Deleting product...`);
    await prisma.groceryItem.delete({
      where: { id: params.id },
    });
    
    console.log(`[DELETE] Product force deleted successfully: ${existingItem.name}`);
    
    await audit({
      userId: auth.user.sub,
      module: "MENU",
      action: "DELETE_FORCE",
      details: { 
        id: params.id,
        name: existingItem.name,
        sku: existingItem.sku,
        wasManufactured: existingItem.isManufactured,
        batchNumber: existingItem.batchNumber,
        note: "Force deleted with associated order items",
      },
    });
    
    return NextResponse.json({ 
      ok: true,
      message: "Product force deleted successfully",
      action: "deleted",
    });
    
  } catch (error: any) {
    console.error("[DELETE] Error:", error);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to delete product",
      },
      { status: 500 }
    );
  }
}



// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";
// import { audit } from "@/lib/audit";

// export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth(["ADMIN", "MANAGER"]);
//   if (!auth.ok) return auth.response;
//   const b = await req.json();
//   const data: any = {};
//   const allow = [
//     "name","subcategory","description","price","gstPercent","itemType",
//     "imageUrl","available","prepTimeMinutes","discountEligible","categoryId",
//   ] as const;
//   for (const k of allow) if (b[k] !== undefined) data[k] = b[k];
//   if (data.price !== undefined) data.price = Number(data.price);
//   if (data.gstPercent !== undefined) data.gstPercent = Number(data.gstPercent);
//   if (data.prepTimeMinutes !== undefined) data.prepTimeMinutes = Number(data.prepTimeMinutes);
//   const item = await prisma.menuItem.update({ where: { id: params.id }, data });
//   await audit({ userId: auth.user.sub, module: "MENU", action: "UPDATE", details: { id: params.id } });
//   return NextResponse.json({ item });
// }

// export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth(["ADMIN", "MANAGER"]);
//   if (!auth.ok) return auth.response;
//   await prisma.menuItem.delete({ where: { id: params.id } });
//   await audit({ userId: auth.user.sub, module: "MENU", action: "DELETE", details: { id: params.id } });
//   return NextResponse.json({ ok: true });
// }
