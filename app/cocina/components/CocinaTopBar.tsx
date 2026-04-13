"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/supabase";

export function CocinaTopBar() {
  const pathname = usePathname();
  const enReporte = pathname === "/cocina" || (pathname?.startsWith("/cocina/") && !pathname.startsWith("/cocina/configuracion"));
  const enConfig = pathname?.startsWith("/cocina/configuracion");

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <nav className="flex gap-5 text-[13px] font-medium">
        <Link
          href="/cocina"
          className={
            enReporte && !enConfig
              ? "font-semibold text-brand"
              : "text-muted hover:text-foreground"
          }
        >
          Reporte
        </Link>
        <Link
          href="/cocina/configuracion"
          className={enConfig ? "font-semibold text-brand" : "text-muted hover:text-foreground"}
        >
          Configuración
        </Link>
      </nav>
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-full border border-border bg-card/90 px-3 py-1.5 text-[11px] font-medium text-muted shadow-sm transition-colors hover:border-brand/35 hover:bg-card-muted hover:text-brand"
        title="Cerrar sesión"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
