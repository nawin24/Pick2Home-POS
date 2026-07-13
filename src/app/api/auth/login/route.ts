import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";
import { AUTH_COOKIE } from "@/lib/auth";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    
    const user = await prisma.user.findUnique({ 
      where: { email: String(email).toLowerCase() } 
    });
    
    if (!user || !user.active) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    const ok = await bcrypt.compare(String(password), user.passwordHash);
    if (!ok) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await signToken({
      sub: user.id,
      email: user.email,
      role: user.role as any,
      name: user.name,
    });

    // NEW: Record login history
    const userAgent = req.headers.get("user-agent") || null;
    const ipAddress = req.headers.get("x-forwarded-for") || 
                      req.headers.get("x-real-ip") || 
                      req.headers.get("cf-connecting-ip") ||
                      null;
    
    try {
      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          loginTime: new Date(),
          ipAddress: ipAddress,
          userAgent: userAgent,
          deviceInfo: userAgent ? userAgent.substring(0, 100) : null,
          sessionId: token.substring(0, 50), // Store part of token as session ID
        },
      });
    } catch (historyError) {
      console.error("Failed to record login history:", historyError);
      // Don't block login if history recording fails
    }

    await audit({ userId: user.id, module: "AUTH", action: "LOGIN" });

    const res = NextResponse.json({
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      },
    });
    
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });
    
    return res;
  } catch (e) {
    console.error("Login error:", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}



// import { NextRequest, NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import { prisma } from "@/lib/prisma";
// import { signToken } from "@/lib/jwt";
// import { AUTH_COOKIE } from "@/lib/auth";
// import { audit } from "@/lib/audit";

// export async function POST(req: NextRequest) {
//   try {
//     const { email, password } = await req.json();
//     if (!email || !password) {
//       return NextResponse.json({ error: "Email and password required" }, { status: 400 });
//     }
//     const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
//     if (!user || !user.active) {
//       return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
//     }
//     const ok = await bcrypt.compare(String(password), user.passwordHash);
//     if (!ok) return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });

//     const token = await signToken({
//       sub: user.id,
//       email: user.email,
//       role: user.role as any,
//       name: user.name,
//     });

//     await audit({ userId: user.id, module: "AUTH", action: "LOGIN" });

//     const res = NextResponse.json({
//       user: { id: user.id, name: user.name, email: user.email, role: user.role },
//     });
//     res.cookies.set(AUTH_COOKIE, token, {
//       httpOnly: true,
//       sameSite: "lax",
//       path: "/",
//       maxAge: 60 * 60 * 12,
//     });
//     return res;
//   } catch (e) {
//     console.error(e);
//     return NextResponse.json({ error: "Login failed" }, { status: 500 });
//   }
// }
