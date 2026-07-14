import { SignJWT, jwtVerify } from "jose";

const secret = () =>
  new TextEncoder().encode(process.env.JWT_SECRET || "dev-secret-change-me");

export type JwtPayload = {
  sub: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "CASHIER" ;
  name: string;
};

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
