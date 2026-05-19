import { clampCuposMax } from "@/lib/grupoFamiliar";

/** Clave estable para agrupar filas del Excel (misma familia = mismo texto en «Grupo»). */
export function normalizeGrupoImportKey(grupo: string): string {
  return grupo.trim().replace(/\s+/g, " ").toLowerCase();
}

export type GuestLikeForGrupoCollapse = {
  nombreCompleto: string;
  celular: string;
  grupo: string;
  rangoEtario: string;
  grupoCuposMax?: number;
  rowNumber?: number;
};

export type GrupoFusionadoMeta = {
  /** Filas del Excel que se unificaron en una invitación. */
  filas: number[];
  cuposEfectivos: number;
  grupoOriginal: string;
};

export type CollapseGuestsResult<T extends GuestLikeForGrupoCollapse> = {
  collapsed: T[];
  gruposFusionados: GrupoFusionadoMeta[];
};

/**
 * Varias filas con el mismo «Grupo» (mismo texto, ignorando mayúsculas y espacios extra)
 * representan una sola invitación familiar: se fusionan en una fila.
 *
 * Cupos efectivos:
 * - Si hay algún valor en columna Cupos: max(esos valores, cantidad de filas del grupo).
 * - Si no hay ningún cupo explícito: cantidad de filas (= personas listadas).
 */
export function collapseGuestsByGrupoForImport<T extends GuestLikeForGrupoCollapse>(
  rows: T[],
): CollapseGuestsResult<T> {
  const buckets = new Map<string, T[]>();
  for (const r of rows) {
    const k = normalizeGrupoImportKey(r.grupo);
    if (!k) continue;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }

  const collapsed: T[] = [];
  const gruposFusionados: GrupoFusionadoMeta[] = [];

  for (const [, list] of buckets) {
    if (list.length === 0) continue;
    list.sort((a, b) => (a.rowNumber ?? 0) - (b.rowNumber ?? 0));
    const primary = list[0]!;
    const filas = list.map((x) => x.rowNumber).filter((x): x is number => typeof x === "number");

    const explicitNums = list
      .map((x) => x.grupoCuposMax)
      .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
      .map((x) => clampCuposMax(x, 1));

    let cuposEfectivos: number;
    if (explicitNums.length > 0) {
      const maxEx = Math.max(...explicitNums);
      cuposEfectivos = Math.max(maxEx, list.length);
    } else {
      cuposEfectivos = list.length;
    }

    if (list.length > 1) {
      gruposFusionados.push({
        filas,
        cuposEfectivos,
        grupoOriginal: primary.grupo.trim(),
      });
    }

    collapsed.push({
      ...primary,
      grupoCuposMax: cuposEfectivos,
      rowNumber: primary.rowNumber,
    });
  }

  return { collapsed, gruposFusionados };
}

/** Suma cupos reservados por invitación en el evento (personas máx. por grupo familiar). */
export function sumCuposDesdeFilasInvitados(rows: { grupo_cupos_max?: number | null }[]): number {
  return rows.reduce((acc, r) => acc + clampCuposMax(r.grupo_cupos_max, 1), 0);
}
