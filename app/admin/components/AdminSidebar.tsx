"use client";

import Link from "next/link";
import { useState } from "react";
import { MobileNavDrawer, MobileNavOpenButton } from "@/components/MobileNavDrawer";
import { AdminSessionFooter } from "./AdminSessionFooter";

export type AdminSidebarHighlight = "dashboard" | "usuarios" | "cocina" | "ingresos" | "configuracion";

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
  { href: "/admin/cocina", key: "cocina", label: "Reporte de cocina" },
  { href: "/admin/ingresos", key: "ingresos", label: "Ingresos (QR)" },
  { href: "/admin/configuracion", key: "configuracion", label: "Configuración" },
];

export function AdminSidebar({ active }: { active: AdminSidebarHighlight }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = (closeOnNavigate: boolean) => (
    <>
      <Logo />
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
              onClick={closeOnNavigate ? () => setMenuOpen(false) : undefined}
              className="block py-1.5 pl-1 pr-2 text-[13px] text-foreground hover:text-brand"
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
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-8 print:hidden">
          <div>{navItems(true)}</div>
          <div className="print:hidden">
            <AdminSessionFooter onBeforeLogout={() => setMenuOpen(false)} />
          </div>
        </div>
      </MobileNavDrawer>
      <aside className="hidden w-64 flex-shrink-0 flex-col justify-between self-start rounded-3xl border border-border bg-card/95 p-6 shadow-lg ring-1 ring-[var(--ring-soft)] backdrop-blur-sm md:sticky md:top-6 md:flex md:h-[calc(100vh-3rem)] print:hidden">
        <div>{navItems(false)}</div>
        <AdminSessionFooter />
      </aside>
    </>
  );
}
