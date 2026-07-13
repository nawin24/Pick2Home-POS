import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" }, update: {}, create: { id: "singleton" },
  });

  return (
    <div className="min-h-screen">
      <Sidebar role={user.role} restaurantName={settings.restaurantName} />
      <div className="pl-60">
        <Topbar user={{ name: user.name, role: user.role }} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
