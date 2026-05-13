"use client";

import { AssistantChat } from "@/components/AssistantChat";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useSidebarCollapsed } from "@/lib/useSidebarCollapsed";
import { AdminSidebar, type AdminSidebarHighlight } from "./AdminSidebar";

function activeFromPath(path: string): AdminSidebarHighlight {
  const base = path.replace(/\/$/, "") || "/admin";
  if (base === "/admin") return "dashboard";
  const segment = base.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
  const map: Record<string, AdminSidebarHighlight> = {
    usuarios: "usuarios",
    mesas: "mesas",
    cocina: "cocina",
    ingresos: "ingresos",
    configuracion: "configuracion",
  };
  return map[segment] ?? "dashboard";
}

export function AdminHostLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const active = useMemo(() => activeFromPath(path), [path]);
  const [desktopCollapsed, setDesktopCollapsed] = useSidebarCollapsed("admin.sidebar.collapsed");

  return (
    <div className="min-h-screen text-foreground">
      <div className="flex min-h-screen w-full gap-6 px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <AdminSidebar
          active={active}
          desktopCollapsed={desktopCollapsed}
          onToggleDesktop={setDesktopCollapsed}
        />
        <div
          className={`min-w-0 flex-1 transition-[padding] duration-300 ease-out ${
            desktopCollapsed ? "md:pl-14" : "md:pl-0"
          }`}
        >
          {children}
        </div>
      </div>
      <AssistantChat />
    </div>
  );
}
