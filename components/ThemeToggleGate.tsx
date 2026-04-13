"use client";

import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

const PREFIXES_HIDE_FLOATING = ["/admin", "/anfitrion", "/invitado"];

/**
 * El botón flotante solo en rutas sin sidebar (login, cocina, seguridad, etc.).
 * En admin / anfitrión / invitado el tema va en el menú lateral.
 */
export function ThemeToggleGate() {
  const path = usePathname() ?? "";
  const hide = PREFIXES_HIDE_FLOATING.some((p) => path === p || path.startsWith(`${p}/`));
  if (hide) return null;
  return <ThemeToggle />;
}
