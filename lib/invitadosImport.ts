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

export function normalizeDniInput(dni: string | undefined | null): string {
  const t = (dni ?? "").trim();
  if (!t) return "";
  const digits = t.replace(/\D/g, "");
  return digits || t;
}
