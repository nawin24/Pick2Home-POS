import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function GET() {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;
  
  try {
    const users = await prisma.user.findMany({
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true, 
        role: true, 
        active: true, 
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(["ADMIN"]);
  if (!auth.ok) return auth.response;
  
  try {
    const body = await req.json();
    const { name, email, phone, role, password } = body;
    
    if (!name || !email || !role || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    
    if (!["ADMIN", "MANAGER", "CASHIER"].includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    
    const exists = await prisma.user.findUnique({ 
      where: { email: email.toLowerCase() } 
    });
    
    if (exists) {
      return NextResponse.json({ error: "Email already used" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    
    const user = await prisma.user.create({
      data: { 
        name, 
        email: email.toLowerCase(), 
        phone: phone || null,
        role, 
        passwordHash,
        active: true,
      },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true,
        role: true, 
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    await audit({ 
      userId: auth.user.sub, 
      module: "USER", 
      action: "CREATE", 
      details: { id: user.id, email: user.email, role } 
    });
    
    return NextResponse.json({ user });
  } catch (error: any) {
    console.error("Create user error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create user" },
      { status: 500 }
    );
  }
}



// import { NextRequest, NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import { prisma } from "@/lib/prisma";
// import { requireAuth } from "@/lib/auth";
// import { audit } from "@/lib/audit";

// export async function GET() {
//   const auth = await requireAuth(["ADMIN"]);
//   if (!auth.ok) return auth.response;
//   const users = await prisma.user.findMany({
//     select: { id: true, name: true, email: true, phone: true, role: true, active: true, createdAt: true },
//     orderBy: { createdAt: "desc" },
//   });
//   return NextResponse.json({ users });
// }

// export async function POST(req: NextRequest) {
//   const auth = await requireAuth(["ADMIN"]);
//   if (!auth.ok) return auth.response;
//   const body = await req.json();
//   const { name, email, phone, role, password } = body;
//   if (!name || !email || !role || !password) {
//     return NextResponse.json({ error: "Missing fields" }, { status: 400 });
//   }
//   if (!["ADMIN","MANAGER","CASHIER","KITCHEN"].includes(role)) {
//     return NextResponse.json({ error: "Invalid role" }, { status: 400 });
//   }
//   const exists = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
//   if (exists) return NextResponse.json({ error: "Email already used" }, { status: 409 });

//   const passwordHash = await bcrypt.hash(password, 10);
//   const user = await prisma.user.create({
//     data: { name, email: email.toLowerCase(), phone, role, passwordHash },
//     select: { id: true, name: true, email: true, role: true, active: true },
//   });
//   await audit({ userId: auth.user.sub, module: "USER", action: "CREATE", details: { id: user.id, role } });
//   return NextResponse.json({ user });
// }
