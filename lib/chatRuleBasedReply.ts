import { howAppRulesReply } from "./chatAssistantAppGuide";

/**
 * Asistente sin API de pago: respuestas a partir del JSON de contexto (misma fuente que el LLM).
 * Modo demo: menú guiado (número o toques en UI) para evitar colisiones con palabras clave libres.
 */

export type GuidedMenuOption = { value: string; label: string };

export type GuidedMenuPayload = {
  greeting: string;
  options: GuidedMenuOption[];
  /** Texto opcional debajo del menú (ej. rol en staff). */
  note?: string;
};

export type RuleBasedReplyResult = {
  reply: string;
  /** Menú de chips a mostrar después de esta respuesta (solo motor reglas). */
  guidedMenu?: GuidedMenuPayload;
};

/** Etiquetas del paso actual (misma longitud que `guidedMenu.options`). */
export function guidedMenuOptionLabels(p: GuidedMenuPayload): string[] {
  return p.options.map((o) => o.label);
}

const GREETING_MENU = "Hola, ¿qué necesitás?";

/** Menú principal: solo 2 entradas. */
const SG_TOP_CFG = "sg:top:config";
const SG_TOP_DATOS = "sg:top:datos";
/** Vuelve al menú de dos opciones (siempre presente en submenús). */
const SG_NAV_HOME = "sg:nav:home";
const LABEL_NAV_HOME = "Volver al menú principal";

/** Una sola acción: volver al menú raíz (respuestas finales con pie de navegación). */
function guidedMenuOnlyMain(note?: string): GuidedMenuPayload {
  return {
    greeting: GREETING_MENU,
    options: [{ value: SG_NAV_HOME, label: LABEL_NAV_HOME }],
    ...(note ? { note } : {}),
  };
}

function withMainBack(items: GuidedMenuOption[], note?: string): GuidedMenuPayload {
  return {
    greeting: GREETING_MENU,
    options: [...items, { value: SG_NAV_HOME, label: LABEL_NAV_HOME }],
    ...(note ? { note } : {}),
  };
}

const MENU_TOP_INVITADO: GuidedMenuPayload = {
  greeting: GREETING_MENU,
  options: [
    { value: SG_TOP_CFG, label: "Configurar" },
    { value: SG_TOP_DATOS, label: "Preguntar sobre el evento" },
  ],
};

const MENU_TOP_ANFITRION: GuidedMenuPayload = {
  greeting: GREETING_MENU,
  options: [
    { value: SG_TOP_CFG, label: "Configurar" },
    { value: SG_TOP_DATOS, label: "Preguntar sobre el evento" },
  ],
};

const MENU_TOP_ADMIN: GuidedMenuPayload = {
  greeting: GREETING_MENU,
  options: [
    { value: SG_TOP_CFG, label: "Configurar" },
    { value: SG_TOP_DATOS, label: "Ver datos del salón" },
  ],
};

const MENU_TOP_GENERAL_BASE: GuidedMenuPayload = {
  greeting: GREETING_MENU,
  options: [
    { value: SG_TOP_CFG, label: "Ayuda y configuración" },
    { value: SG_TOP_DATOS, label: "Ir a mi panel" },
  ],
};

const SUB_INV_CFG = withMainBack([
  { value: "sg:inv:cfg:portal", label: "Modificar restricción alimentaria" },
  { value: "sg:inv:cfg:smartpool", label: "¿Qué es SmartPool?" },
]);

const SUB_INV_DAT = withMainBack([
  { value: "sg:inv:dat:hor", label: "Horario y ubicación" },
  { value: "sg:inv:dat:poolmatch", label: "Match pasajero / conductor" },
  { value: "sg:inv:dat:dress", label: "Código de vestimenta" },
]);

const SUB_ANF_CFG = withMainBack([
  { value: "sg:anf:cfg:rest", label: "Menús y restricciones" },
  { value: "sg:anf:cfg:event", label: "Datos del evento y cuenta" },
  { value: "sg:anf:cfg:help", label: "Ayuda para configurar" },
]);

const SUB_ANF_DAT = withMainBack([
  { value: "sg:anf:dat:conf", label: "Invitados confirmados" },
  { value: "sg:anf:dat:rest", label: "Restricciones alimentarias" },
  { value: "sg:anf:dat:play", label: "Playlists" },
]);

const SUB_ADM_CFG = withMainBack([
  { value: "sg:adm:cfg:users", label: "Usuarios del salón" },
  { value: "sg:adm:cfg:salon", label: "Configuración del salón" },
  { value: "sg:adm:cfg:help", label: "Ayuda de la plataforma" },
]);

const SUB_ADM_DAT = withMainBack([
  { value: "sg:adm:dat:met", label: "Métricas de próximos eventos" },
  { value: "sg:adm:dat:coc", label: "Reporte de cocina" },
  { value: "sg:adm:dat:reu", label: "Reuniones programadas" },
]);

const SUB_GEN_CFG = withMainBack([{ value: "sg:gen:cfg:help", label: "Ayuda y rutas del sistema" }]);

function subGenDatWithNote(tipoLine: string): GuidedMenuPayload {
  return withMainBack(
    [
      { value: "sg:gen:dat:coc", label: "Cocina" },
      { value: "sg:gen:dat:seg", label: "Seguridad" },
      { value: "sg:gen:dat:inv", label: "Portal invitado" },
    ],
    tipoLine
  );
}

