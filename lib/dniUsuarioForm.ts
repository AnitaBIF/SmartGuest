import { randomUUID } from "node:crypto";
import { soloDigitos } from "@/lib/registroSalon";

/** Rango inclusivo para DNI argentino y variaciones habituales (sin puntos). */
const DNI_DIGITOS_MIN = 7;
const DNI_DIGITOS_MAX = 10;

function coerceAString(input: unknown): string {
  if (input == null) return "";
  if (typeof input === "number" && Number.isFinite(input)) {
    return String(Math.trunc(input));
  }
  if (typeof input === "string") return input;
  return String(input);
}

/**
 * Campo DNI del panel de usuarios: solo dígitos, sin puntos ni guiones.
 * Devuelve `null` si está vacío o no cumple longitud (no inventar valor acá).
 */
export function dniNormalizadoDesdeFormulario(input: unknown): string | null {
  const raw = coerceAString(input).trim();
  if (!raw) return null;
  const d = soloDigitos(raw);
  if (d.length < DNI_DIGITOS_MIN || d.length > DNI_DIGITOS_MAX) return null;
  if (!/^\d+$/.test(d)) return null;
  return d;
}

export function dniProvisorioUsuario(): string {
  return `SG${randomUUID().replace(/-/g, "")}`;
}

/** Para altas: DNI normalizado o identificador único si el campo va vacío / inválido. */
export function dniFinalParaAltaUsuario(input: unknown): string {
  const n = dniNormalizadoDesdeFormulario(input);
  if (n) return n;
  return dniProvisorioUsuario();
}
