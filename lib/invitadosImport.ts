import { randomUUID } from "node:crypto";

export function splitNombreCompleto(s: string): { nombre: string; apellido: string } {
  const t = s.trim().replace(/\s+/g, " ");
  if (!t) return { nombre: "Invitado", apellido: "-" };
  const parts = t.split(" ");
  if (parts.length === 1) return { nombre: parts[0]!, apellido: "-" };
  return {
    apellido: parts[parts.length - 1]!,
    nombre: parts.slice(0, -1).join(" ") || "-",
  };
}

export function generateSyntheticEmail() {
  return `pendiente.${randomUUID().replace(/-/g, "")}@import.smartguest.app`.toLowerCase();
}

export function generateImportDni() {
  return `SG${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

/** Solo dígitos para comparar / guardar DNI (quita puntos, espacios y letras). */
export function normalizeDniInput(input: string): string {
  return String(input ?? "").replace(/\D/g, "");
}

export function nombreDisplayInvitado(opts: {
  nombreUsuario?: string | null;
  pendingImportNombre?: string | null;
}): string {
  const u = opts.nombreUsuario?.trim();
  if (u) return u;
  const p = opts.pendingImportNombre?.trim();
  if (p) return p;
  return "Invitado";
}
