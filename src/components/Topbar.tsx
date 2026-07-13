"use client";
import { User } from "lucide-react";

export default function Topbar({ user }: { user: { name: string; role: string } }) {
  return (
    <header className="sticky top-0 z-20 h-14 bg-white border-b border-slate-100 px-6 flex items-center justify-between">
      <div className="text-sm text-slate-500">
        {new Date().toLocaleDateString("en-IN", {
          weekday: "long", day: "numeric", month: "long", year: "numeric",
        })}
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right leading-tight">
          <div className="text-sm font-medium text-slate-800">{user.name}</div>
          <div className="text-xs text-slate-500">{user.role}</div>
        </div>
        <div className="h-9 w-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
          <User size={16} />
        </div>
      </div>
    </header>
  );
}
