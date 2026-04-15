"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { AdminSidebar, type AdminSidebarHighlight } from "./AdminSidebar";

function activeFromPath(path: string): AdminSidebarHighlight {
  const base = path.replace(/\/$/, "") || "/admin";
  if (base === "/admin") return "dashboard";
  const segment = base.replace(/^\/admin\/?/, "").split("/")[0] ?? "";
  const map: Record<string, AdminSidebarHighlight> = {
    usuarios: "usuarios",
    cocina: "cocina",
    ingresos: "ingresos",
    configuracion: "configuracion",
  };
  return map[segment] ?? "dashboard";
}

export function AdminHostLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const active = useMemo(() => activeFromPath(path), [path]);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <AdminSidebar active={active} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
