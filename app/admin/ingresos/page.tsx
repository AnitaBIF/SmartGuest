"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
    <main className="min-w-0 flex-1 pb-8">
          <h1 className="mb-2 text-right text-2xl font-bold text-brand">Ingresos por QR</h1>
          <p className="mb-6 text-right text-[12px] text-muted">
            Quién pasó por puerta (validación de seguridad) y cuántas personas representa cada invitación confirmada.
          </p>

          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-md flex-1">
              <label htmlFor="ev-ing" className="mb-1 block text-[12px] font-semibold text-foreground">
                Evento
              </label>
              <select
                id="ev-ing"
                value={eventoId}
                onChange={(e) => setEventoId(e.target.value)}
                disabled={loadingLista}
                className="w-full rounded-xl border border-border bg-input px-3 py-2.5 text-sm text-foreground shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
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
                className="rounded-full border border-brand bg-card px-4 py-2 text-[13px] font-semibold text-brand hover:bg-card-muted"
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
            <p className="text-[13px] text-muted">Cargando datos de ingreso…</p>
          )}

          {!loadingReporte && reporte && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm ring-1 ring-[var(--ring-soft)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Invitaciones</p>
                  <p className="mt-1 text-xl font-bold text-foreground">{reporte.resumen.invitacionesTotales}</p>
                </div>
                <div className="rounded-2xl border border-border bg-card px-4 py-3 shadow-sm ring-1 ring-[var(--ring-soft)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Confirmaron</p>
                  <p className="mt-1 text-xl font-bold text-brand">{reporte.resumen.invitacionesConfirmadas}</p>
                  <p className="text-[11px] text-muted">{reporte.resumen.personasConfirmadasEsperadas} pers.</p>
                </div>
                <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3d7a56)] px-4 py-3 shadow-sm dark:bg-[linear-gradient(135deg,#1e3d2d,#2a5240)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a8d5b5]">Ingresaron (inv.)</p>
                  <p className="mt-1 text-xl font-bold text-white">{reporte.resumen.invitacionesIngresadas}</p>
                </div>
                <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3d7a56)] px-4 py-3 shadow-sm dark:bg-[linear-gradient(135deg,#1e3d2d,#2a5240)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[#a8d5b5]">Personas ingreso</p>
                  <p className="mt-1 text-xl font-bold text-white">{reporte.resumen.personasIngresadas}</p>
                </div>
                <div className="col-span-2 rounded-2xl border border-amber-200/60 bg-amber-50 px-4 py-3 shadow-sm ring-1 ring-amber-200/40 dark:border-amber-800/50 dark:bg-amber-950/35 dark:ring-amber-900/40 sm:col-span-1 lg:col-span-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-200/90">
                    Pendiente ingreso
                  </p>
                  <p className="mt-1 text-xl font-bold text-amber-950 dark:text-amber-100">
                    {Math.max(0, reporte.resumen.personasConfirmadasEsperadas - reporte.resumen.personasIngresadas)}{" "}
                    <span className="text-[12px] font-normal text-amber-900/70 dark:text-amber-200/80">
                      pers. confirmadas sin QR
                    </span>
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm ring-1 ring-[var(--ring-soft)]">
                <div className="border-b border-border-subtle bg-card-muted px-4 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Detalle · {eventoLabel}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-[13px]">
                    <thead>
                      <tr className="border-b border-border-subtle text-[11px] font-semibold uppercase tracking-wide text-muted">
                        <th className="px-4 py-3">Nombre</th>
                        <th className="px-4 py-3">DNI</th>
                        <th className="px-4 py-3">Grupo</th>
                        <th className="px-4 py-3 text-center">Pers.</th>
                        <th className="px-4 py-3">Asist.</th>
                        <th className="px-4 py-3">Ingreso</th>
                        <th className="px-4 py-3 text-center">Mesa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {reporte.filas.map((f) => (
                        <tr key={f.id} className={f.ingresado ? "bg-brand/5 dark:bg-brand/10" : ""}>
                          <td className="px-4 py-2.5 font-medium text-foreground">{f.nombre}</td>
                          <td className="px-4 py-2.5 text-muted">{f.dni}</td>
                          <td className="max-w-[140px] truncate px-4 py-2.5 text-muted" title={f.grupo}>
                            {f.grupo}
                          </td>
                          <td className="px-4 py-2.5 text-center tabular-nums text-foreground">{f.personasGrupo}</td>
                          <td className="px-4 py-2.5 capitalize text-muted">{f.asistencia}</td>
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
            <p className="text-center text-[13px] text-muted">Seleccioná un evento para ver el reporte.</p>
          )}
    </main>
  );
}
