"use client";

import Link from "next/link";
import { SidebarUserChip } from "@/components/SidebarUserChip";
import { logout } from "@/lib/supabase";

export type HostSidebarHighlight =
  | "resumen"
  | "invitados"
  | "restricciones"
  | "smartseat"
  | "ecoguests"
  | "playlist"
  | "configuracion";

function Logo() {
  return (
    <span className="text-xl font-extrabold tracking-tight text-brand sm:text-2xl">
      SMART
      <span className="ml-1 font-normal text-brand" style={{ fontFamily: "var(--font-poppins)" }}>
        GUEST
      </span>
    </span>
  );
}

const ITEMS: { href: string; key: HostSidebarHighlight; label: string }[] = [
  { href: "/anfitrion", key: "resumen", label: "Resumen de tu evento" },
  { href: "/anfitrion/invitados", key: "invitados", label: "Gestión de Invitados" },
  { href: "/anfitrion/restricciones", key: "restricciones", label: "Restricciones Alimentarias" },
  { href: "/anfitrion/smartseat", key: "smartseat", label: "SmartSeat" },
  { href: "/anfitrion/ecoguests", key: "ecoguests", label: "EcoGuests" },
  { href: "/anfitrion/playlist", key: "playlist", label: "Playlist" },
  { href: "/anfitrion/configuracion", key: "configuracion", label: "Configuración" },
];

export function HostSidebar({
  hostName,
  active,
}: {
  hostName: string;
  active: HostSidebarHighlight;
}) {
  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col justify-between self-start rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-black/5 md:sticky md:top-6 md:h-[calc(100vh-3rem)] md:flex">
      <div>
        <Logo />
        <nav className="mt-8 space-y-2 text-sm">
          {ITEMS.map(({ href, key, label }) =>
            active === key ? (
              <p key={key} className="pl-1 text-[13px] font-semibold text-brand">
                {label}
              </p>
            ) : (
              <Link
                key={key}
                href={href}
                className="block bg-transparent py-1.5 pl-1 pr-2 text-left text-[13px] text-[#111827] hover:text-brand"
              >
                {label}
              </Link>
            )
          )}
        </nav>
      </div>
      <SidebarUserChip displayName={hostName} subtitle="Usuario Anfitrión" onLogout={() => void logout()} />
    </aside>
  );
}
