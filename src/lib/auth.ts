import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { JwtPayload, verifyToken } from "./jwt";

export const AUTH_COOKIE = "pos_token";

export async function getSession(): Promise<JwtPayload | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export type Role = JwtPayload["role"];

export async function requireAuth(roles?: Role[]): Promise<
  { ok: true; user: JwtPayload } | { ok: false; response: NextResponse }
> {
  const user = await getSession();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (roles && roles.length && !roles.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
