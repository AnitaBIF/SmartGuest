/** Límite superior razonable para capacidad declarada del salón (personas). */
export const SALON_CAPACIDAD_MAX_ABS = 500_000;

/**
 * Capacidad máxima del salón desde formulario / JSON.
 * Devuelve entero 1..SALON_CAPACIDAD_MAX_ABS o null si falta o es inválido.
 */
export function parseSalonCapacidadMax(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const s = typeof raw === "string" ? raw.trim() : raw;
  const n = typeof s === "number" ? s : Number(String(s).trim());
  const v = Math.floor(n);
  if (!Number.isFinite(v) || v < 1) return null;
  if (v > SALON_CAPACIDAD_MAX_ABS) return null;
  return v;
}

/** `cant_invitados` del evento no puede superar el tope del salón cuando está configurado. */
export function eventoExcedeCapacidadSalon(cantInvitados: number, salonCapacidadMax: number | null): boolean {
  if (salonCapacidadMax == null || salonCapacidadMax < 1) return false;
  return cantInvitados > salonCapacidadMax;
}
