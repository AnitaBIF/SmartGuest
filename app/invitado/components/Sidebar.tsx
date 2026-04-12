"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { SidebarUserChip } from "@/components/SidebarUserChip";
import { logout } from "@/lib/supabase";

function Logo() {
  return (
    <span className="text-xl font-extrabold tracking-tight text-brand">
      SMART
      <span className="ml-1 font-normal text-brand" style={{ fontFamily: "var(--font-poppins)" }}>
        GUEST
      </span>
    </span>
  );
}

const NAV = [
  { href: "/invitado",               label: "Datos del Evento" },
  { href: "/invitado/smartpool",     label: "Smartpool"        },
  { href: "/invitado/qr",            label: "QR"               },
  { href: "/invitado/configuracion", label: "Configuración"    },
];

export default function Sidebar() {
  const path = usePathname();
  const [nombre, setNombre] = useState("Invitado");

  useEffect(() => {
    fetch("/api/invitado/evento")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const n = data?.usuario?.nombre;
        if (typeof n === "string" && n.trim()) setNombre(n.trim());
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => logout();

  return (
    <aside className="hidden w-64 flex-shrink-0 flex-col justify-between self-start rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-black/5 md:sticky md:top-6 md:h-[calc(100vh-3rem)] md:flex">
      <div>
        <Logo />
        <nav className="mt-8 space-y-2 text-sm">
          {NAV.map(({ href, label }) => {
            const active = path === href;
            return (
              <Link key={href} href={href}
                className={`block py-1.5 pl-1 pr-2 text-[13px] transition-colors ${active ? "font-semibold text-brand" : "text-[#111827] hover:text-brand"}`}>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <SidebarUserChip displayName={nombre} subtitle="Usuario Invitado" onLogout={handleLogout} />
    </aside>
  );
}
