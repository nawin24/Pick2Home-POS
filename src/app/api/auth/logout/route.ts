import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, getSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    
    if (user) {
      // NEW: Update logout time in login history
      try {
        // Find the most recent active session and update logout time
        await prisma.loginHistory.updateMany({
          where: {
            userId: user.sub,
            logoutTime: null,
          },
          data: {
            logoutTime: new Date(),
          },
        });
      } catch (historyError) {
        console.error("Failed to update logout history:", historyError);
      }
      
      await audit({ userId: user.sub, module: "AUTH", action: "LOGOUT" });
    }
    
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, "", { 
      maxAge: 0, 
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
    return res;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json({ error: "Logout failed" }, { status: 500 });
  }
}



// import { NextResponse } from "next/server";
// import { AUTH_COOKIE, getSession } from "@/lib/auth";
// import { audit } from "@/lib/audit";

// export async function POST() {
//   const user = await getSession();
//   if (user) await audit({ userId: user.sub, module: "AUTH", action: "LOGOUT" });
//   const res = NextResponse.json({ ok: true });
//   res.cookies.set(AUTH_COOKIE, "", { maxAge: 0, path: "/" });
//   return res;
// }
