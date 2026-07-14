import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Public menu for guest-facing QR ordering — no auth.
export async function GET() {
  const [categories, items, settings] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.groceryItem.findMany({
      where: { available: true },
      orderBy: { name: "asc" },
      select: {
        id: true, 
        name: true, 
        description: true, 
        price: true, 
        gstPercent: true,
        // itemType: true, // ← REMOVE THIS - it doesn't exist
        imageUrl: true, 
        categoryId: true,
      },
    }),
    prisma.settings.upsert({ 
      where: { id: "singleton" }, 
      update: {}, 
      create: { id: "singleton" } 
    }),
  ]);

  return NextResponse.json({
    restaurant: {
      name: settings.storeName,
      address: settings.address,
      phone: settings.phone,
    },
    categories,
    items,
  });
}