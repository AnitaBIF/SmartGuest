"use client";

import { AssistantChat } from "@/components/AssistantChat";
import { PageTransition } from "@/components/PageTransition";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSidebarCollapsed } from "@/lib/useSidebarCollapsed";
import { HostSidebar, type HostSidebarHighlight } from "./HostSidebar";

function activeFromPath(path: string): HostSidebarHighlight {
  const base = path.replace(/\/$/, "") || "/anfitrion";
  if (base === "/anfitrion") return "resumen";
  const segment = base.replace(/^\/anfitrion\/?/, "").split("/")[0] ?? "";
  const map: Record<string, HostSidebarHighlight> = {
    invitados: "invitados",
    restricciones: "restricciones",
    smartseat: "smartseat",
    ecoguests: "ecoguests",
    playlist: "playlist",
    configuracion: "configuracion",
  };
  return map[segment] ?? "resumen";
}

export function AnfitrionHostLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? "";
  const active = useMemo(() => activeFromPath(path), [path]);
  const [hostName, setHostName] = useState("Anfitrión");
  const [desktopCollapsed, setDesktopCollapsed] = useSidebarCollapsed("anfitrion.sidebar.collapsed");

  useEffect(() => {
    let cancelled = false;
    const loadName = () => {
      fetch("/api/anfitrion/evento", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled || !d?.usuario?.nombre) return;
          const n = String(d.usuario.nombre).trim();
          if (n) setHostName(n);
        })
        .catch(() => {});
    };
    loadName();
    const onProfile = () => loadName();
    window.addEventListener("smartguest:anfitrion-perfil-actualizado", onProfile);
    return () => {
      cancelled = true;
      window.removeEventListener("smartguest:anfitrion-perfil-actualizado", onProfile);
    };
  }, []);

  return (
    <div className="min-h-screen text-foreground">
      <div className="flex min-h-screen w-full gap-6 px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <HostSidebar
          hostName={hostName}
          active={active}
          desktopCollapsed={desktopCollapsed}
          onToggleDesktop={setDesktopCollapsed}
        />
        <div
          className={`min-w-0 flex-1 transition-[padding] duration-300 ease-out ${
            desktopCollapsed ? "md:pl-14" : "md:pl-0"
          }`}
        >
          <PageTransition className="min-w-0 flex-1">{children}</PageTransition>
        </div>
      </div>
      <AssistantChat />
    </div>
  );
}
