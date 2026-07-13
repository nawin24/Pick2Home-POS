import { prisma } from "./prisma";

// REST-YYYYMMDD-0001 — counter resets per calendar day.
export async function nextBillNumber(): Promise<string> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `REST-${y}${m}${d}-`;

  const startOfDay = new Date(y, today.getMonth(), today.getDate());
  const endOfDay = new Date(y, today.getMonth(), today.getDate() + 1);

  const count = await prisma.bill.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  });
  return prefix + String(count + 1).padStart(4, "0");
}

export async function nextOrderNumber(): Promise<string> {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const prefix = `ORD-${y}${m}${d}-`;
  const startOfDay = new Date(y, today.getMonth(), today.getDate());
  const endOfDay = new Date(y, today.getMonth(), today.getDate() + 1);
  const count = await prisma.order.count({
    where: { createdAt: { gte: startOfDay, lt: endOfDay } },
  });
  return prefix + String(count + 1).padStart(4, "0");
}
