import type { Role } from "./auth";

// Navigation entries each role is allowed to see/visit.
export const NAV_PERMISSIONS: Record<Role, string[]> = {
  ADMIN: [
    "dashboard",
    "pos",
    "menu",
    "tables",
    "customers",
    "bills",
    "coupons",
    "expenses",
    "inventory",
    "reports",
    "users",
    "settings",
  ],
  MANAGER: [
    "dashboard",
    "pos",
    "menu",
    "tables",
    "customers",
    "bills",
    "coupons",
    "expenses",
    "inventory",
    "reports",
  ],
  CASHIER: [
    "dashboard",
    "pos",
    "customers",
    "bills",
  ],
};

export function canAccess(role: Role, page: string): boolean {
  return NAV_PERMISSIONS[role]?.includes(page) ?? false;
}
