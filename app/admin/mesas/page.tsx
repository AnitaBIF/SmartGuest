"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type EventoOpt = { id: string; nombre: string; fecha: string; horario: string | null };

type Guest = {
  id: string;
  name: string;
  mesaId: string | null;
  asistencia: string;
  restriccion?: string | null;
  restriccionOtro?: string | null;
  grupo: string;
  rangoEtario: string;
  seatCount: number;
};

type MesaDB = { id: string; numero: number };

type Seat = { index: number; guestId: string | null };
type TableData = { id: string; numero: number; seats: Seat[] };

type Reporte = {
  evento: { id: string; nombre: string; fecha: string; horario: string | null; salon: string; direccion: string };
  seatsPerTable: number;
  mesas: MesaDB[];
  guests: Guest[];
};

const SEAT_LIBRE = "#d1d5db";
const SEAT_OCUPADA = "#22c55e";

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

function buildTables(mesas: MesaDB[], guests: Guest[], seatsPerTable: number): TableData[] {
  const tableDatas: TableData[] = mesas.map((m) => ({
    id: m.id,
    numero: m.numero,
    seats: Array.from({ length: seatsPerTable }, (_, i) => ({ index: i, guestId: null as string | null })),
  }));

  for (const g of guests) {
    if (!g.mesaId) continue;
    const table = tableDatas.find((t) => t.id === g.mesaId);
    if (!table) continue;
    const sc = Number.isFinite(g.seatCount) ? Math.min(20, Math.max(1, Math.floor(g.seatCount))) : 1;
    let placed = 0;
    for (const seat of table.seats) {
      if (placed >= sc) break;
      if (seat.guestId === null) {
        seat.guestId = g.id;
        placed++;
      }
    }
  }
  return tableDatas;
}

export default function AdminMesasPage() {
  return (
    <Suspense fallback={<main className="min-w-0 max-w-7xl flex-1 pb-8" />}>
      <AdminMesasContent />
    </Suspense>
  );
}

