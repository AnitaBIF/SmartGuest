"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/supabase";

export function CocinaTopBar() {
  const pathname = usePathname();
  const enReporte = pathname === "/cocina" || (pathname?.startsWith("/cocina/") && !pathname.startsWith("/cocina/configuracion"));
  const enConfig = pathname?.startsWith("/cocina/configuracion");

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#c5dece] pb-4">
      <nav className="flex gap-5 text-[13px] font-medium">
        <Link
          href="/cocina"
          className={
            enReporte && !enConfig
              ? "font-semibold text-brand"
              : "text-[#6b7280] hover:text-[#111827]"
          }
        >
          Reporte
        </Link>
        <Link
          href="/cocina/configuracion"
          className={enConfig ? "font-semibold text-brand" : "text-[#6b7280] hover:text-[#111827]"}
        >
          Configuración
        </Link>
      </nav>
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-full border border-[#c5dece] bg-white/90 px-3 py-1.5 text-[11px] font-medium text-[#6b7280] shadow-sm transition-colors hover:border-brand/35 hover:bg-[#f0f7f2] hover:text-brand"
        title="Cerrar sesión"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
