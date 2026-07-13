import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;
  
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { 
      _count: { 
        select: { 
          items: true // This now references groceryItem
        } 
      } 
    },
  });
  
  return NextResponse.json({ categories });
}

// In api/categories/route.ts

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  
  const { name, icon, sortOrder, requiresManufacturing } = await req.json();
  
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }
  
  // Check for duplicate
  const existing = await prisma.category.findUnique({
    where: { name },
  });
  
  if (existing) {
    return NextResponse.json({ error: "Category already exists" }, { status: 400 });
  }
  
  const category = await prisma.category.create({ 
    data: { 
      name, 
      icon: icon || "🛒",
      sortOrder: Number(sortOrder ?? 0),
      requiresManufacturing: requiresManufacturing ?? false, // NEW
    } 
  });
  
  await audit({
    userId: auth.user.sub,
    module: "CATEGORY",
    action: "CREATE",
    details: { 
      id: category.id, 
      name: category.name,
      requiresManufacturing: category.requiresManufacturing,
    },
  });
  
  return NextResponse.json({ category });
}





// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";

// export async function GET() {
//   const auth = await requireAuth();
//   if (!auth.ok) return auth.response;
//   const categories = await prisma.category.findMany({
//     orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
//     include: { _count: { select: { items: true } } },
//   });
//   return NextResponse.json({ categories });
// }

// export async function POST(req: NextRequest) {
//   const auth = await requireAuth(["ADMIN", "MANAGER"]);
//   if (!auth.ok) return auth.response;
//   const { name, sortOrder } = await req.json();
//   if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });
//   const c = await prisma.category.create({ data: { name, sortOrder: Number(sortOrder ?? 0) } });
//   return NextResponse.json({ category: c });
// }
