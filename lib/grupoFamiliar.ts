/** Plazas totales consideradas en el auto (tu grupo + pool) para EcoGuest. */
export const ECOGUEST_PLAZAS_AUTO_TOTAL = 5;

/** Más de este número de personas en la invitación ⇒ sin acceso a EcoGuest / SmartPool. */
export const ECOGUEST_MAX_PERSONAS_INVITACION = 5;

/**
 * Opciones que el admin marca al crear/editar el evento (`eventos.menus_especiales`), sin "Ninguna".
 * Invitados y anfitrión solo ven Ninguna + las elegidas para ese evento.
 */
export const MENUS_ESPECIALES_CATALOGO = [
  "Vegano/Vegetariano",
  "Sin TACC (celíaco)",
  "Sin lactosa",
  "Halal",
  "Kosher",
  "Otro",
] as const;

export const MENU_FORM_OPTIONS = ["Ninguna", ...MENUS_ESPECIALES_CATALOGO] as const;

export type MenuFormOption = (typeof MENU_FORM_OPTIONS)[number];

const ALIAS_MENUS_ESPECIALES_GUARDADOS: Record<string, (typeof MENUS_ESPECIALES_CATALOGO)[number]> = {
  "sin tacc": "Sin TACC (celíaco)",
  "sin tacc (celíaco)": "Sin TACC (celíaco)",
  "celiaco": "Sin TACC (celíaco)",
  "celíaco": "Sin TACC (celíaco)",
};

/** Alinea textos viejos en `menus_especiales` al catálogo actual (orden estable del catálogo). */
export function normalizarMenusEspecialesEvento(raw: string[] | null | undefined): string[] {
  const set = new Set<string>();
  for (const x of raw ?? []) {
    const t = String(x).trim();
    if (!t) continue;
    const lower = t.toLowerCase();
    const fromAlias = ALIAS_MENUS_ESPECIALES_GUARDADOS[lower];
    const canon =
      fromAlias ??
      (MENUS_ESPECIALES_CATALOGO as readonly string[]).find((m) => m.toLowerCase() === lower);
    if (canon) set.add(canon);
  }
  return (MENUS_ESPECIALES_CATALOGO as readonly string[]).filter((m) => set.has(m));
}

/**
 * Opciones de menú/restricción para un evento: siempre incluye "Ninguna"; luego solo especiales configurados.
 * Array vacío ⇒ solo menú estándar (sin especiales).
 */
export function menuOpcionesParaEvento(menusEspecialesEvento: string[] | null | undefined): string[] {
  const specials = normalizarMenusEspecialesEvento(menusEspecialesEvento);
  if (specials.length === 0) return ["Ninguna"];
  return ["Ninguna", ...specials];
}

export type MenuPersonaPersisted = {
  restriccion: string;
  restriccionOtro: string | null;
};

/** Invitación con N personas (1..5): plazas que el conductor puede ofrecer a pasajeros del pool (5 - N). */
export function plazasSmartpoolPasajeros(grupoCuposInvitacion: number): number {
  const n = Math.floor(Number(grupoCuposInvitacion));
  if (!Number.isFinite(n) || n < 1) return 0;
  if (n > ECOGUEST_MAX_PERSONAS_INVITACION) return 0;
  return Math.max(0, ECOGUEST_PLAZAS_AUTO_TOTAL - n);
}

export function ecoGuestPermitidoPorCuposInvitacion(grupoCuposInvitacion: number): boolean {
  const n = Math.floor(Number(grupoCuposInvitacion));
  return Number.isFinite(n) && n >= 1 && n <= ECOGUEST_MAX_PERSONAS_INVITACION;
}

/** Misma semántica que el registro histórico en `invitados.restriccion_*` (primera persona del grupo). */
export function mapUiMenuToInvitadoColumns(restriccion: string, restriccionOtro?: string | null) {
  const r = String(restriccion || "Ninguna").trim();
  const restriccion_alimentaria =
    r === "Otro" ? "otro" : r === "Ninguna" ? null : r;
  return {
    restriccion_alimentaria: restriccion_alimentaria as string | null,
    restriccion_otro: r === "Otro" ? (restriccionOtro?.trim() || null) : null,
  };
}

export function legacyRestriccionFromMenus(menus: MenuPersonaPersisted[]) {
  const first = menus[0];
  if (!first) {
    return { restriccion_alimentaria: null as string | null, restriccion_otro: null as string | null };
  }
  return mapUiMenuToInvitadoColumns(first.restriccion, first.restriccionOtro);
}

export function parseGrupoMenusJson(raw: unknown): MenuPersonaPersisted[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuPersonaPersisted[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const restriccion = typeof o.restriccion === "string" ? o.restriccion : "Ninguna";
    const restriccionOtro =
      typeof o.restriccionOtro === "string" || o.restriccionOtro === null ? (o.restriccionOtro as string | null) : null;
    out.push({ restriccion, restriccionOtro });
  }
  return out;
}

export function clampCuposMax(n: unknown, fallback = 1): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return fallback;
  return Math.min(20, Math.max(1, v));
}

export function clampPersonasConfirmadas(n: unknown, cuposMax: number): number {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(cuposMax, Math.max(1, v));
}

export function menusGrupoValidos(
  menus: unknown,
  esperados: number,
  opcionesPermitidas?: readonly string[]
): { ok: true; value: MenuPersonaPersisted[] } | { ok: false; error: string } {
  const permitidas = opcionesPermitidas ?? MENU_FORM_OPTIONS;
  const permitidasSet = new Set(permitidas);
  if (!Array.isArray(menus)) {
    return { ok: false, error: "Formato de menús inválido." };
  }
  if (menus.length !== esperados) {
    return { ok: false, error: `Tenés que indicar el menú para cada persona (${esperados} en total).` };
  }
  const value: MenuPersonaPersisted[] = [];
  for (let i = 0; i < menus.length; i++) {
    const m = menus[i];
    if (!m || typeof m !== "object") {
      return { ok: false, error: `Menú inválido para la persona ${i + 1}.` };
    }
    const o = m as Record<string, unknown>;
    const restriccion = typeof o.restriccion === "string" ? o.restriccion.trim() : "";
    if (!permitidasSet.has(restriccion)) {
      return { ok: false, error: `Opción de menú no válida (persona ${i + 1}).` };
    }
    const otroRaw = o.restriccionOtro;
    const restriccionOtro =
      typeof otroRaw === "string" ? otroRaw.trim() || null : otroRaw === null ? null : null;
    if (restriccion === "Otro" && !restriccionOtro) {
      return { ok: false, error: `Completá la restricción “Otro” para la persona ${i + 1}.` };
    }
    value.push({ restriccion, restriccionOtro });
  }
  return { ok: true, value };
}
