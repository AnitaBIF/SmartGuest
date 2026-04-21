/**
 * Guía de producto para el asistente: cómo funciona SmartGuest y rutas principales.
 * Se inyecta en el system del LLM y se usa en modo reglas para preguntas de “cómo / dónde / qué es”.
 */

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAny(q: string, words: string[]): boolean {
  return words.some((w) => q.includes(norm(w)));
}

/** Texto largo para modelos (Gemini / Groq / OpenAI): referencia única con rutas reales. */
export const CHAT_APP_GUIDE = `
## Cómo funciona SmartGuest (referencia de producto)

### Dominio 1 — Métricas y datos (prioridad absoluta)
Si el usuario pregunta por **cantidad**, **cuántos**, **confirmados**, **pendientes**, **estado**, **resumen**, **lista**, **nombres**, o nombra **invitaciones / invitados** en contexto de números o asistencia, respondé **solo con datos del JSON** (números, totales, muestras de nombres). **No** respondas con rutas \`/anfitrion/...\` ni manual de pantallas.

Si pregunta **quiénes tienen menú o restricción especial** (celíaco, vegano, etc.), usá **\`restricciones_muestra_invitaciones\`** y **\`restricciones_cubiertos\`** / **\`restricciones_invitaciones_con_no_estandar\`**; **no** confundas con la lista de **confirmados** salvo que pregunte explícitamente por asistencia confirmada.

### Dominio 2 — Soporte / “cómo hago” (solo si aplica)
Las rutas tipo \`/anfitrion/invitados\` usalas **únicamente** cuando el mensaje incluya intención de **ayuda o acción**: “cómo”, “dónde configuro”, “dónde importo”, “cómo edito”, “ayuda con”, “no sé cómo”, “importar”, “subir lista”, etc. Si solo preguntan por datos del evento, **no** ofrezcas la ruta como respuesta principal.

SmartGuest conecta **salón**, **anfitrión**, **invitados** y roles operativos (**cocina**, **seguridad**). Los datos del evento (fecha, lugar, menús, asistencias, mesas, etc.) los cargan anfitrión y salón; los invitados entran con su cuenta o enlace/QR.

### Invitado (portal /invitado)
- **Inicio**: resumen del evento, confirmación de asistencia, datos personales y grupo familiar si aplica.
- **SmartPool / EcoGuest** (/invitado/smartpool): compartir viaje; el rol (conductor/pasajero) y cupos dependen de lo que deje el anfitrión.
- **QR** (/invitado/qr): código para ingreso/validación según configure el salón.
- **Configuración** (/invitado/configuracion): menú/restricción alimentaria, teléfono, etc. El chat **no** modifica la base: para cambiar datos hay que usar esas pantallas.

### Anfitrión (/anfitrion)
- **Resumen**: estado general del evento.
- **Invitados** (/anfitrion/invitados): lista, importación, filas de invitación y asistencia.
- **Menús y restricciones** (/anfitrion/restricciones): opciones que pueden elegir los invitados al cargar restricción/menú.
- **SmartSeat** (/anfitrion/smartseat): asignación de mesas.
- **EcoGuests / SmartPool** (/anfitrion/ecoguests): pool de viajes.
- **Playlist** (/anfitrion/playlist): música del evento.
- **Configuración** (/anfitrion/configuracion): datos del evento y cuenta.

### Administrador del salón (/admin)
- **Panel** (/admin), **usuarios** (/admin/usuarios), **cocina** (/admin/cocina), **ingresos** (/admin/ingresos), **configuración** (/admin/configuracion). Todo queda acotado al salón del perfil.

### Cocina (/cocina) y Seguridad (/seguridad)
- Cocina: reportes y vistas según permisos del salón.
- Seguridad: validación de ingreso (QR / flujo del salón).

### Asistente de chat (este panel)
- Cada mensaje puede **volver a leer** datos recientes del servidor (JSON de contexto).
- Español rioplatense, **muy breve** (pocas oraciones), sin saludo corporativo: **solo** lo que preguntaron; no repitas el estado entero salvo que pidan todo el detalle o un equivalente claro en lenguaje natural.
- Si algo no está en el JSON o en esta guía, decilo y derivá a la pantalla correcta sin inventar políticas del salón.
`.trim();

