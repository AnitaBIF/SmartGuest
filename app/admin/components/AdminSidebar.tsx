"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileNavDrawer, MobileNavOpenButton } from "@/components/MobileNavDrawer";
import { ThemeToggleRow } from "@/components/ThemeToggle";
import { AdminSessionFooter } from "./AdminSessionFooter";

export type AdminSidebarHighlight = "dashboard" | "usuarios" | "mesas" | "cocina" | "ingresos" | "configuracion";

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

const ITEMS: { href: string; key: AdminSidebarHighlight; label: string }[] = [
  { href: "/admin", key: "dashboard", label: "Dashboard" },
  { href: "/admin/usuarios", key: "usuarios", label: "Gestión de usuarios" },
  { href: "/admin/mesas", key: "mesas", label: "Organización de mesas" },
  { href: "/admin/cocina", key: "cocina", label: "Reporte de cocina" },
  { href: "/admin/ingresos", key: "ingresos", label: "Ingresos (QR)" },
  { href: "/admin/configuracion", key: "configuracion", label: "Configuración" },
];

export function AdminSidebar({
  active,
  desktopCollapsed = false,
  onToggleDesktop,
}: {
  active: AdminSidebarHighlight;
  desktopCollapsed?: boolean;
  onToggleDesktop?: (v: boolean) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navList = (closeOnNavigate: boolean) => (
    <nav className="mt-6 space-y-2 text-sm md:mt-8">
      {ITEMS.map(({ href, key, label }) =>
        active === key ? (
          <p key={key} className="pl-1 py-1.5 text-[13px] font-semibold text-brand">
            {label}
          </p>
        ) : (
          <Link
            key={key}
            href={href}
            prefetch
            onClick={closeOnNavigate ? () => setMenuOpen(false) : undefined}
            className="block py-1.5 pl-1 pr-2 text-[13px] text-foreground hover:text-brand"
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
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-6 print:hidden">
          <div>
            <Logo />
            {navList(true)}
            <ThemeToggleRow className="mt-6 print:hidden" />
          </div>
          <div className="print:hidden">
            <AdminSessionFooter onBeforeLogout={() => setMenuOpen(false)} />
          </div>
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
        {/* Contenedor interno con ancho fijo: evita que el texto se reflowee mientras anima el ancho. */}
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
            <ThemeToggleRow className="mt-6 print:hidden" />
          </div>
          <AdminSessionFooter />
        </div>
      </aside>
    </>
  );
}
