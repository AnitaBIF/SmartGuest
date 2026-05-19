export type MenuCount = {
  standard: number;
  celiaco: number;
  vegVeg: number;
  otros: number;
  otrosDetalle?: string;
  /** Subtipos de “estándar” según lo elegido en cada invitación (varias opciones del salón). */
  standardBreakdown?: Record<string, number>;
};

export type Mesa = {
  id: string | number;
  numero: number;
  estado?: string;
  menus: MenuCount;
};

export type EventoCocina = {
  id: string;
  titulo: string;
  fecha: string;
  anfitriones: string;
  /** Opción de menú estándar que cargó el anfitrión para este evento (texto en BD). */
  menuStandardAnfitrion?: string | null;
  mesas: Mesa[];
};

/** Une los desgloses estándar por mesa para la tarjeta resumen del evento. */
export function mergeStandardBreakdownPorEvento(ev: EventoCocina): Record<string, number> | undefined {
  const acc: Record<string, number> = {};
  for (const m of ev.mesas) {
    const br = m.menus.standardBreakdown;
    if (!br) continue;
    for (const [k, v] of Object.entries(br)) {
      acc[k] = (acc[k] ?? 0) + v;
    }
  }
  return Object.keys(acc).length > 0 ? acc : undefined;
}
