/** Máximo de opciones de menú estándar que el salón puede declarar en formularios. */
export const SALON_MENU_STANDARD_MAX_OPCIONES = 20;

const MIN_OPCION_LEN = 2;

/**
 * Convierte el texto guardado en `salon_menu_standard` en una lista de opciones para editar.
 * Acepta formato "1. …\\n2. …" o texto libre (una o varias líneas sin numerar).
 */
export function parseSalonMenuStandardToOpciones(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [""];
  const lines = t
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [""];
  if (lines.every((l) => /^\d+\.\s/.test(l))) {
    return lines.map((l) => l.replace(/^\d+\.\s*/, "").trim());
  }
  if (lines.length === 1) return [lines[0]];
  return lines;
}

/** Serializa las opciones tal como se guardan en BD y se muestran en eventos. */
export function formatSalonMenuStandardOpciones(opciones: string[]): string {
  return opciones.map((o, i) => `${i + 1}. ${o.trim()}`).join("\n");
}

/** Mensaje de error en español o null si es válido. */
export function validateSalonMenuStandardOpciones(opciones: string[]): string | null {
  const trimmed = opciones.map((o) => o.trim());
  if (trimmed.length === 0) {
    return "Indicá al menos una opción de menú estándar.";
  }
  if (trimmed.length > SALON_MENU_STANDARD_MAX_OPCIONES) {
    return `Como máximo ${SALON_MENU_STANDARD_MAX_OPCIONES} opciones de menú estándar.`;
  }
  if (trimmed.some((o) => o.length < MIN_OPCION_LEN)) {
    return "Completá cada opción con al menos 2 caracteres.";
  }
  if (trimmed.join(" ").length < 4) {
    return "Describí un poco más las opciones del menú estándar.";
  }
  return null;
}
