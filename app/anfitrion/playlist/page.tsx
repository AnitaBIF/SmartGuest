"use client";

import { useCallback, useEffect, useState } from "react";
import { HostSidebar } from "../components/HostSidebar";
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
  const [hostName, setHostName] = useState("Anfitrión");
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

  useEffect(() => {
    fetch("/api/anfitrion/evento")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n = d?.usuario?.nombre;
        if (typeof n === "string" && n.trim()) setHostName(n.trim());
      })
      .catch(() => {});
  }, []);

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
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 text-[#111827] sm:px-6 lg:px-8">
        <HostSidebar hostName={hostName} active="playlist" />

        <main className="flex-1 pb-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setShowModal(true)}
                disabled={loading || !!loadError}
                className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#24503a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Añadir canción
              </button>
              <button
                type="button"
                onClick={exportPDF}
                disabled={songs.length === 0}
                className="rounded-full bg-brand px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#24503a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Exportar PDF
              </button>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-full border border-[#c5dece] bg-white px-4 py-2 text-sm font-medium text-[#374151] transition-colors hover:bg-[#f6faf7]"
              >
                Actualizar lista
              </button>
            </div>
            <h1 className="text-2xl font-bold text-brand">Playlist</h1>
          </div>

          <p className="mb-4 max-w-2xl text-[12px] leading-relaxed text-[#6b7280]">
            Pedidos de invitados y canciones que agregues vos. Las que son la misma canción (aunque estén escritas distinto)
            se muestran una sola vez. Cada fila incluye un enlace a YouTube (búsqueda automática).
          </p>

          {loadError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              {loadError}
            </div>
          )}

          <hr className="mb-5 border-[#c5d8cc]" />

          <div className="overflow-hidden rounded-2xl ring-1 ring-[#d7e6dd]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white">
                  <th className="rounded-tl-2xl px-5 py-3 text-left text-[13px] font-semibold text-[#111827]">Canción</th>
                  <th className="px-5 py-3 text-left text-[13px] font-semibold text-[#111827]">Artista</th>
                  <th className="px-5 py-3 text-left text-[13px] font-semibold text-[#111827]">YouTube</th>
                  <th className="rounded-tr-2xl px-5 py-3 text-right text-[13px] font-semibold text-[#111827]"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="bg-white px-5 py-10 text-center text-[#9ca3af]">
                      Cargando playlist…
                    </td>
                  </tr>
                ) : (
                  songs.map((song, i) => (
                    <tr
                      key={song.ids.join("-")}
                      className={`border-t border-[#e5efe8] transition-colors hover:bg-[#e8f4eb] ${
                        i % 2 === 0 ? "bg-[#f0f7f2]" : "bg-white"
                      }`}
                    >
                      <td className="px-5 py-3 font-medium text-[#111827]">{song.titulo}</td>
                      <td className="px-5 py-3 text-[#374151]">{song.artista}</td>
                      <td className="px-5 py-3">
                        {song.youtubeUrl ? (
                          <a
                            href={song.youtubeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium text-[#2563eb] underline decoration-[#93c5fd] underline-offset-2 hover:text-[#1d4ed8]"
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
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-[#9ca3af] transition-colors hover:bg-[#fee2e2] hover:text-[#dc2626]"
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
                    <td colSpan={4} className="bg-white px-5 py-8 text-center text-sm text-[#9ca3af]">
                      No hay canciones en la playlist todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-right text-[12px] text-[#6b7280]">
            {songs.length} {songs.length === 1 ? "canción" : "canciones"}
          </p>
        </main>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl ring-1 ring-black/5">
            <h2 className="mb-3 text-lg font-semibold text-brand">Añadir canción</h2>
            <LeyendaObligatorios className="mb-4 text-[11px] text-[#6b7280]" />
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#4b5563]">
                  Canción
                  <Req />
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Nombre de la canción"
                  className="w-full rounded-xl border border-[#d1d5db] px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-medium text-[#4b5563]">
                  Artista
                  <Req />
                </label>
                <input
                  type="text"
                  value={newArtist}
                  onChange={(e) => setNewArtist(e.target.value)}
                  placeholder="Nombre del artista"
                  className="w-full rounded-xl border border-[#d1d5db] px-3 py-2 text-sm text-[#111827] outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  onKeyDown={(e) => e.key === "Enter" && void addSong()}
                />
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowModal(false); setNewTitle(""); setNewArtist(""); }}
                disabled={saving}
                className="flex-1 rounded-xl border border-[#d1d5db] py-2 text-sm text-[#374151] transition-colors hover:bg-[#f3f4f6] disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void addSong()}
                disabled={saving}
                className="flex-1 rounded-xl bg-brand py-2 text-sm font-medium text-white transition-colors hover:bg-[#24503a] disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Añadir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