function AdminMesasContent() {
  const searchParams = useSearchParams();
  const eventoIdFromUrl = searchParams.get("eventoId") ?? "";
  const [eventos, setEventos] = useState<EventoOpt[]>([]);
  const [eventoId, setEventoId] = useState(eventoIdFromUrl);
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
        if (!Array.isArray(data)) {
          setEventos([]);
          return;
        }
        const opts: EventoOpt[] = data
          .map((e: Record<string, unknown>) => ({
            id: String(e.id ?? ""),
            nombre: String(e.nombre ?? "Evento"),
            fecha: String(e.fecha ?? ""),
            horario: e.horario != null ? String(e.horario) : null,
          }))
          .filter((e) => e.id);
        setEventos(opts);
        if (opts.length > 0) {
          setEventoId((prev) => {
            if (prev && opts.some((o) => o.id === prev)) return prev;
            // Por defecto: el evento más próximo a hoy (los eventos vienen ordenados ascendentes por fecha).
            const hoy = new Date().toISOString().slice(0, 10);
            const futuro = opts.find((o) => o.fecha >= hoy);
            return (futuro ?? opts[0]).id;
          });
        }
      })
      .catch(() => {
        if (!cancelled) setEventos([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingLista(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cargar = useCallback(async (id: string) => {
    setLoadingReporte(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/smartseat?eventoId=${encodeURIComponent(id)}`, { cache: "no-store" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(typeof j.error === "string" ? j.error : "No se pudo cargar la organización de mesas.");
      }
      const data = (await res.json()) as Reporte;
      setReporte(data);
    } catch (e) {
      setReporte(null);
      setError(e instanceof Error ? e.message : "Error desconocido.");
    } finally {
      setLoadingReporte(false);
    }
  }, []);

  useEffect(() => {
    if (eventoId) void cargar(eventoId);
    else setReporte(null);
  }, [eventoId, cargar]);

  const tables = useMemo<TableData[]>(() => {
    if (!reporte) return [];
    return buildTables(reporte.mesas, reporte.guests, reporte.seatsPerTable);
  }, [reporte]);

  const getGuestById = useCallback(
    (id: string | null) => (id && reporte ? reporte.guests.find((g) => g.id === id) : undefined),
    [reporte],
  );

  const resumen = useMemo(() => {
    if (!reporte) return null;
    /** La API admin solo devuelve confirmados; totales = invitaciones confirmadas. */
    const confirmados = reporte.guests;
    const totales = confirmados.length;
    const conMesa = confirmados.filter((g) => g.mesaId).length;
    const sinMesa = totales - conMesa;
    const personas = confirmados.reduce((s, g) => s + (g.seatCount || 0), 0);
    return { totales, conMesa, sinMesa, personas };
  }, [reporte]);

  return (
    <main className="min-w-0 flex-1 pb-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-brand">Organización de mesas</h1>
          <p className="mt-1 max-w-xl text-[12px] text-muted">
            Vista de solo lectura para administradores del salón. Mostramos cómo el anfitrión organizó las mesas en
            SmartSeat para cada evento.
          </p>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-[var(--ring-soft)]">
        <label className="mb-2 block text-[12px] font-semibold text-foreground">Elegí el evento</label>
        <select
          value={eventoId}
          onChange={(e) => setEventoId(e.target.value)}
          disabled={loadingLista || eventos.length === 0}
          className="w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
        >
          {loadingLista ? (
            <option>Cargando eventos…</option>
          ) : eventos.length === 0 ? (
            <option value="">No hay eventos en tu salón.</option>
          ) : (
            eventos.map((e) => (
              <option key={e.id} value={e.id}>
                {fmtFecha(e.fecha)}
                {e.horario ? ` · ${e.horario}` : ""} — {e.nombre}
              </option>
            ))
          )}
        </select>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {loadingReporte && (
        <p className="my-8 text-center text-sm text-muted animate-pulse">Cargando organización de mesas…</p>
      )}

      {!loadingReporte && reporte && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <ResumenCard label="Mesas" value={String(reporte.mesas.length)} />
            <ResumenCard label="Sillas por mesa" value={String(reporte.seatsPerTable)} />
            <ResumenCard
              label="Personas"
              value={resumen ? String(resumen.personas) : "—"}
              hint={resumen ? "Solo confirmadas" : ""}
            />
            <ResumenCard
              label="Con mesa"
              value={resumen ? `${resumen.conMesa} / ${resumen.totales}` : "—"}
              hint="Ubicadas (confirmadas)"
            />
            <ResumenCard
              label="Sin mesa"
              value={resumen ? String(resumen.sinMesa) : "—"}
              hint="Confirmadas sin ubicar"
            />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: SEAT_LIBRE }} />
              Desocupada
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 shrink-0 rounded-full ring-1 ring-black/15" style={{ backgroundColor: SEAT_OCUPADA }} />
              Ocupada
            </span>
            <span className="max-w-md text-[10px] leading-snug opacity-90">
              Solo invitaciones con asistencia confirmada se muestran como ocupadas.
            </span>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tables.map((table) => {
              const ocupadas = table.seats.filter((s) => s.guestId).length;
              const guestsAqui = uniqueGuestsForTable(table, reporte.guests);
              return (
                <div
                  key={table.id}
                  className="flex flex-col rounded-2xl border border-border bg-card p-3 shadow-sm ring-1 ring-[var(--ring-soft)]"
                >
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h2 className="text-sm font-semibold text-brand">MESA {table.numero}</h2>
                    <span className="text-[10px] text-muted">
                      {ocupadas}/{table.seats.length}
                    </span>
                  </div>
                  <div className="relative mx-auto h-40 w-40">
                    <div className="absolute inset-7 rounded-full border-2 border-border bg-card-muted" />
                    {table.seats.map((seat) => {
                      const angle = (seat.index / table.seats.length) * Math.PI * 2 - Math.PI / 2;
                      const radius = 64;
                      const cx = 80;
                      const cy = 80;
                      const size = 13;
                      const x = cx + Math.cos(angle) * radius - size;
                      const y = cy + Math.sin(angle) * radius - size;
                      const guest = getGuestById(seat.guestId);
                      const bg = guest ? SEAT_OCUPADA : SEAT_LIBRE;
                      return (
                        <div key={seat.index} className="group absolute" style={{ left: x, top: y }}>
                          <span
                            aria-label={guest ? `Silla ocupada: ${guest.name}` : "Silla libre"}
                            className="flex h-[26px] w-[26px] items-center justify-center rounded-full ring-1 ring-black/10"
                            style={{ backgroundColor: bg }}
                          />
                          {guest && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 scale-90 rounded-lg bg-[#1f2937] px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
                              <p className="whitespace-nowrap font-semibold">{guest.name}</p>
                              {guest.seatCount > 1 && (
                                <p className="mt-0.5 whitespace-nowrap text-[#93c5fd]">
                                  {guest.seatCount} personas (mismo grupo)
                                </p>
                              )}
                              <p className="mt-0.5 whitespace-nowrap text-[#a7f3d0]">
                                {guest.grupo} · {guest.rangoEtario}
                              </p>
                              {guest.restriccion && guest.restriccion !== "ninguna" && (
                                <p className="mt-0.5 whitespace-nowrap text-[#fbbf24]">
                                  {guest.restriccion}
                                  {guest.restriccion === "otro" && guest.restriccionOtro ? `: ${guest.restriccionOtro}` : ""}
                                </p>
                              )}
                              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#1f2937]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <ul className="mt-2 space-y-0.5 text-[11px] text-muted">
                    {guestsAqui.map((g) => (
                      <li key={g.id} className="flex justify-between gap-1.5">
                        <span className="truncate text-foreground">{g.name}</span>
                        {g.seatCount > 1 && (
                          <span className="flex-shrink-0 text-muted">{g.seatCount}p</span>
                        )}
                      </li>
                    ))}
                    {guestsAqui.length === 0 && (
                      <li className="text-center text-[10px] text-muted">Mesa vacía</li>
                    )}
                  </ul>
                </div>
              );
            })}
            {tables.length === 0 && (
              <p className="col-span-full text-center text-muted">El evento no tiene mesas creadas.</p>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function uniqueGuestsForTable(table: TableData, guests: Guest[]): Guest[] {
  const seen = new Set<string>();
  const out: Guest[] = [];
  for (const seat of table.seats) {
    if (!seat.guestId || seen.has(seat.guestId)) continue;
    const g = guests.find((x) => x.id === seat.guestId);
    if (g) {
      seen.add(g.id);
      out.push(g);
    }
  }
  return out;
}

function ResumenCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm ring-1 ring-[var(--ring-soft)]">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-lg font-bold leading-tight text-brand">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] leading-tight text-muted">{hint}</p>}
    </div>
  );
}
