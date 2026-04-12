/**
 * Separa título y artista desde texto libre (invitados / Excel).
 * Cubre " - ", " de ", " by " y casos como "Crazier Taylor Swift" (3+ palabras → últimas 2 = artista).
 */

export function parseCancionTituloArtista(raw: string): { titulo: string; artista: string } {
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return { titulo: "", artista: "—" };

  const dash = s.match(/^(.+?)\s*[–—\-]\s*(.+)$/);
  if (dash) {
    const t = dash[1].trim();
    const a = dash[2].trim();
    if (t && a) return { titulo: t, artista: a };
  }

  const deMatch = s.match(/^(.+?)\s+de\s+(.+)$/i);
  if (deMatch) {
    const t = deMatch[1].trim();
    const a = deMatch[2].trim();
    if (t && a) return { titulo: t, artista: a };
  }

  const byMatch = s.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    const t = byMatch[1].trim();
    const a = byMatch[2].trim();
    if (t && a) return { titulo: t, artista: a };
  }

  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 3) {
    return {
      titulo: words.slice(0, -2).join(" "),
      artista: words.slice(-2).join(" "),
    };
  }

  return { titulo: s, artista: "—" };
}

/** Si ya hay artista en columna, no toca; si no, infiere desde el título. */
export function refineTituloArtistaDisplay(
  titulo: string,
  artista: string | null | undefined
): { titulo: string; artista: string } {
  const ar = (artista ?? "").trim();
  if (ar && ar !== "—") {
    return { titulo: titulo.trim(), artista: ar };
  }
  return parseCancionTituloArtista(titulo.trim());
}
