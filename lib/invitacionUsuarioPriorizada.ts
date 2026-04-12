import type { SupabaseClient } from "@supabase/supabase-js";
import { clampCuposMax, plazasSmartpoolPasajeros } from "@/lib/grupoFamiliar";

/** Columnas necesarias para SmartPool y contexto de invitación. */
export const INVITADO_SMARTPOOL_SELECT =
  "id, usuario_id, evento_id, rol_smartpool, smartpool_pareja_invitado_id, smartpool_acepto, smartpool_cupos_max, smartpool_grupo_vehiculo_lleno, grupo_cupos_max, grupo_personas_confirmadas, telefono, direccion, localidad, created_at";

/** Misma fila sin `smartpool_cupos_max` (BD antes de migración 009). */
const INVITADO_SMARTPOOL_SELECT_SIN_CUPOS =
  "id, usuario_id, evento_id, rol_smartpool, smartpool_pareja_invitado_id, smartpool_acepto, telefono, direccion, localidad, created_at";

const INVITADO_SMARTPOOL_SELECT_SIN_GRUPO_FAMILIAR =
  "id, usuario_id, evento_id, rol_smartpool, smartpool_pareja_invitado_id, smartpool_acepto, smartpool_cupos_max, grupo_cupos_max, telefono, direccion, localidad, created_at";

export type InvitadoSmartpoolRow = {
  id: string;
  usuario_id: string;
  evento_id: string;
  rol_smartpool: string | null;
  smartpool_pareja_invitado_id: string | null;
  smartpool_acepto: boolean;
  /** Máximo de pasajeros; default en BD 4. Puede faltar si la columna aún no existe. */
  smartpool_cupos_max?: number | null;
  smartpool_grupo_vehiculo_lleno?: boolean;
  grupo_cupos_max?: number | null;
  grupo_personas_confirmadas?: number | null;
  telefono: string | null;
  direccion: string | null;
  localidad: string | null;
  created_at: string;
};

function isMissingColumnError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return err.code === "42703" || m.includes("column") || m.includes("does not exist");
}

function fechaTs(iso: string) {
  const t = Date.parse(`${iso}T12:00:00`);
  return Number.isFinite(t) ? t : 0;
}

export type FetchInvitacionOptions = {
  /** Si viene de la UI (mismo evento que `/api/invitado/evento`), fija esa fila aunque haya otras invitaciones. */
  eventoId?: string | null;
};

/** Orden: evento con fecha más reciente; desempate `created_at` desc. */
function pickInvitacionPorFechaEvento(
  rows: InvitadoSmartpoolRow[],
  fechaPorEvento: Record<string, string>
): InvitadoSmartpoolRow {
  const byCreatedDesc = (a: InvitadoSmartpoolRow, b: InvitadoSmartpoolRow) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

  const scored = rows.map((r) => ({
    r,
    fechaIso: fechaPorEvento[r.evento_id] ?? "",
  }));

  scored.sort((a, b) => {
    const ta = fechaTs(a.fechaIso);
    const tb = fechaTs(b.fechaIso);
    if (tb !== ta) return tb - ta;
    return byCreatedDesc(a.r, b.r);
  });

  return scored[0]!.r;
}

/**
 * Elige la fila `invitados` correcta cuando el usuario tiene varias invitaciones.
 *
 * Criterio único: invitación del **evento con `fecha` más reciente**; desempate `created_at` desc.
 *
 * No se prioriza “tengo rol conductor/pasajero en otra fila más nueva”: eso dejaba al conductor
 * y al pasajero en `evento_id` distintos aunque compartieran el mismo evento “principal”.
 */
function pickRowPreferringEvento(
  rows: InvitadoSmartpoolRow[],
  eventoId: string | null | undefined,
  fechaPorEvento: Record<string, string>
): InvitadoSmartpoolRow {
  const want = eventoId?.trim();
  if (want) {
    const exact = rows.find((r) => r.evento_id === want);
    if (exact) return exact;
  }
  return pickInvitacionPorFechaEvento(rows, fechaPorEvento);
}

