"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard, ShoppingCart, ChefHat, UtensilsCrossed, Grid3X3,
  Users, ReceiptText, Wallet, Boxes, BarChart3, UserCog, Settings, LogOut,
  Smartphone, CalendarCheck2, Ticket,
} from "lucide-react";
import clsx from "clsx";
import { NAV_PERMISSIONS } from "@/lib/permissions";
import type { Role } from "@/lib/auth";

type Item = { key: string; href: string; label: string; icon: React.ComponentType<any> };

const NAV: Item[] = [
  { key: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "pos", href: "/pos", label: "POS Billing", icon: ShoppingCart },
  { key: "menu", href: "/menu", label: "Products", icon: UtensilsCrossed },
  { key: "customers", href: "/customers", label: "Customers", icon: Users },
  { key: "bills", href: "/bills", label: "Bills", icon: ReceiptText },
  { key: "coupons", href: "/coupons", label: "Coupons", icon: Ticket },
  { key: "expenses", href: "/expenses", label: "Expenses", icon: Wallet },
  { key: "inventory", href: "/inventory", label: "Inventory", icon: Boxes },
  { key: "reports", href: "/reports", label: "Reports", icon: BarChart3 },
  { key: "users", href: "/users", label: "Users", icon: UserCog },
  { key: "settings", href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ role }: { role: Role; storeName?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = new Set(NAV_PERMISSIONS[role] ?? []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-60 bg-sidebar text-slate-200 flex flex-col">
      <div className="px-5 py-4 border-b border-slate-800 flex flex-col items-center">
        {/* Logo Image */}
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white/10 p-1">
           <Image
      src="/Pick2 Home Finalised Logo.ai.jpg.jpeg"
      alt="Logo"
      fill
      className="object-contain"
      priority
    />
        </div>
        <div className="text-yellow-500 font-bold text-lg leading-tight truncate mt-2">
          Pick2Home
        </div>
        <div className="text-xs text-slate-400 mt-0.5">Pick2Home POS</div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.filter((n) => allowed.has(n.key)).map((n) => {
          const active = pathname === n.href || pathname.startsWith(n.href + "/");
          const Icon = n.icon;
          return (
            <Link
              key={n.key}
              href={n.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition",
                active
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-sidebar-hover hover:text-white"
              )}
            >
              <Icon size={18} />
              <span>{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-800">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-200 hover:bg-red-600 hover:text-white transition"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </aside>
  );
}


