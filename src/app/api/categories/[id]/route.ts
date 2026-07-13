import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN", "MANAGER"]);
  if (!auth.ok) return auth.response;
  
  const body = await req.json();
  const data: any = {};
  
  // CHANGED: Added "icon" and "requiresManufacturing" to allowed fields
  for (const k of ["name", "icon", "sortOrder", "active", "requiresManufacturing"] as const) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  
  // Convert sortOrder to number if provided
  if (data.sortOrder !== undefined) {
    data.sortOrder = Number(data.sortOrder);
  }
  
  // Convert requiresManufacturing to boolean if provided
  if (data.requiresManufacturing !== undefined) {
    data.requiresManufacturing = Boolean(data.requiresManufacturing);
  }
  
  const category = await prisma.category.update({ 
    where: { id: params.id }, 
    data 
  });
  
  await audit({
    userId: auth.user.sub,
    module: "CATEGORY",
    action: "UPDATE",
    details: { 
      id: category.id, 
      name: category.name,
      requiresManufacturing: category.requiresManufacturing,
    },
  });
  
  return NextResponse.json({ category });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;
  
  // CHANGED: menuItem → groceryItem
  const count = await prisma.groceryItem.count({ 
    where: { categoryId: params.id } 
  });
  
  if (count) {
    return NextResponse.json({ 
      error: "Cannot delete category with existing products" 
    }, { status: 409 });
  }
  
  // Get category details for audit before deleting
  const category = await prisma.category.findUnique({
    where: { id: params.id },
  });
  
  await prisma.category.delete({ 
    where: { id: params.id } 
  });
  
  await audit({
    userId: auth.user.sub,
    module: "CATEGORY",
    action: "DELETE",
    details: { id: params.id, name: category?.name },
  });
  
  return NextResponse.json({ ok: true });
}








// import { NextRequest, NextResponse } from "next/server";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";

// export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth(["ADMIN", "MANAGER"]);
//   if (!auth.ok) return auth.response;
//   const body = await req.json();
//   const data: any = {};
//   for (const k of ["name", "sortOrder", "active"] as const)
//     if (body[k] !== undefined) data[k] = body[k];
//   const category = await prisma.category.update({ where: { id: params.id }, data });
//   return NextResponse.json({ category });
// }

// export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
//   const auth = await requireAuth(["ADMIN"]);
//   if (!auth.ok) return auth.response;
//   const count = await prisma.menuItem.count({ where: { categoryId: params.id } });
//   if (count) return NextResponse.json({ error: "Category has items" }, { status: 409 });
//   await prisma.category.delete({ where: { id: params.id } });
//   return NextResponse.json({ ok: true });
// }