export async function fetchInvitacionPriorizada(
  supabase: SupabaseClient,
  userId: string,
  options?: FetchInvitacionOptions
): Promise<{ row: InvitadoSmartpoolRow | null; error: string | null; parejaColumnsOk: boolean }> {
  const eventoIdPreferido = options?.eventoId;

  const r1 = await supabase
    .from("invitados")
    .select(INVITADO_SMARTPOOL_SELECT)
    .eq("usuario_id", userId);

  if (r1.error && !isMissingColumnError(r1.error)) {
    return { row: null, error: r1.error.message ?? "Error al cargar invitación", parejaColumnsOk: false };
  }

  if (r1.error && isMissingColumnError(r1.error)) {
    const r1g = await supabase
      .from("invitados")
      .select(INVITADO_SMARTPOOL_SELECT_SIN_GRUPO_FAMILIAR)
      .eq("usuario_id", userId);

    if (!r1g.error && r1g.data?.length) {
      const rowsG = (r1g.data as InvitadoSmartpoolRow[]).map((r) => {
        const n = clampCuposMax(r.grupo_cupos_max, 1);
        return {
          ...r,
          grupo_cupos_max: n,
          smartpool_grupo_vehiculo_lleno: false,
          grupo_personas_confirmadas: null,
          smartpool_cupos_max: plazasSmartpoolPasajeros(n),
        };
      });
      const eventoIdsG = [...new Set(rowsG.map((r) => r.evento_id))];
      const { data: eventosG } = await supabase.from("eventos").select("id, fecha").in("id", eventoIdsG);
      const fechaPorEventoG = Object.fromEntries((eventosG ?? []).map((e) => [e.id, e.fecha]));
      const rowG = pickRowPreferringEvento(rowsG, eventoIdPreferido, fechaPorEventoG);
      return { row: rowG, error: null, parejaColumnsOk: true };
    }

    const r1b = await supabase
      .from("invitados")
      .select(INVITADO_SMARTPOOL_SELECT_SIN_CUPOS)
      .eq("usuario_id", userId);

    if (!r1b.error && r1b.data?.length) {
      const rowsWithCupos = (r1b.data as InvitadoSmartpoolRow[]).map((r) => {
        const n = clampCuposMax(r.grupo_cupos_max, 1);
        return {
          ...r,
          grupo_cupos_max: n,
          smartpool_cupos_max: plazasSmartpoolPasajeros(n),
          smartpool_grupo_vehiculo_lleno: false,
          grupo_personas_confirmadas: null,
        };
      });
      const eventoIds = [...new Set(rowsWithCupos.map((r) => r.evento_id))];
      const { data: eventos } = await supabase.from("eventos").select("id, fecha").in("id", eventoIds);
      const fechaPorEvento = Object.fromEntries((eventos ?? []).map((e) => [e.id, e.fecha]));
      const row = pickRowPreferringEvento(rowsWithCupos, eventoIdPreferido, fechaPorEvento);
      return { row, error: null, parejaColumnsOk: true };
    }

    const r2 = await supabase
      .from("invitados")
      .select("id, usuario_id, evento_id, rol_smartpool, telefono, direccion, localidad, created_at")
      .eq("usuario_id", userId);

    if (r2.error || !(r2.data?.length)) {
      return { row: null, error: r2.error?.message ?? "No se encontró invitación", parejaColumnsOk: false };
    }

    const rows = r2.data as InvitadoSmartpoolRow[];
    const eventoIds = [...new Set(rows.map((r) => r.evento_id))];
    const { data: eventos } = await supabase.from("eventos").select("id, fecha").in("id", eventoIds);
    const fechaPorEvento = Object.fromEntries((eventos ?? []).map((e) => [e.id, e.fecha]));

    const best = pickRowPreferringEvento(rows, eventoIdPreferido, fechaPorEvento);
    const nFallback = 1;
    return {
      row: {
        ...best,
        smartpool_pareja_invitado_id: null,
        smartpool_acepto: false,
        grupo_cupos_max: nFallback,
        smartpool_cupos_max: plazasSmartpoolPasajeros(nFallback),
        smartpool_grupo_vehiculo_lleno: false,
        grupo_personas_confirmadas: null,
      },
      error: null,
      parejaColumnsOk: false,
    };
  }

  const rows = (r1.data ?? []) as InvitadoSmartpoolRow[];
  if (rows.length === 0) {
    return { row: null, error: "No se encontró invitación", parejaColumnsOk: true };
  }

  const eventoIds = [...new Set(rows.map((r) => r.evento_id))];
  const { data: eventos } = await supabase.from("eventos").select("id, fecha").in("id", eventoIds);
  const fechaPorEvento = Object.fromEntries((eventos ?? []).map((e) => [e.id, e.fecha]));

  const row = pickRowPreferringEvento(rows, eventoIdPreferido, fechaPorEvento);
  return { row, error: null, parejaColumnsOk: true };
}
