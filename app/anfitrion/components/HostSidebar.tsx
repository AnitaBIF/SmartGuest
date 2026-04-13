"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileNavDrawer, MobileNavOpenButton } from "@/components/MobileNavDrawer";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = (closeOnNavigate: boolean) => (
    <>
      <Logo />
      <nav className="mt-6 space-y-2 text-sm md:mt-8">
        {ITEMS.map(({ href, key, label }) =>
          active === key ? (
            <p key={key} className="pl-1 text-[13px] font-semibold text-brand">
              {label}
            </p>
          ) : (
            <Link
              key={key}
              href={href}
              onClick={closeOnNavigate ? () => setMenuOpen(false) : undefined}
              className="block bg-transparent py-1.5 pl-1 pr-2 text-left text-[13px] text-foreground hover:text-brand"
            >
              {label}
            </Link>
          )
        )}
      </nav>
    </>
  );

  return (
    <>
      <MobileNavOpenButton onClick={() => setMenuOpen(true)} expanded={menuOpen} />
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-8">
          <div>{navItems(true)}</div>
          <SidebarUserChip
            displayName={hostName}
            subtitle="Usuario Anfitrión"
            onLogout={() => {
              setMenuOpen(false);
              void logout();
            }}
          />
        </div>
      </MobileNavDrawer>
      <aside className="hidden w-64 flex-shrink-0 flex-col justify-between self-start rounded-3xl border border-border bg-card/95 p-6 shadow-lg ring-1 ring-[var(--ring-soft)] backdrop-blur-sm md:sticky md:top-6 md:flex md:h-[calc(100vh-3rem)]">
        <div>{navItems(false)}</div>
        <SidebarUserChip displayName={hostName} subtitle="Usuario Anfitrión" onLogout={() => void logout()} />
      </aside>
    </>
  );
}
