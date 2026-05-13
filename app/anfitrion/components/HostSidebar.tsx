"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileNavDrawer, MobileNavOpenButton } from "@/components/MobileNavDrawer";
import { ThemeToggleRow } from "@/components/ThemeToggle";
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
  desktopCollapsed = false,
  onToggleDesktop,
}: {
  hostName: string;
  active: HostSidebarHighlight;
  desktopCollapsed?: boolean;
  onToggleDesktop?: (v: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navList = (closeOnNavigate: boolean) => (
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
            prefetch
            onClick={closeOnNavigate ? () => setMenuOpen(false) : undefined}
            className="block bg-transparent py-1.5 pl-1 pr-2 text-left text-[13px] text-foreground hover:text-brand"
          >
            {label}
          </Link>
        )
      )}
    </nav>
  );

  return (
    <>
      <MobileNavOpenButton onClick={() => setMenuOpen(true)} expanded={menuOpen} />
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-6">
          <div>
            <Logo />
            {navList(true)}
            <ThemeToggleRow className="mt-6" />
          </div>
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

      {/* Botón flotante en desktop para reabrir la barra (fade-in cuando está cerrada). */}
      <button
        type="button"
        onClick={() => onToggleDesktop?.(false)}
        aria-label="Abrir barra lateral"
        aria-hidden={!desktopCollapsed}
        tabIndex={desktopCollapsed ? 0 : -1}
        title="Abrir barra lateral"
        className={`fixed left-3 top-4 z-40 hidden h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-brand shadow-md ring-1 ring-[var(--ring-soft)] transition-[opacity,transform] duration-300 ease-out hover:bg-card-muted md:flex print:hidden ${
          desktopCollapsed
            ? "translate-x-0 opacity-100 delay-200"
            : "pointer-events-none -translate-x-2 opacity-0"
        }`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Barra lateral con transición fluida abrir/cerrar en desktop. */}
      <aside
        aria-hidden={desktopCollapsed}
        className={`hidden flex-shrink-0 flex-col justify-between self-start overflow-hidden rounded-3xl bg-card/95 shadow-lg backdrop-blur-sm md:sticky md:top-6 md:flex md:h-[calc(100vh-3rem)] print:hidden transition-[width,margin,opacity,padding,border-width] duration-300 ease-out ${
          desktopCollapsed
            ? "pointer-events-none -mr-6 w-0 border-0 p-0 opacity-0 ring-0"
            : "mr-0 w-64 border border-border p-6 opacity-100 ring-1 ring-[var(--ring-soft)]"
        }`}
      >
        <div className="flex h-full w-52 flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-2">
              <Logo />
              {onToggleDesktop && (
                <button
                  type="button"
                  onClick={() => onToggleDesktop(true)}
                  aria-label="Cerrar barra lateral"
                  title="Cerrar barra lateral"
                  className="rounded-lg p-1.5 text-muted transition-colors hover:bg-card-muted hover:text-foreground"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
            </div>
            {navList(false)}
            <ThemeToggleRow className="mt-6" />
          </div>
          <SidebarUserChip displayName={hostName} subtitle="Usuario Anfitrión" onLogout={() => void logout()} />
        </div>
      </aside>
    </>
  );
}
