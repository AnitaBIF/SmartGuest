import { refineTituloArtistaDisplay } from "@/lib/parseCancionTituloArtista";

/**
 * Clave estable para detectar la misma canción con distinta redacción
 * (p. ej. "Crazier - Taylor Swift" vs "Crazier Taylor Swift" con artista vacío).
 */

export function normalizeSongText(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "de",
  "del",
  "la",
  "el",
  "los",
  "las",
  "y",
  "en",
  "un",
  "una",
]);

/** Une título y artista en tokens ordenados para comparar duplicados. */
export function dedupeKeyFromTituloArtista(titulo: string, artista: string): string {
  const a = (artista ?? "").trim();
  const t = (titulo ?? "").trim();
  const combined =
    !a || a === "—" ? t : `${t} ${a}`.trim();
  const tokens = normalizeSongText(combined)
    .split(/\s+/)
    .filter(Boolean)
    .filter((w) => !STOPWORDS.has(w))
    .sort();
  return tokens.join(" ");
}

export function youtubeSearchUrlForSong(titulo: string, artista: string): string {
  const a = (artista ?? "").trim();
  const t = (titulo ?? "").trim();
  const q =
    !a || a === "—" ? t : `${t} ${a}`.trim();
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export type CancionRow = {
  id: string;
  titulo: string;
  artista: string;
  created_at: string;
};

export function mergePlaylistRows(rows: CancionRow[]): {
  ids: string[];
  titulo: string;
  artista: string;
  createdAt: string;
}[] {
  const groups = new Map<string, CancionRow[]>();
  for (const r of rows) {
    const k = dedupeKeyFromTituloArtista(r.titulo, r.artista);
    const list = groups.get(k) ?? [];
    list.push(r);
    groups.set(k, list);
  }

  const out: { ids: string[]; titulo: string; artista: string; createdAt: string }[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const withArtist = group.find((r) => {
      const x = (r.artista ?? "").trim();
      return x && x !== "—";
    });
    const pick = withArtist ?? group[0];
    const refined = refineTituloArtistaDisplay(pick.titulo, pick.artista);
    out.push({
      ids: group.map((g) => g.id),
      titulo: refined.titulo,
      artista: refined.artista,
      createdAt: group[0].created_at,
    });
  }
  out.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return out;
}