/** Pregunta orientada a “cómo funciona la app / dónde hago X”, no a un dato puntual del evento. */
export function likelyHowAppQuestion(qNorm: string): boolean {
  if (
    hasAny(qNorm, [
      "horario del evento",
      "a que hora",
      "fecha del evento",
      "donde es el evento",
      "donde queda el salon",
      "dress code",
      "vestimenta del",
      "cuantos confirm",
      "cuantas confirm",
      "quienes confirm",
      "mesa asignada",
      "mi mesa",
      "restricciones aliment",
      "cuantos celiac",
      "dietas especiales en mi",
    ])
  ) {
    return false;
  }
  if (hasAny(qNorm, ["confirmo mi asistencia", "confirmar asistencia", "no voy", "cancelar asistencia"])) {
    return false;
  }
  if (
    hasAny(qNorm, [
      "invitados confirm",
      "invitaciones confirm",
      "confirmados invit",
      "cuantos invit",
      "cuantas invit",
      "lista de invitados confirm",
      "total invit",
      "cantidad invit",
      "metricas invit",
      "estado invit",
      "menus especiales",
      "menu especial",
      "hay invitados con",
      "quienes tienen",
      "tienen menu",
      "tienen menus",
    ])
  ) {
    return false;
  }
  if (hasAny(qNorm, ["donde es el", "donde es la", "donde queda el", "donde queda la"])) {
    return false;
  }
  return hasAny(qNorm, [
    "como ",
    "donde encuentro",
    "donde esta el",
    "donde esta la",
    "donde voy",
    "que es smart",
    "que es la smart",
    "para que sirve",
    "para que es",
    "importar invit",
    "exportar",
    "tutorial",
    "explicame",
    "no entiendo",
    "como funciona",
    "como usar",
    "como hago para",
    "ayuda con la app",
    "ayuda con smart",
    "pantalla de",
    "seccion de",
    "ruta /",
    "smartseat",
    "smartpool",
    "ecoguest",
    "playlist",
    "configuracion del salon",
    "usuarios del salon",
    "reporte de cocina",
    "jefe de cocina",
    "seguridad qr",
    "validar ingreso",
  ]);
}

/**
 * Intención de soporte / navegación (prioridad 2). Si es false y el mensaje habla de invitados o números, es métricas.
 */
export function isSupportOrHowQuestion(qNorm: string): boolean {
  return hasAny(qNorm, [
    "como ",
    "como hago",
    "como import",
    "como agreg",
    "como edit",
    "como config",
    "como subo",
    "como cargo",
    "donde encuentro",
    "donde import",
    "donde edit",
    "donde agreg",
    "donde configur",
    "donde veo la pantalla",
    "donde hago",
    "ayuda con",
    "tutorial",
    "no se como",
    "no se donde",
    "importar invit",
    "exportar invit",
    "subir ",
    "cargar lista",
    "agregar invit",
    "editar la lista",
    "editar invit",
    "paso a paso",
    "no entiendo como",
  ]);
}

function linesInvitado(): string {
  return [
    "**Invitado**",
    "• Portal principal: `/invitado` — ahí confirmás asistencia y ves datos del evento.",
    "• Menú / restricción / datos personales: `/invitado/configuracion`.",
    "• SmartPool (viajes): `/invitado/smartpool`.",
    "• QR para ingreso: `/invitado/qr`.",
    "Si llegás por link de invitación (`/invitado/[token]`), seguí los pasos en pantalla para asociar tu cuenta.",
  ].join("\n");
}

function linesAnfitrion(): string {
  return [
    "**Anfitrión**",
    "• Resumen y accesos: `/anfitrion`.",
    "• Lista e importación de invitados: `/anfitrion/invitados`.",
    "• Opciones de menú/restricción que ven los invitados: `/anfitrion/restricciones`.",
    "• Mesas (SmartSeat): `/anfitrion/smartseat`.",
    "• SmartPool / EcoGuests: `/anfitrion/ecoguests`.",
    "• Playlist: `/anfitrion/playlist`.",
    "• Datos del evento y cuenta: `/anfitrion/configuracion`.",
  ].join("\n");
}

function linesAdmin(): string {
  return [
    "**Administrador del salón**",
    "• Panel: `/admin` — usuarios: `/admin/usuarios`, cocina: `/admin/cocina`, ingresos: `/admin/ingresos`, datos del salón: `/admin/configuracion`.",
  ].join("\n");
}

function linesCocinaSeguridad(rol: string): string {
  const r = norm(rol);
  if (r.includes("cocina")) {
    return "**Jefe de cocina**\n• Panel de cocina: `/cocina` (y configuración si la tenés habilitada: `/cocina/configuracion`).";
  }
  if (r.includes("seguridad")) {
    return "**Seguridad**\n• Validación de ingresos con la app de seguridad del salón: `/seguridad`.";
  }
  return "";
}

/**
 * Respuesta corta “cómo funciona / dónde voy” según rol, para modo reglas.
 * `rolAsistente` es el valor de `rolAsistente` en el JSON (ej. asistente_anfitrion, conserje_del_evento).
 */
export function howAppRulesReply(rolAsistente: string, tipoUsuario: string): string {
  const ra = norm(rolAsistente);
  const tu = norm(tipoUsuario);

  const head = "Guía rápida (el chat no modifica datos). ";

  if (ra === "conserje_del_evento" || tu === "invitado") {
    return `${head}\n\n${linesInvitado()}`;
  }
  if (ra === "asistente_anfitrion" || tu === "anfitrion") {
    return `${head}\n\n${linesAnfitrion()}`;
  }
  if (ra === "asistente_administrador_salon" || tu === "administrador") {
    return `${head}\n\n${linesAdmin()}`;
  }
  const cs = linesCocinaSeguridad(tipoUsuario);
  if (cs) return `${head}\n\n${cs}`;
  return `${head}\n\n${linesInvitado()}\n\n${linesAnfitrion()}\n\n${linesAdmin()}`;
}