function menuTopForRol(rol: string, tipoUsuario: string): GuidedMenuPayload {
  if (rol === "conserje_del_evento") return MENU_TOP_INVITADO;
  if (rol === "asistente_anfitrion") return MENU_TOP_ANFITRION;
  if (rol === "asistente_administrador_salon") return MENU_TOP_ADMIN;
  return { ...MENU_TOP_GENERAL_BASE, note: `Tu rol: ${tipoUsuario}.` };
}

/** Menú interactivo inicial (GET /api/chat): solo 2 opciones. */
export function guidedMenuFromContext(contextJson: string): GuidedMenuPayload | null {
  try {
    const data = JSON.parse(contextJson) as Record<string, unknown>;
    const rol = String(data.rolAsistente ?? "");
    if (
      rol !== "conserje_del_evento" &&
      rol !== "asistente_anfitrion" &&
      rol !== "asistente_administrador_salon" &&
      rol !== "asistente_general"
    ) {
      return null;
    }
    const tipo = String((data.usuario as Record<string, unknown> | undefined)?.tipo ?? "usuario");
    return menuTopForRol(rol, tipo);
  } catch {
    return null;
  }
}

function menuTextFromPayload(p: GuidedMenuPayload): string {
  const lines = p.options.map((o, i) => `${i + 1}. ${o.label}`).join("\n");
  const note = p.note ? `\n\n${p.note}` : "";
  return `${p.greeting}\n\n${lines}${note}`;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function fmtLista(items: string[]): string {
  return items.filter(Boolean).map((x) => `• ${x}`).join("\n");
}

/** Volcado largo tipo digest: solo si el usuario lo pide claro (NL o frases habituales). */
function wantsFullDigest(q: string): boolean {
  if (
    hasToken(q, [
      "resumen completo",
      "pasame todo",
      "pasame toda",
      "todo el estado",
      "todos los datos",
      "todas las metricas",
      "metricas completas",
      "estado completo",
      "mostrame todo",
      "decime todo",
      "contame todo",
      "volcame",
      "volcame todo",
      "todo junto",
      "todo el detalle",
      "toda la informacion",
      "toda la info",
      "detalle completo",
      "informacion completa",
      "resumen exhaustivo",
      "resumen largo",
      "volcado completo",
      "quiero saber todo",
      "mandame todo",
      "exportar todo",
    ])
  ) {
    return true;
  }
  return false;
}

/** Substring match (solo para listas de frases largas de digest). */
function hasToken(q: string, words: string[]): boolean {
  return words.some((w) => q.includes(norm(w)));
}

/** Vuelve al menú principal: frases exactas normalizadas, sin disparar con «menú» dentro de otra oración. */
function wantsMainMenu(normLine: string): boolean {
  const t = normLine.trim();
  if (t === "") return true;
  const resets = new Set([
    "hola",
    "buenas",
    "hey",
    "menu",
    "volver",
    "opciones",
    "inicio",
    "empezar",
    "ayuda",
    "gracias",
    "chau",
    "adios",
  ]);
  return resets.has(t);
}

const MENU_FOOTER_INV = "\n\n— Volvé al menú principal con los botones de abajo o escribí «menú» / «volver» / «hola».";
const MENU_FOOTER_ANF = "\n\n— Volvé al menú principal con los botones de abajo o escribí «menú» / «volver» / «hola».";
const MENU_FOOTER_GEN = "\n\n— Volvé al menú principal con los botones de abajo o escribí «menú» / «volver» / «hola».";

/** Texto corto para digest y respuestas sobre la fila invitado. */
function legibleRestriccionInvitado(inv: Record<string, unknown> | undefined): string {
  if (!inv) return "sin dato";
  const raw = inv.restriccion_alimentaria;
  const otro = inv.restriccion_otro != null ? String(inv.restriccion_otro).trim() : "";
  if (raw == null || !String(raw).trim()) {
    return "ninguna cargada (estándar / Ninguna).";
  }
  const r = String(raw).trim();
  const rl = r.toLowerCase();
  if (rl === "otro" || rl === "otra") {
    return otro ? `Otro: ${otro}` : "Otro (sin detalle).";
  }
  return otro ? `${r} (${otro})` : r;
}

function digestOnlyFromData(data: Record<string, unknown>): string {
  const rol = String(data.rolAsistente ?? "");

  if (rol === "conserje_del_evento") {
    const inv = data.invitado as Record<string, unknown> | undefined;
    const ev = data.evento as Record<string, unknown> | undefined;
    if (!ev) return "No hay datos del evento cargados en este momento.";
    const nombreEv = String(ev.nombre ?? "Evento");
    const fecha = String(ev.fecha_legible ?? ev.fecha_iso ?? "—");
    const horario = String(ev.horario ?? "—");
    const salon = String(ev.salon ?? "—");
    const direccion = String(ev.direccion ?? "—");
    const dress = ev.dress_code != null && String(ev.dress_code).trim() ? String(ev.dress_code) : "No indicado.";
    const anfs = String(ev.anfitriones ?? "—");
    const menus = Array.isArray(ev.opciones_menu_ui)
      ? (ev.opciones_menu_ui as string[]).filter(Boolean)
      : [];
    const asist = String(inv?.asistencia ?? "pendiente");
    const mesa = inv?.mesa_numero;
    const mesaTxt =
      typeof mesa === "number" && mesa > 0 ? `Mesa asignada: ${mesa}.` : "Mesa: aún sin número (o grupo sin mesa fija).";
    const smart = inv?.rol_smartpool != null ? String(inv.rol_smartpool) : "no";
    const restrRes = legibleRestriccionInvitado(inv);
    const totConfEv =
      typeof ev.invitaciones_confirmadas_en_evento_total === "number"
        ? ev.invitaciones_confirmadas_en_evento_total
        : null;
    const lines = [
      `${nombreEv}`,
      `Cuándo: ${fecha}, a las ${horario}.`,
      `Dónde: ${salon} — ${direccion}.`,
      `Anfitriones: ${anfs}.`,
      `Dress code: ${dress}.`,
      `Asistencia registrada: ${asist}. ${mesaTxt}`,
      `Tu restricción / menú en la invitación: ${restrRes}.`,
      `SmartPool / rol: ${smart}.`,
      totConfEv != null
        ? `En el evento hay ${totConfEv} invitación(es) con asistencia confirmada en total (no se listan nombres de otros invitados acá).`
        : "",
      menus.length
        ? `Menús permitidos para elegir en el evento:\n${fmtLista(menus)}`
        : "Menús: definidos por el salón para este evento (lista detallada no disponible acá).",
    ].filter(Boolean);
    return lines.join("\n");
  }

  if (rol === "asistente_anfitrion") {
    const ev = data.evento as Record<string, unknown> | undefined;
    if (!ev) return "No hay datos del evento cargados.";
    const cont = ev.invitaciones_por_asistencia as Record<string, number> | undefined;
    const cConf = cont?.confirmado ?? 0;
    const cPen = cont?.pendiente ?? 0;
    const cRec = cont?.rechazado ?? 0;
    const tot = Number(ev.invitaciones_totales ?? 0);
    const nombre = String(ev.nombre ?? "Evento");
    const fecha = String(ev.fecha_legible ?? ev.fecha_iso ?? "—");
    const anfsEv = String(ev.anfitriones ?? "").trim();
    const cupo = ev.cant_invitados_cupo != null ? String(ev.cant_invitados_cupo) : "—";
    const menusUi = Array.isArray(ev.opciones_menu_ui)
      ? (ev.opciones_menu_ui as string[]).filter(Boolean)
      : [];
    const nombres = Array.isArray(ev.confirmados_nombres_muestra)
      ? (ev.confirmados_nombres_muestra as string[]).filter(Boolean)
      : [];
    const nombresBloque =
      nombres.length > 0
        ? `Algunos que confirmaron asistencia (muestra, hasta ${nombres.length}):\n${fmtLista(nombres)}${cConf > nombres.length ? `\n…y hay más confirmados en total (${cConf} filas con «confirmado»).` : ""}`
        : cConf > 0
          ? `Hay ${cConf} invitación(es) confirmada(s); no hay nombres en esta muestra.`
          : "Todavía nadie figura como confirmado en la lista.";

    const dressHost =
      ev.dress_code != null && String(ev.dress_code).trim() ? String(ev.dress_code) : "No indicado.";
    const menusBloque =
      menusUi.length > 1 || (menusUi.length === 1 && menusUi[0] !== "Ninguna")
        ? `Opciones de menú / restricción para invitados:\n${fmtLista(menusUi)}`
        : menusUi.length === 1
          ? "Menú para invitados: solo opción estándar («Ninguna» en restricciones; sin menús especiales configurados)."
          : "Menú: sin lista en contexto; revisá Menús / restricciones en el panel.";

    return [
      `${nombre} — ${fecha}, ${String(ev.horario ?? "")}.`,
      anfsEv ? `Anfitriones (en tarjeta de invitación): ${anfsEv}.` : "",
      `Lugar: ${String(ev.salon ?? "")}, ${String(ev.direccion ?? "")}.`,
      `Dress code: ${dressHost}.`,
      menusBloque,
      `Filas de invitación en lista: ${tot} (cupo del evento: ${cupo}).`,
      `Asistencia: confirmados ${cConf}, pendientes ${cPen}, no asisten ${cRec}.`,
      `Mesas previstas: ${String(ev.cant_mesas ?? "—")}.`,
      (() => {
        const c = ev.restricciones_cubiertos as Record<string, unknown> | undefined;
        if (!c) return "";
        const st = Number(c.estandar ?? 0);
        const ce = Number(c.celiaco ?? 0);
        const vv = Number(c.vegetariano_o_vegano ?? 0);
        const ot = Number(c.otras ?? 0);
        const invN = Number(ev.restricciones_invitaciones_con_no_estandar ?? 0);
        if (ce + vv + ot === 0) {
          return `Restricciones alimentarias (cubiertos): todos estándar según datos cargados (${st} cubierto(s) estándar).`;
        }
        return `Restricciones (cubiertos en invitaciones/grupos): ${st} estándar; ${ce} celíaco/TACC; ${vv} vegetariano/vegano; ${ot} otra(s). Filas de invitación con al menos un cubierto no estándar: ${invN}.`;
      })(),
      nombresBloque,
    ].join("\n\n");
  }

  if (rol === "asistente_administrador_salon") {
    const adm = data.administrador as Record<string, unknown> | undefined;
    const evs = Array.isArray(data.eventos_en_salon) ? (data.eventos_en_salon as Record<string, unknown>[]) : [];
    const m = data.admin_metricas as { total_eventos_futuros_en_salon?: number } | undefined;
    const salon = String(adm?.salon ?? "Tu salón");
    const dirAdm = adm?.direccion != null ? String(adm.direccion).trim() : "";
    const totalFut =
      typeof m?.total_eventos_futuros_en_salon === "number" ? m.total_eventos_futuros_en_salon : evs.length;
    const lines = evs.slice(0, 12).map((e) => {
      const n = String(e.nombre ?? "—");
      const f = String(e.fecha ?? "");
      const h = String(e.horario ?? "");
      const cup = e.cupo_invitados != null ? String(e.cupo_invitados) : "—";
      const anf = e.anfitrion != null ? String(e.anfitrion).trim() : "";
      const anfTxt = anf ? ` · ${anf}` : "";
      const cInv = e.invitaciones_confirmadas != null ? Number(e.invitaciones_confirmadas) : 0;
      const invTxt = Number.isFinite(cInv) && cInv > 0 ? ` · ${cInv} confirm.` : "";
      return `• ${n} — ${f} ${h} (cupo ${cup})${anfTxt}${invTxt}`;
    });
    return [
      salon ? `Salón: ${salon}` : "",
      dirAdm ? `Dirección: ${dirAdm}` : "",
      `Eventos futuros en el salón: ${totalFut}.`,
      lines.length ? `Agenda próxima (muestra):\n${lines.join("\n")}` : "Sin eventos futuros listados para este salón.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const usuario = data.usuario as Record<string, unknown> | undefined;
  const tipo = String(usuario?.tipo ?? "usuario");
  const orient = data.orientacion as Record<string, string> | undefined;
  return [
    `Rol: ${tipo}.`,
    orient?.jefe_cocina ? `Cocina: ${orient.jefe_cocina}` : "",
    orient?.seguridad ? `Seguridad: ${orient.seguridad}` : "",
    orient?.invitado ? `Invitado: ${orient.invitado}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function liveDataDigestForChat(contextJson: string): string {
  try {
    const data = JSON.parse(contextJson) as Record<string, unknown>;
    return digestOnlyFromData(data);
  } catch {
    return "No se pudieron leer los datos. Recargá la página.";
  }
}

function replyAnfitrionRestricciones(ev: Record<string, unknown>): string {
  const c = ev.restricciones_cubiertos as Record<string, number> | undefined;
  const st = c != null ? Number(c.estandar ?? 0) : 0;
  const ce = c != null ? Number(c.celiaco ?? 0) : 0;
  const vv = c != null ? Number(c.vegetariano_o_vegano ?? 0) : 0;
  const ot = c != null ? Number(c.otras ?? 0) : 0;
  const invN = Number(ev.restricciones_invitaciones_con_no_estandar ?? 0);
  const muestra = Array.isArray(ev.restricciones_muestra_invitaciones)
    ? (ev.restricciones_muestra_invitaciones as { nombre?: string; detalle?: string }[])
    : [];
  const totNoStd = ce + vv + ot;
  const agregado = `${invN} invitación(es) con al menos un cubierto no estándar. Cubiertos: ${st} estándar · ${ce} celíaco/TACC · ${vv} veg/vegano · ${ot} otra(s).`;
  if (totNoStd === 0) {
    const menusUi = Array.isArray(ev.opciones_menu_ui) ? (ev.opciones_menu_ui as string[]).filter(Boolean) : [];
    const ofrecen =
      menusUi.length > 1 || (menusUi.length === 1 && menusUi[0] !== "Ninguna")
        ? `Opciones configuradas al elegir:\n${fmtLista(menusUi)}`
        : "Solo opción estándar en configuración.";
    return `En la base no hay cubiertos no estándar todavía.\n\n${ofrecen}\n\nEditar opciones: Menús y restricciones (panel anfitrión).`;
  }
  const maxEj = 6;
  const ms = muestra.slice(0, maxEj);
  const sufijoMas =
    ms.length > 0 && invN > ms.length ? `\n…(+${invN - ms.length} invit. más)` : ms.length === maxEj && muestra.length > maxEj ? "\n…" : "";
  const lines =
    ms.length > 0
      ? `${ms.map((m) => `• ${String(m.nombre ?? "Invitado")}: ${String(m.detalle ?? "—")}`).join("\n")}${sufijoMas}`
      : "Sin muestra de nombres en este mensaje.";
  return `${agregado}\n\n${lines}\n\nMás: Invitados / Menús y restricciones.`;
}

function replyAnfitrionConfirmados(ev: Record<string, unknown>): string {
  const cont = ev.invitaciones_por_asistencia as Record<string, number> | undefined;
  const cConf = cont?.confirmado ?? 0;
  const nombres = Array.isArray(ev.confirmados_nombres_muestra)
    ? (ev.confirmados_nombres_muestra as string[]).filter(Boolean)
    : [];
  if (nombres.length === 0) {
    return `Tenés ${cConf} invitación(es) con asistencia confirmada (según la base ahora). No tengo nombres en la muestra de este mensaje.`;
  }
  return `Confirmados: ${cConf} fila(s). Algunos nombres (muestra, hasta ${nombres.length}):\n${fmtLista(nombres)}${cConf > nombres.length ? `\n…y puede haber más confirmados en la lista completa.` : ""}`;
}

function replyInvitadoSmartpoolMatch(data: Record<string, unknown>): string {
  const inv = data.invitado as Record<string, unknown> | undefined;
  const sm =
    inv?.smartpool_match != null && typeof inv.smartpool_match === "object"
      ? (inv.smartpool_match as Record<string, unknown>)
      : {};
  const rol = inv?.rol_smartpool != null ? String(inv.rol_smartpool) : "";
  const acepto = sm.acepto === true;
  const pareja =
    sm.pareja_nombre != null && String(sm.pareja_nombre).trim() ? String(sm.pareja_nombre).trim() : null;
  const parejaRol = sm.pareja_rol != null ? String(sm.pareja_rol) : "";
  const lleno = sm.grupo_vehiculo_lleno === true;
  const cupos = sm.cupos_max != null && typeof sm.cupos_max === "number" ? Number(sm.cupos_max) : null;
  const pasajerosV = Array.isArray(sm.pasajeros_vinculados)
    ? (sm.pasajeros_vinculados as { nombre?: string; acepto?: boolean }[])
    : [];

  const pie =
    "\n\nPara ver el mapa, coordenadas y gestionar el viaje en detalle, abrí la sección SmartPool en tu portal de invitado.";

  if (!rol || rol === "no") {
    return (
      "SmartPool: en tu invitación no tenés rol de conductor o pasajero, o no estás participando del pool todavía." + pie
    );
  }

  if (rol === "pasajero") {
    if (!pareja) {
      return (
        "SmartPool: sos pasajero pero todavía no hay un conductor vinculado a tu invitación en la base (o el vínculo no está cargado)." +
          pie
      );
    }
    const esConductor = parejaRol === "conductor";
    const parts = [
      `Tu match en SmartPool: «${pareja}»${esConductor ? " (conductor de tu grupo)." : "."}`,
      acepto
        ? "Vos: tenés aceptación confirmada en tu invitación."
        : "Vos: todavía no figura aceptación confirmada en tu invitación.",
    ];
    if (lleno) parts.push("El grupo del vehículo aparece sin cupos libres.");
    return parts.join(" ") + pie;
  }

  if (rol === "conductor") {
    if (pasajerosV.length === 0) {
      const parts = [
        "SmartPool: sos conductor y todavía no hay pasajeros vinculados a tu invitación en la base.",
        acepto ? "Tu invitación figura con aceptación registrada." : "",
      ].filter(Boolean);
      if (cupos != null && Number.isFinite(cupos)) parts.push(`Plazas pasajero configuradas para tu grupo: ${cupos}.`);
      return parts.join(" ") + pie;
    }
    const lines = pasajerosV.map((p) => {
      const n = String(p.nombre ?? "Invitado/a").trim() || "Invitado/a";
      const ok = p.acepto === true;
      return `• ${n} — ${ok ? "aceptó el match" : "pendiente de aceptación"}`;
    });
    return [
      `SmartPool: sos conductor. Pasajeros vinculados a tu invitación (${pasajerosV.length}):`,
      "",
      lines.join("\n"),
      lleno ? "\nEl grupo del vehículo aparece sin cupos libres." : "",
      cupos != null && Number.isFinite(cupos) ? `\nPlazas pasajero configuradas: ${cupos}.` : "",
      pie.trim(),
    ]
      .filter(Boolean)
      .join("\n");
  }

  return `SmartPool: rol registrado «${rol}».${pie}`;
}

function replyAnfitrionPlaylist(ev: Record<string, unknown>): string {
  const pl = ev.playlist_resumen as
    | { total?: number; muestra?: { titulo?: string; artista?: string }[] }
    | undefined;
  const total = typeof pl?.total === "number" ? pl.total : 0;
  const muestra = Array.isArray(pl?.muestra) ? pl.muestra : [];
  if (total === 0) {
    return [
      "Playlist del evento: todavía no hay canciones (ni pedidos de invitados confirmados ni entradas en la playlist).",
      "",
      "Podés sumar canciones desde la sección «Playlist» en el panel lateral del anfitrión.",
    ].join("\n");
  }
  const lines = muestra
    .map((c) => {
      const tit = String(c.titulo ?? "").trim() || "—";
      const art = String(c.artista ?? "").trim();
      return art && art !== "—" ? `• ${tit} — ${art}` : `• ${tit}`;
    })
    .join("\n");
  const mas =
    total > muestra.length
      ? `\n\n…y ${total - muestra.length} entrada(s) más (la lista completa está en la sección Playlist del panel).`
      : "";
  return [
    `Playlist del evento (${total} entrada(s), orden de carga):`,
    "",
    lines,
    mas,
    "",
    "Para editar, quitar o sumar canciones usá la sección «Playlist» en tu panel lateral.",
  ].join("\n");
}

function replyAdminMetricas(data: Record<string, unknown>): string {
  const adm = data.administrador as Record<string, unknown> | undefined;
  const m = data.admin_metricas as
    | {
        fecha_consulta_iso?: string;
        total_eventos_futuros_en_salon?: number;
        invitaciones_confirmadas_en_eventos_futuros?: number;
      }
    | undefined;
  const evs = Array.isArray(data.eventos_en_salon) ? (data.eventos_en_salon as Record<string, unknown>[]) : [];
  const salon = String(adm?.salon ?? "Tu salón");
  const dirAdm = adm?.direccion != null ? String(adm.direccion).trim() : "";

  const totalFut =
    typeof m?.total_eventos_futuros_en_salon === "number" ? m.total_eventos_futuros_en_salon : evs.length;
  const confFut =
    typeof m?.invitaciones_confirmadas_en_eventos_futuros === "number"
      ? m.invitaciones_confirmadas_en_eventos_futuros
      : 0;

  const agendaLines = evs.slice(0, 12).map((e) => {
    const n = String(e.nombre ?? "—");
    const f = String(e.fecha ?? "");
    const h = String(e.horario ?? "");
    const cup = e.cupo_invitados != null ? String(e.cupo_invitados) : "—";
    const anf = e.anfitrion != null ? String(e.anfitrion).trim() : "";
    const anfTxt = anf ? ` · ${anf}` : "";
    const cInv = e.invitaciones_confirmadas != null ? Number(e.invitaciones_confirmadas) : 0;
    const invTxt = Number.isFinite(cInv) && cInv > 0 ? ` · ${cInv} confirm.` : "";
    return `• ${n} — ${f} ${h} (cupo ${cup})${anfTxt}${invTxt}`;
  });

  const head = [
    `Salón: ${salon}${dirAdm ? `\nDirección: ${dirAdm}` : ""}`,
    `Datos al ${String(m?.fecha_consulta_iso ?? "—")} (fecha ISO del servidor).`,
    `Eventos futuros en el salón (desde hoy): ${totalFut}.`,
    `Invitaciones confirmadas en esos eventos (suma): ${confFut}.`,
  ].join("\n");

  const cuerpo =
    agendaLines.length > 0
      ? `\n\nPróximos en agenda (muestra):\n${agendaLines.join("\n")}`
      : totalFut === 0
        ? "\n\nNo hay eventos con fecha desde hoy en adelante para este salón."
        : "\n\nHay eventos futuros; la lista detallada no entró en esta muestra — revisá el panel de administración.";

  return head + cuerpo;
}

function replyAdminCocina(data: Record<string, unknown>): string {
  const c = data.admin_cocina_resumen as
    | {
        eventos_futuros_con_mesa_y_confirmados?: number;
        cubiertos_confirmados_totales?: number;
        estandar?: number;
        celiaco?: number;
        vegetariano_o_vegano?: number;
        otras?: number;
      }
    | undefined;
  const evCon =
    typeof c?.eventos_futuros_con_mesa_y_confirmados === "number" ? c.eventos_futuros_con_mesa_y_confirmados : 0;
  const tot = typeof c?.cubiertos_confirmados_totales === "number" ? c.cubiertos_confirmados_totales : 0;
  const st = typeof c?.estandar === "number" ? c.estandar : 0;
  const cel = typeof c?.celiaco === "number" ? c.celiaco : 0;
  const vv = typeof c?.vegetariano_o_vegano === "number" ? c.vegetariano_o_vegano : 0;
  const ot = typeof c?.otras === "number" ? c.otras : 0;

  if (evCon === 0 || tot === 0) {
    return [
      "Reporte de cocina (eventos futuros del salón con mesas y al menos un invitado confirmado):",
      "Por ahora no hay cubiertos confirmados para sumar en esa vista: puede que falten mesas en los eventos o que todavía no haya confirmados.",
      "",
      "Cuando haya datos, acá verás el total de cubiertos por tipo de restricción; el detalle por mesa está en el reporte de cocina del panel.",
    ].join("\n");
  }

  return [
    "Reporte de cocina — agregado de cubiertos confirmados en eventos futuros del salón (solo eventos con mesas cargadas):",
    "",
    `Eventos futuros con datos útiles para cocina: ${evCon}.`,
    `Total de cubiertos confirmados contados: ${tot}.`,
    `Desglose: ${st} estándar · ${cel} celíaco/TACC · ${vv} vegetariano/vegano · ${ot} otra(s).`,
    "",
    "El desglose por mesa y por evento lo ves en la pantalla de cocina del panel del administrador.",
  ].join("\n");
}

function replyAdminReuniones(data: Record<string, unknown>): string {
  const r = data.admin_reuniones as
    | {
        proximas?: { titulo?: string; fecha?: string; hora?: string; participantes?: string | null }[];
        total_en_lista?: number;
      }
    | undefined;
  const proximas = Array.isArray(r?.proximas) ? r.proximas : [];
  const totalLista = typeof r?.total_en_lista === "number" ? r.total_en_lista : 0;

  if (proximas.length === 0) {
    return [
      "Reuniones programadas (desde hoy): no hay citas con fecha futura cargadas a tu nombre.",
      totalLista > 0
        ? `En tu lista hay ${totalLista} reunión(es) en total (pasadas o fuera de la ventana mostrada).`
        : "",
      "",
      "Gestioná reuniones desde el panel principal del administrador.",
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines = proximas.map((x) => {
    const tit = String(x.titulo ?? "—");
    const fe = String(x.fecha ?? "");
    const ho = x.hora != null && String(x.hora).trim() ? String(x.hora).trim() : "";
    const feHo = ho ? `${fe} ${ho}` : fe;
    const part = x.participantes != null && String(x.participantes).trim() ? ` · ${String(x.participantes).trim()}` : "";
    return `• ${tit} — ${feHo}${part}`;
  });

  return [
    `Próximas reuniones (${proximas.length}):`,
    "",
    lines.join("\n"),
    "",
    `Total de reuniones en tu lista cargada: ${totalLista}.`,
  ].join("\n");
}

const BOOTSTRAP_ASSISTANT = `${GREETING_MENU}\n\nElegí una opción con los botones de abajo.`;

export function ruleBasedChatReplyMeta(contextJson: string, userMessage: string): RuleBasedReplyResult {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(contextJson) as Record<string, unknown>;
  } catch {
    return { reply: "No pude leer los datos del evento. Recargá la página e intentá de nuevo." };
  }

  const rol = String(data.rolAsistente ?? "");
  const tipoUsuario = String((data.usuario as Record<string, unknown> | undefined)?.tipo ?? "usuario");
  const raw = userMessage.trim();
  const q = norm(raw || "hola");

  const topMenu = (): GuidedMenuPayload => menuTopForRol(rol, tipoUsuario);

  if (wantsFullDigest(q)) {
    const secs = Array.isArray(data.secciones_app) ? (data.secciones_app as string[]) : [];
    const bloque = digestOnlyFromData(data);
    let reply: string;
    if (rol === "asistente_anfitrion" && secs.length) {
      reply = `Resumen completo al momento:\n\n${bloque}\n\nAtajos del panel:\n${fmtLista(secs)}`;
    } else if (rol === "asistente_administrador_salon" && secs.length) {
      reply = `Resumen completo:\n\n${bloque}\n\nAtajos del panel:\n${fmtLista(secs)}`;
    } else if (rol === "conserje_del_evento") {
      reply = `Resumen completo de tu invitación:\n\n${bloque}`;
    } else {
      reply = `Resumen completo:\n\n${bloque}`;
    }
    return { reply, guidedMenu: topMenu() };
  }

  if (raw === SG_NAV_HOME || wantsMainMenu(q)) {
    return { reply: BOOTSTRAP_ASSISTANT, guidedMenu: topMenu() };
  }

  if (rol === "conserje_del_evento") {
    const ev = data.evento as Record<string, unknown> | undefined;
    if (!ev) return { reply: "No hay datos del evento cargados.", guidedMenu: guidedMenuOnlyMain() };

    const nombreEv = String(ev.nombre ?? "Evento");
    const fecha = String(ev.fecha_legible ?? ev.fecha_iso ?? "—");
    const horario = String(ev.horario ?? "—");
    const salon = String(ev.salon ?? "—");
    const direccion = String(ev.direccion ?? "—");
    const dress = ev.dress_code != null && String(ev.dress_code).trim() ? String(ev.dress_code) : "No indicado.";

    if (raw === SG_TOP_CFG) {
      return { reply: "¿Qué querés configurar del evento?", guidedMenu: SUB_INV_CFG };
    }
    if (raw === SG_TOP_DATOS) {
      return { reply: "¿Sobre qué del evento querés saber?", guidedMenu: SUB_INV_DAT };
    }
    if (raw === "sg:inv:cfg:portal") {
      return {
        reply:
          "Para elegir tu plato y avisarnos si tenés alguna restricción alimentaria (como celiaquía, alergias o menú vegano), ingresá a Configuración en tu portal de invitado y ahí encontrarás la sección Restricciones Alimentarias para dejar todo registrado.",
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:inv:cfg:smartpool") {
      return {
        reply:
          "SmartPool es nuestra función de viajes compartidos (carpooling) exclusiva para el evento. Te permite coordinar con otros invitados que viven cerca tuyo para ir juntos al salón. Es ideal para ahorrar en transporte, encontrar lugar para estacionar más fácil y reducir la huella de carbono. ¡Podés sumarte a un auto o postular el tuyo desde tu Portal del Invitado!",
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:inv:dat:hor") {
      return {
        reply: `«${nombreEv}» — ${fecha}, ${horario}.\n\nLugar: ${salon}\nDirección: ${direccion}${MENU_FOOTER_INV}`,
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:inv:dat:poolmatch") {
      return { reply: replyInvitadoSmartpoolMatch(data), guidedMenu: guidedMenuOnlyMain() };
    }
    if (raw === "sg:inv:dat:dress") {
      return { reply: `Código de vestimenta: ${dress}${MENU_FOOTER_INV}`, guidedMenu: guidedMenuOnlyMain() };
    }

    return {
      reply: `No ubiqué la opción.\n\n${menuTextFromPayload(MENU_TOP_INVITADO)}`,
      guidedMenu: guidedMenuOnlyMain(),
    };
  }

  if (rol === "asistente_anfitrion") {
    const ev = data.evento as Record<string, unknown> | undefined;
    if (!ev) return { reply: "No hay datos del evento cargados.", guidedMenu: guidedMenuOnlyMain() };

    if (raw === SG_TOP_CFG) {
      return { reply: "¿Qué querés configurar del evento?", guidedMenu: SUB_ANF_CFG };
    }
    if (raw === SG_TOP_DATOS) {
      return { reply: "¿Qué datos del evento necesitás?", guidedMenu: SUB_ANF_DAT };
    }
    if (raw === "sg:anf:cfg:rest") {
      return {
        reply:
          "Para gestionar la comida, dirígete a la sección 'Menú' en tu panel lateral izquierdo. Allí vas a poder cargar las opciones de platos (entrada, principal, postre) y revisar el listado automático de restricciones alimentarias (celíacos, veganos, etc.) según lo que hayan marcado tus invitados.",
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:anf:cfg:event") {
      return {
        reply:
          "Para editar esta información, ve a la pestaña 'Configuración' o 'Mi Cuenta' en tu panel. Desde esa pantalla vas a poder cambiar el nombre del evento, ajustar la fecha y horario, y actualizar tu correo o contraseña.",
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:anf:cfg:help") {
      return {
        reply:
          "¡Claro! Te sugiero este orden para armar tu evento: \n1. Ve a 'Invitados' y carga tu lista.\n2. Pasa por 'Menú' para definir las comidas.\n3. Por último, entra a 'SmartSeat' para armar la distribución de las mesas.\n¿Con cuál de estos pasos querés empezar?",
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:anf:dat:conf") {
      return { reply: `${replyAnfitrionConfirmados(ev)}${MENU_FOOTER_ANF}`, guidedMenu: guidedMenuOnlyMain() };
    }
    if (raw === "sg:anf:dat:rest") {
      return { reply: `${replyAnfitrionRestricciones(ev)}${MENU_FOOTER_ANF}`, guidedMenu: guidedMenuOnlyMain() };
    }
    if (raw === "sg:anf:dat:play") {
      return { reply: replyAnfitrionPlaylist(ev), guidedMenu: guidedMenuOnlyMain() };
    }
    return {
      reply: `No ubiqué la opción.\n\n${menuTextFromPayload(MENU_TOP_ANFITRION)}`,
      guidedMenu: guidedMenuOnlyMain(),
    };
  }

  if (rol === "asistente_administrador_salon") {
    if (raw === SG_TOP_CFG) {
      return { reply: "¿Qué querés configurar del salón?", guidedMenu: SUB_ADM_CFG };
    }
    if (raw === SG_TOP_DATOS) {
      return { reply: "¿Qué datos del salón querés ver?", guidedMenu: SUB_ADM_DAT };
    }
    if (raw === "sg:adm:cfg:users") {
      return {
        reply:
          "Para gestionar tu equipo, dirígete a la sección 'Usuarios' en tu panel lateral. Allí vas a poder invitar a nuevos miembros, asignarles roles (como anfitriones o staff) y administrar sus permisos de acceso a la plataforma.",
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:adm:cfg:salon") {
      return {
        reply:
          "Para modificar los datos de tu local, ve a la pestaña 'Configuración' o 'Perfil'. Desde esa pantalla vas a poder actualizar el nombre comercial de tu salón, la dirección, la capacidad máxima y otros detalles generales.",
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:adm:cfg:help") {
      return {
        reply:
          "¡Bienvenido a tu panel de administración! Para empezar a operar, te sugiero este orden: \n1. Ve a 'Configuración del salón' para tener los datos de tu local al día.\n2. Entra a 'Usuarios' para darle acceso a tu equipo de trabajo.\n3. Revisa la pestaña de 'Reuniones' para gestionar las reservas con tus futuros anfitriones.",
        guidedMenu: guidedMenuOnlyMain(),
      };
    }
    if (raw === "sg:adm:dat:met") {
      return { reply: replyAdminMetricas(data), guidedMenu: guidedMenuOnlyMain() };
    }
    if (raw === "sg:adm:dat:coc") {
      return { reply: replyAdminCocina(data), guidedMenu: guidedMenuOnlyMain() };
    }
    if (raw === "sg:adm:dat:reu") {
      return { reply: replyAdminReuniones(data), guidedMenu: guidedMenuOnlyMain() };
    }

    return {
      reply: `No ubiqué la opción.\n\n${menuTextFromPayload(MENU_TOP_ADMIN)}`,
      guidedMenu: guidedMenuOnlyMain(),
    };
  }

  const usuario = data.usuario as Record<string, unknown> | undefined;
  const tipo = String(usuario?.tipo ?? "usuario");
  const tipoN = norm(tipo);
  const orient = data.orientacion as Record<string, string> | undefined;
  const bloqueG = [
    `Tu rol: ${tipo}.`,
    orient?.jefe_cocina ? `Cocina: ${orient.jefe_cocina}` : "",
    orient?.seguridad ? `Seguridad: ${orient.seguridad}` : "",
    orient?.invitado ? `Portal invitado: ${orient.invitado}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const genTop = (): GuidedMenuPayload => menuTopForRol("asistente_general", tipo);

  if (raw === SG_TOP_CFG) {
    return { reply: "Ayuda y rutas del sistema:", guidedMenu: SUB_GEN_CFG };
  }
  if (raw === SG_TOP_DATOS) {
    return { reply: "Elegí tu panel:", guidedMenu: subGenDatWithNote(`Tu rol: ${tipo}.`) };
  }
  if (raw === "sg:gen:cfg:help") {
    return { reply: `${howAppRulesReply("asistente_general", tipoN)}\n\n${bloqueG}${MENU_FOOTER_GEN}`, guidedMenu: guidedMenuOnlyMain(`Tu rol: ${tipo}.`) };
  }
  if (raw === "sg:gen:dat:coc") {
    return {
      reply: `${orient?.jefe_cocina ?? "Panel de cocina: /cocina"}\n\n${bloqueG}${MENU_FOOTER_GEN}`,
      guidedMenu: guidedMenuOnlyMain(`Tu rol: ${tipo}.`),
    };
  }
  if (raw === "sg:gen:dat:seg") {
    return {
      reply: `${orient?.seguridad ?? "Seguridad: validación con QR (/seguridad)."}\n\n${bloqueG}${MENU_FOOTER_GEN}`,
      guidedMenu: guidedMenuOnlyMain(`Tu rol: ${tipo}.`),
    };
  }
  if (raw === "sg:gen:dat:inv") {
    return {
      reply: `${orient?.invitado ?? "Portal: /invitado"}\n\n${bloqueG}${MENU_FOOTER_GEN}`,
      guidedMenu: guidedMenuOnlyMain(`Tu rol: ${tipo}.`),
    };
  }

  return {
    reply: `No ubiqué la opción.\n\n${menuTextFromPayload(genTop())}\n\n${bloqueG}`,
    guidedMenu: guidedMenuOnlyMain(`Tu rol: ${tipo}.`),
  };
}

export function ruleBasedChatReply(contextJson: string, userMessage: string): string {
  return ruleBasedChatReplyMeta(contextJson, userMessage).reply;
}
