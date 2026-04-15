"use client";

import { useCallback, useEffect, useState } from "react";
import { LeyendaObligatorios, Req } from "@/components/FormRequired";
import { youtubeSearchUrlForSong } from "@/lib/playlistSongKey";

type SongRow = {
  ids: string[];
  titulo: string;
  artista: string;
  youtubeUrl: string;
};

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

export default function PlaylistPage() {
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newArtist, setNewArtist] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/anfitrion/playlist", { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLoadError(typeof data.error === "string" ? data.error : "No se pudo cargar la playlist.");
        setSongs([]);
        return;
      }
      const list = Array.isArray(data.canciones) ? data.canciones : [];
      setSongs(
        list.map((c: SongRow & { id?: string }) => ({
          ids: Array.isArray(c.ids) ? c.ids : c.id ? [c.id] : [],
          titulo: c.titulo,
          artista: c.artista,
          youtubeUrl: typeof c.youtubeUrl === "string" ? c.youtubeUrl : "",
        }))
      );
    } catch {
      setLoadError("Error de conexión.");
      setSongs([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addSong = async () => {
    if (!newTitle.trim() || !newArtist.trim() || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/anfitrion/playlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: newTitle.trim(), artista: newArtist.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setLoadError(typeof data.error === "string" ? data.error : "No se pudo añadir.");
        return;
      }
      await load({ silent: true });
      setNewTitle("");
      setNewArtist("");
      setShowModal(false);
      setLoadError(null);
    } catch {
      setLoadError("Error de conexión al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSong = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/anfitrion/playlist/${id}`, { method: "DELETE" }))
      );
      const failed = results.find((r) => !r.ok);
      if (failed) {
        const data = await failed.json().catch(() => ({}));
        setLoadError(typeof data.error === "string" ? data.error : "No se pudo eliminar.");
        return;
      }
      const remove = new Set(ids);
      setSongs((prev) => prev.filter((s) => !s.ids.some((i) => remove.has(i))));
      setLoadError(null);
    } catch {
      setLoadError("Error de conexión al eliminar.");
    }
  };

  const exportPDF = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(45, 90, 65);
    doc.text("Playlist del Evento", 105, 20, { align: "center" });

    doc.setDrawColor(197, 216, 204);
    doc.setLineWidth(0.5);
    doc.line(15, 27, 195, 27);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(17, 24, 39);
    doc.text("#", 15, 38);
    doc.text("Canción", 24, 38);
    doc.text("Artista", 85, 38);
    doc.text("YouTube", 130, 38);

    doc.setLineWidth(0.3);
    doc.line(15, 41, 195, 41);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    songs.forEach((song, i) => {
      const y = 50 + i * 9;
      if (y > 270) return;
      if (i % 2 === 0) {
        doc.setFillColor(240, 247, 242);
        doc.rect(15, y - 4.5, 180, 8, "F");
      }
      doc.setTextColor(75, 85, 99);
      doc.text(String(i + 1), 15, y);
      doc.setTextColor(17, 24, 39);
      doc.text(doc.splitTextToSize(song.titulo, 58)[0] ?? song.titulo, 24, y);
      doc.setTextColor(55, 65, 81);
      doc.text(doc.splitTextToSize(song.artista, 40)[0] ?? song.artista, 85, y);
      const yt =
        (song.youtubeUrl && song.youtubeUrl.trim()) ||
        youtubeSearchUrlForSong(song.titulo, song.artista);
      doc.setTextColor(37, 99, 235);
      doc.textWithLink("Buscar", 130, y, { url: yt });
    });

    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(`${songs.length} canciones — SmartGuest`, 105, 285, { align: "center" });

    doc.save("playlist-evento.pdf");
  };

  return (
    <main className="min-w-0 flex-1 pb-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                disabled={loading || !!loadError}
                className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Añadir canción
              </button>
              <button
                type="button"
                onClick={exportPDF}
                disabled={songs.length === 0}
                className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-full border border-border bg-card-muted px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-card-muted/80"
              >
                Actualizar lista
              </button>
            </div>
            <h1 className="text-2xl font-bold text-brand">Playlist</h1>
          </div>

          <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-muted">
            Pedidos de invitados y canciones que agregues vos. Las que son la misma canción (aunque estén escritas distinto)
            se muestran una sola vez. Cada fila incluye un enlace a YouTube (búsqueda automática).
          </p>

          {loadError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-100">
              {loadError}
            </div>
          )}

          <hr className="mb-5 border-border" />

          <div className="overflow-hidden rounded-2xl border border-border ring-1 ring-[var(--ring-soft)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-card-muted">
                  <th className="rounded-tl-2xl px-5 py-3 text-left text-[13px] font-semibold text-foreground">Canción</th>
                  <th className="px-5 py-3 text-left text-[13px] font-semibold text-foreground">Artista</th>
                  <th className="px-5 py-3 text-left text-[13px] font-semibold text-foreground">YouTube</th>
                  <th className="rounded-tr-2xl px-5 py-3 text-right text-[13px] font-semibold text-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="bg-card px-5 py-10 text-center text-muted">
                      Cargando playlist…
                    </td>
                  </tr>
                ) : (
                  songs.map((song, i) => (
                    <tr
                      key={song.ids.join("-")}
                      className={`border-t border-border transition-colors hover:bg-card-muted/80 ${
                        i % 2 === 0 ? "bg-card" : "bg-card-muted/40"
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-foreground">{song.titulo}</td>
                      <td className="px-5 py-3 text-muted">{song.artista}</td>
                      <td className="px-5 py-3">
                        {song.youtubeUrl ? (
                          <a
                            href={song.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 dark:text-blue-400 dark:decoration-blue-600 dark:hover:text-blue-300"
                          >
                            Buscar en YouTube
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void deleteSong(song.ids)}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-muted transition-colors hover:bg-red-500/15 hover:text-red-600 dark:hover:text-red-400"
                          title={
                            song.ids.length > 1
                              ? "Quitar esta canción (varios pedidos unificados)"
                              : "Eliminar canción"
                          }
                        >
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {!loading && songs.length === 0 && !loadError && (
                  <tr>
                    <td colSpan={4} className="bg-card px-5 py-8 text-center text-sm text-muted">
                      No hay canciones en la playlist todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-right text-[12px] text-muted">
            {songs.length} {songs.length === 1 ? "canción" : "canciones"}
          </p>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm dark:bg-black/50">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-xl ring-1 ring-[var(--ring-soft)]">
            <h2 className="mb-3 text-lg font-semibold text-brand">Añadir canción</h2>
            <LeyendaObligatorios className="mb-4 text-[11px] text-muted" />
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">
                  Canción
                  <Req />
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Nombre de la canción"
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-foreground">
                  Artista
                  <Req />
                </label>
                <input
                  type="text"
                  value={newArtist}
                  onChange={(e) => setNewArtist(e.target.value)}
                  placeholder="Nombre del artista"
                  className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
                  onKeyDown={(e) => e.key === "Enter" && void addSong()}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowModal(false); setNewTitle(""); setNewArtist(""); }}
                disabled={saving}
                className="flex-1 rounded-xl border border-border bg-card-muted py-2 text-sm text-foreground transition-colors hover:bg-card-muted/80 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void addSong()}
                disabled={saving}
                className="flex-1 rounded-xl bg-brand py-2 text-sm font-medium text-white transition-colors hover:brightness-95 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Añadir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
