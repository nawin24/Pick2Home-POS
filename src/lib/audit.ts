import { prisma } from "./prisma";

export async function audit(opts: {
  userId?: string | null;
  module: string;
  action: string;
  details?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: opts.userId ?? null,
        module: opts.module,
        action: opts.action,
        details: opts.details ? JSON.stringify(opts.details) : null,
      },
    });
  } catch (err) {
    // Audit failures must never block the primary action.
    console.error("[audit] failed:", err);
  }
}
