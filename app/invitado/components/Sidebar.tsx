"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MobileNavDrawer, MobileNavOpenButton } from "@/components/MobileNavDrawer";
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/invitado/evento")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const n = data?.usuario?.nombre;
        if (typeof n === "string" && n.trim()) setNombre(n.trim());
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    setMenuOpen(false);
    logout();
  };

  const navBlock = (closeOnNavigate: boolean) => (
    <>
      <Logo />
      <nav className="mt-6 space-y-2 text-sm md:mt-8">
        {NAV.map(({ href, label }) => {
          const active = path === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={closeOnNavigate ? () => setMenuOpen(false) : undefined}
              className={`block py-1.5 pl-1 pr-2 text-[13px] transition-colors ${active ? "font-semibold text-brand" : "text-[#111827] hover:text-brand"}`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      <MobileNavOpenButton onClick={() => setMenuOpen(true)} expanded={menuOpen} />
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="flex min-h-0 flex-1 flex-col justify-between gap-8">
          <div>{navBlock(true)}</div>
          <SidebarUserChip displayName={nombre} subtitle="Usuario Invitado" onLogout={handleLogout} />
        </div>
      </MobileNavDrawer>
      <aside className="hidden w-64 flex-shrink-0 flex-col justify-between self-start rounded-3xl bg-white/90 p-6 shadow-lg ring-1 ring-black/5 md:sticky md:top-6 md:flex md:h-[calc(100vh-3rem)]">
        <div>{navBlock(false)}</div>
        <SidebarUserChip displayName={nombre} subtitle="Usuario Invitado" onLogout={() => logout()} />
      </aside>
    </>
  );
}
