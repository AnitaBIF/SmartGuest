"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminSidebar } from "../components/AdminSidebar";

type EventoOpt = { id: string; nombre: string; fecha: string };

type FilaIngreso = {
  id: string;
  nombre: string;
  dni: string;
  grupo: string;
  asistencia: string;
  personasGrupo: number;
  ingresado: boolean;
  ingresoAt: string | null;
  mesaNumero: number | null;
};

type Reporte = {
  evento: EventoOpt;
  resumen: {
    invitacionesTotales: number;
    invitacionesConfirmadas: number;
    personasConfirmadasEsperadas: number;
    invitacionesIngresadas: number;
    personasIngresadas: number;
  };
  filas: FilaIngreso[];
};

function fmtFechaHora(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function downloadCsv(reporte: Reporte) {
  const header =
    "Nombre,DNI,Grupo,Asistencia,Personas grupo,Ingresó,Hora ingreso,Mesa\n";
  const rows = reporte.filas
    .map((f) => {
      const ing = f.ingresado ? "Sí" : "No";
      const hora = f.ingresoAt ? f.ingresoAt.replace(/"/g, '""') : "";
      const mesa = f.mesaNumero != null ? String(f.mesaNumero) : "";
      return `"${f.nombre.replace(/"/g, '""')}","${f.dni.replace(/"/g, '""')}","${f.grupo.replace(/"/g, '""')}",${f.asistencia},${f.personasGrupo},${ing},"${hora}",${mesa}`;
    })
    .join("\n");
  const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ingresos-${reporte.evento.fecha}-${reporte.evento.id.slice(0, 8)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminIngresosPage() {
  const [eventos, setEventos] = useState<EventoOpt[]>([]);
  const [eventoId, setEventoId] = useState("");
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingReporte, setLoadingReporte] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/eventos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: unknown) => {
        if (cancelled) return;
        const arr = Array.isArray(data) ? data : [];
        setEventos(
          arr.map((e: { id?: string; nombre?: string; fecha?: string }) => ({
            id: String(e.id ?? ""),
            nombre: String(e.nombre ?? "Evento"),
            fecha: String(e.fecha ?? ""),
          }))
        );
        setLoadingLista(false);
      })
      .catch(() => {
        if (!cancelled) setLoadingLista(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cargarReporte = useCallback(async (id: string) => {
    if (!id) {
      setReporte(null);
      return;
    }
    setLoadingReporte(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/ingresos?eventoId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setReporte(null);
        setError(typeof data.error === "string" ? data.error : "No se pudo cargar el reporte.");
        return;
      }
      setReporte(data as Reporte);
    } catch {
      setReporte(null);
      setError("Error de conexión.");
    } finally {
      setLoadingReporte(false);
    }
  }, []);

  useEffect(() => {
    if (eventoId) void cargarReporte(eventoId);
    else setReporte(null);
  }, [eventoId, cargarReporte]);

  const eventoLabel = useMemo(() => {
    const e = eventos.find((x) => x.id === eventoId);
    if (!e) return "";
    return `${e.nombre} · ${e.fecha}`;
  }, [eventos, eventoId]);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 text-foreground sm:px-6 lg:px-8">
        <AdminSidebar active="ingresos" />

        <main className="flex-1 pb-8">
          <h1 className="mb-2 text-right text-2xl font-bold text-brand">Ingresos por QR</h1>
          <p className="mb-6 text-right text-[12px] text-[#6b7280]">
            Quién pasó por puerta (validación de seguridad) y cuántas personas representa cada invitación confirmada.
          </p>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md flex-1">
              <label htmlFor="ev-ing" className="mb-1 block text-[12px] font-semibold text-[#374151]">
                Evento
              </label>
              <select
                id="ev-ing"
                value={eventoId}
                onChange={(e) => setEventoId(e.target.value)}
                disabled={loadingLista}
                className="w-full rounded-xl border border-[#94a3b8] bg-white px-3 py-2.5 text-sm text-[#0f172a] shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
              >
                <option value="">{loadingLista ? "Cargando…" : "Elegí un evento"}</option>
                {eventos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.fecha} — {e.nombre}
                  </option>
                ))}
              </select>
            </div>
            {reporte && (
              <button
                type="button"
                onClick={() => downloadCsv(reporte)}
                className="rounded-full border border-brand bg-white px-4 py-2 text-[13px] font-semibold text-brand hover:bg-[#f0f7f2]"
              >
                Descargar CSV
              </button>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              {error}
            </div>
          )}

          {loadingReporte && (
            <p className="text-[13px] text-[#6b7280]">Cargando datos de ingreso…</p>
          )}

          {!loadingReporte && reporte && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-black/5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">Invitaciones</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{reporte.resumen.invitacionesTotales}</p>
                </div>
                <div className="rounded-2xl bg-white/90 px-4 py-3 shadow-sm ring-1 ring-black/5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b7280]">Confirmaron</p>
                  <p className="mt-1 text-xl font-bold text-[#2d5a41]">{reporte.resumen.invitacionesConfirmadas}</p>
                  <p className="text-[11px] text-[#6b7280]">{reporte.resumen.personasConfirmadasEsperadas} pers.</p>
                </div>
                <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3d7a56)] px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a8d5b5]">Ingresaron (inv.)</p>
                  <p className="mt-1 text-xl font-bold text-white">{reporte.resumen.invitacionesIngresadas}</p>
                </div>
                <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3d7a56)] px-4 py-3 shadow-sm">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a8d5b5]">Personas ingreso</p>
                  <p className="mt-1 text-xl font-bold text-white">{reporte.resumen.personasIngresadas}</p>
                </div>
                <div className="col-span-2 rounded-2xl bg-amber-50 px-4 py-3 shadow-sm ring-1 ring-amber-200/60 sm:col-span-1 lg:col-span-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80">Pendiente ingreso</p>
                  <p className="mt-1 text-xl font-bold text-amber-950">
                    {Math.max(0, reporte.resumen.personasConfirmadasEsperadas - reporte.resumen.personasIngresadas)}{" "}
                    <span className="text-[12px] font-normal text-amber-900/70">pers. confirmadas sin QR</span>
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white/90 shadow-sm ring-1 ring-black/5">
                <div className="border-b border-[#e8efe9] bg-[#f6faf7] px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                    Detalle · {eventoLabel}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-[#e8efe9] text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">DNI</th>
                        <th className="px-4 py-3">Grupo</th>
                        <th className="px-4 py-3 text-center">Pers.</th>
                        <th className="px-4 py-3">Asist.</th>
                        <th className="px-4 py-3">Ingreso</th>
                        <th className="px-4 py-3 text-center">Mesa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0f4f1]">
                      {reporte.filas.map((f) => (
                        <tr key={f.id} className={f.ingresado ? "bg-[#f7fdf9]" : ""}>
                          <td className="px-4 py-2.5 font-medium text-foreground">{f.nombre}</td>
                          <td className="px-4 py-2.5 text-[#4b5563]">{f.dni}</td>
                          <td className="max-w-[140px] truncate px-4 py-2.5 text-[#6b7280]" title={f.grupo}>
                            {f.grupo}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums">{f.personasGrupo}</td>
                          <td className="px-4 py-2.5 capitalize text-[#6b7280]">{f.asistencia}</td>
                          <td className="px-4 py-2.5">
                            {f.ingresado ? (
                              <span className="text-[#166534]">{fmtFechaHora(f.ingresoAt)}</span>
                            ) : (
                              <span className="text-[#9ca3af]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums">
                            {f.mesaNumero != null ? f.mesaNumero : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {!eventoId && !loadingLista && (
            <p className="text-center text-[13px] text-[#9ca3af]">Seleccioná un evento para ver el reporte.</p>
          )}
        </main>
      </div>
    </div>
  );
}
