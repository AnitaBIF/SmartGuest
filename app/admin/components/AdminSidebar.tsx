"use client";

import Link from "next/link";
import { AdminSessionFooter } from "./AdminSessionFooter";

export type AdminSidebarHighlight = "dashboard" | "usuarios" | "cocina" | "configuracion";

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
  { href: "/admin/configuracion", key: "configuracion", label: "Configuración" },
];

export function AdminSidebar({ active }: { active: AdminSidebarHighlight }) {
  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col justify-between self-start rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-black/5 md:sticky md:top-6 md:h-[calc(100vh-3rem)] md:flex print:hidden">
      <div>
        <Logo />
        <nav className="mt-8 space-y-2 text-sm">
          {ITEMS.map(({ href, key, label }) =>
            active === key ? (
              <p key={key} className="pl-1 py-1.5 text-[13px] font-semibold text-brand">
                {label}
              </p>
            ) : (
              <Link
                key={key}
                href={href}
                className="block py-1.5 pl-1 pr-2 text-[13px] text-[#111827] hover:text-brand"
              >
                {label}
              </Link>
            )
          )}
        </nav>
      </div>
      <AdminSessionFooter />
    </aside>
  );
}
