import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { AUTH_COOKIE } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

const PUBLIC = ["/login", "/api/auth/login", "/api/integrations/online"];
const PUBLIC_PREFIX = ["/qr", "/api/qr", "/uploads"];

const PAGE_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/pos": "pos",
  "/menu": "menu",
  "/tables": "tables",
  "/customers": "customers",
  "/bills": "bills",
  "/coupons": "coupons",
  "/expenses": "expenses",
  "/inventory": "inventory",
  "/reports": "reports",
  "/users": "users",
  "/settings": "settings",
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static assets and public paths
  if (
    pathname.startsWith("/_next") ||
    pathname === "/P2H.ico" ||
    pathname === "/favicon.ico" ||
    pathname.startsWith("/public") ||
    PUBLIC.includes(pathname) ||
    PUBLIC_PREFIX.some((p) => pathname.startsWith(p))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = token ? await verifyToken(token) : null;

  // If no session, redirect to login (except for API routes)
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // If already on login page, allow it
    if (pathname === "/login") {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If user is on login page but already authenticated, redirect to dashboard
  if (pathname === "/login") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Root path redirect to dashboard
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Role gate for top-level pages
  const pageKey = PAGE_MAP[pathname.split("/").slice(0, 2).join("/")];
  if (pageKey && !canAccess(session.role, pageKey)) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|P2H.ico|favicon.ico).*)"],
};






// import { NextRequest, NextResponse } from "next/server";
// import { verifyToken } from "@/lib/jwt";
// import { AUTH_COOKIE } from "@/lib/auth";
// import { canAccess } from "@/lib/permissions";

// const PUBLIC = ["/login", "/api/auth/login", "/api/integrations/online"];
// const PUBLIC_PREFIX = ["/qr", "/api/qr", "/uploads"];

// const PAGE_MAP: Record<string, string> = {
//   "/dashboard": "dashboard",
//   "/pos": "pos",
//   // "/captain": "captain",
//   // "/kitchen": "kitchen",
//   "/menu": "menu",
//   "/tables": "tables",
//   // "/reservations": "reservations",
//   "/customers": "customers",
//   "/bills": "bills",
//   "/coupons": "coupons",
//   "/expenses": "expenses",
//   "/inventory": "inventory",
//   "/reports": "reports",
//   "/users": "users",
//   "/settings": "settings",
// };

// export async function middleware(req: NextRequest) {
//   const { pathname } = req.nextUrl;

//   if (
//     pathname.startsWith("/_next") ||
//     pathname.startsWith("/P2H.ico") ||
//     pathname.startsWith("/public") ||
//     PUBLIC.includes(pathname) ||
//     PUBLIC_PREFIX.some((p) => pathname.startsWith(p))
//   ) {
//     return NextResponse.next();
//   }

//   const token = req.cookies.get(AUTH_COOKIE)?.value;
//   const session = token ? await verifyToken(token) : null;

//   if (!session) {
//     if (pathname.startsWith("/api/")) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }
//     const url = req.nextUrl.clone();
//     url.pathname = "/login";
//     return NextResponse.redirect(url);
//   }

//   // Role gate for top-level pages.
//   const pageKey = PAGE_MAP[pathname.split("/").slice(0, 2).join("/")];
//   if (pageKey && !canAccess(session.role, pageKey)) {
//     const url = req.nextUrl.clone();
//     url.pathname = "/dashboard";
//     return NextResponse.redirect(url);
//   }

//   if (pathname === "/") {
//     const url = req.nextUrl.clone();
//     url.pathname = "/dashboard";
//     return NextResponse.redirect(url);
//   }
//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/((?!_next/static|_next/image|P2H.ico).*)"],
// };
