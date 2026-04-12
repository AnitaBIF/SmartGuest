"use client";

import { HostSidebar } from "../components/HostSidebar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ─── Tipos ─── */
type Guest = {
  id: string;
  name: string;
  mesaId: string | null;
  restriction?: string;
  grupo: string;
  rangoEtario: string;
};

type MesaDB = { id: string; numero: number };

type Seat = { index: number; guestId: string | null };
type TableData = { id: string; numero: number; seats: Seat[] };

/** Sillas: solo gris (libre) o verde (ocupada). */
const SEAT_LIBRE = "#d1d5db";
const SEAT_OCUPADA = "#22c55e";

/* ─── Componente principal ─── */
export default function SmartSeatPage() {
  const [tables, setTables] = useState<TableData[]>([]);
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [userName, setUserName] = useState("Anfitrión");
  /** Evita pisar mesas sin guardar al refrescar en segundo plano. */
  const layoutDirtyRef = useRef(false);
  const savingRef = useRef(false);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (opts?.silent && layoutDirtyRef.current) return;
    if (!opts?.silent) setLoading(true);
    try {
      const res = await fetch("/api/anfitrion/smartseat");
      if (!res.ok) throw new Error("Error al cargar");
      const data = await res.json();

      setAllGuests(
        data.guests.map((g: Guest & { restriccion?: string; restriccionOtro?: string }) => ({
          id: g.id,
          name: g.name,
          mesaId: g.mesaId,
          restriction: g.restriction === "otro" ? g.restriction : g.restriction,
          grupo: g.grupo,
          rangoEtario: g.rangoEtario,
        })),
      );

      const seatsPerTable: number = data.seatsPerTable;

      const tableDatas: TableData[] = (data.mesas as MesaDB[]).map((m) => ({
        id: m.id,
        numero: m.numero,
        seats: Array.from({ length: seatsPerTable }, (_, i) => ({
          index: i,
          guestId: null as string | null,
        })),
      }));

      for (const g of data.guests as Guest[]) {
        if (!g.mesaId) continue;
        const table = tableDatas.find((t) => t.id === g.mesaId);
        if (!table) continue;
        const emptySeat = table.seats.find((s) => s.guestId === null);
        if (emptySeat) emptySeat.guestId = g.id;
      }

      setTables(tableDatas);

      try {
        const resEvt = await fetch("/api/anfitrion/evento");
        if (resEvt.ok) {
          const evtData = await resEvt.json();
          const n = evtData?.usuario?.nombre;
          if (typeof n === "string" && n.trim()) setUserName(n.trim());
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (layoutDirtyRef.current || savingRef.current) return;
      void loadData({ silent: true });
    };
    const id = window.setInterval(tick, 35_000);
    const onVis = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadData]);

  const assignedGuestIds = useMemo(
    () => new Set(tables.flatMap((t) => t.seats.map((s) => s.guestId).filter(Boolean) as string[])),
    [tables],
  );

  const unassignedGuests = useMemo(
    () => allGuests.filter((g) => !assignedGuestIds.has(g.id)),
    [allGuests, assignedGuestIds],
  );

  const getGuestById = (id: string | null) => (id ? allGuests.find((g) => g.id === id) : undefined);

  /* ─── Drag & Drop helpers ─── */
  const markLayoutDirty = () => {
    layoutDirtyRef.current = true;
  };

  const removeGuestFromSeats = (guestId: string) => {
    markLayoutDirty();
    setTables((prev) =>
      prev.map((table) => ({
        ...table,
        seats: table.seats.map((seat) =>
          seat.guestId === guestId ? { ...seat, guestId: null } : seat
        ),
      })),
    );
  };

  const assignGuestToSeat = (guestId: string, tableId: string, seatIndex: number) => {
    removeGuestFromSeats(guestId);
    setTables((prev) =>
      prev.map((table) =>
        table.id !== tableId
          ? table
          : {
              ...table,
              seats: table.seats.map((seat) =>
                seat.index === seatIndex ? { ...seat, guestId } : seat
              ),
            },
      ),
    );
  };

  const unassignGuest = (guestId: string) => {
    removeGuestFromSeats(guestId);
  };

  const swapSeats = (
    from: { tableId: string; seatIndex: number },
    to: { tableId: string; seatIndex: number },
  ) => {
    markLayoutDirty();
    setTables((prev) => {
      const next = structuredClone(prev) as TableData[];
      const fromTable = next.find((t) => t.id === from.tableId);
      const toTable = next.find((t) => t.id === to.tableId);
      if (!fromTable || !toTable) return prev;
      const fromSeat = fromTable.seats.find((s) => s.index === from.seatIndex);
      const toSeat = toTable.seats.find((s) => s.index === to.seatIndex);
      if (!fromSeat || !toSeat) return prev;
      const aux = fromSeat.guestId;
      fromSeat.guestId = toSeat.guestId;
      toSeat.guestId = aux;
      return next;
    });
  };

  /* ─── Guardar asignaciones ─── */
  const handleSave = async () => {
    savingRef.current = true;
    setSaving(true);
    const assignments: { invitadoId: string; mesaId: string | null }[] = [];
    for (const g of allGuests) {
      const table = tables.find((t) => t.seats.some((s) => s.guestId === g.id));
      assignments.push({ invitadoId: g.id, mesaId: table?.id ?? null });
    }
    try {
      const res = await fetch("/api/anfitrion/smartseat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (res.ok) {
        layoutDirtyRef.current = false;
      }
    } catch (err) {
      console.error(err);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  /* ─── Sugerir con clustering ─── */
  const handleSuggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch("/api/anfitrion/smartseat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Error de clustering");
      const { suggestion } = await res.json() as { suggestion: Record<string, string | null> };

      markLayoutDirty();
      setTables((prev) => {
        const next = structuredClone(prev) as TableData[];
        // Limpiar todas las mesas
        for (const t of next) for (const s of t.seats) s.guestId = null;
        // Asignar según sugerencia
        for (const [invId, mesaId] of Object.entries(suggestion)) {
          if (!mesaId) continue;
          const table = next.find((t) => t.id === mesaId);
          if (!table) continue;
          const emptySeat = table.seats.find((s) => s.guestId === null);
          if (emptySeat) emptySeat.guestId = invId;
        }
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSuggesting(false);
    }
  };

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <p className="text-brand text-lg font-semibold animate-pulse">Cargando SmartSeat…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)] text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-8 text-[#111827] lg:grid lg:grid-cols-[16rem_1fr] lg:gap-6">
        <HostSidebar hostName={userName} active="smartseat" />
        <main className="pb-8">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-brand">SmartSeat</h1>
              <p className="mt-1 max-w-xl text-[12px] text-[#6b7280]">
                Solo se listan invitados con <strong>asistencia confirmada</strong>. Cuando confirmen desde su invitación,
                aparecen acá (la página se actualiza sola cada poco si no moviste mesas sin guardar).
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSuggest}
                disabled={suggesting}
                className="rounded-full bg-[#6d28d9] px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#5b21b6] disabled:opacity-50"
              >
                {suggesting ? "Calculando…" : "✨ Sugerir ubicación"}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand/90 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "💾 Guardar"}
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-4 text-[11px] text-[#4b5563]">
            <span className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: SEAT_LIBRE }} />
              Desocupada
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/15" style={{ backgroundColor: SEAT_OCUPADA }} />
              Ocupada
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
            <section className="grid gap-6 sm:grid-cols-2">
              {tables.map((table) => (
                <div key={table.id} className="rounded-2xl bg-white/80 p-5 shadow-sm ring-1 ring-[#d7e6dd]">
                  <h2 className="mb-4 text-lg font-semibold text-brand">MESA {table.numero}</h2>
                  <div className="relative mx-auto h-56 w-56">
                    <div className="absolute inset-10 rounded-full border-2 border-[#c5d8cc] bg-[#f0f7f2]" />
                    {table.seats.map((seat) => {
                      const angle = (seat.index / table.seats.length) * Math.PI * 2 - Math.PI / 2;
                      const radius = 90;
                      const cx = 112;
                      const cy = 112;
                      const size = 18;
                      const x = cx + Math.cos(angle) * radius - size;
                      const y = cy + Math.sin(angle) * radius - size;
                      const guest = getGuestById(seat.guestId);
                      const bg = guest ? SEAT_OCUPADA : SEAT_LIBRE;
                      return (
                        <div
                          key={seat.index}
                          className="group absolute"
                          style={{ left: x, top: y }}
                          draggable={Boolean(guest)}
                          onDragStart={(e) => {
                            if (!guest) return;
                            e.dataTransfer.setData(
                              "application/json",
                              JSON.stringify({ type: "seat", tableId: table.id, seatIndex: seat.index }),
                            );
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            const payload = e.dataTransfer.getData("application/json");
                            if (!payload) return;
                            const data = JSON.parse(payload) as { type: string; guestId?: string; tableId?: string; seatIndex?: number };
                            if (data.type === "guest" && data.guestId) assignGuestToSeat(data.guestId, table.id, seat.index);
                            if (data.type === "seat" && data.tableId != null && data.seatIndex != null) {
                              swapSeats({ tableId: data.tableId, seatIndex: data.seatIndex }, { tableId: table.id, seatIndex: seat.index });
                            }
                          }}
                        >
                          <button
                            type="button"
                            aria-label={guest ? `Silla ocupada: ${guest.name}` : "Silla libre"}
                            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
                              guest ? "hover:scale-110 ring-2 ring-[#15803d]/35" : "hover:scale-105 hover:brightness-95"
                            }`}
                            style={{
                              backgroundColor: bg,
                            }}
                            onDoubleClick={() => guest && unassignGuest(guest.id)}
                          />
                          {guest && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 scale-90 rounded-lg bg-[#1f2937] px-3 py-2 text-xs text-white opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100">
                              <p className="whitespace-nowrap font-semibold">{guest.name}</p>
                              <p className="mt-0.5 whitespace-nowrap text-[#a7f3d0]">{guest.grupo} · {guest.rangoEtario}</p>
                              {guest.restriction && guest.restriction !== "ninguna" && (
                                <p className="mt-0.5 whitespace-nowrap text-[#fbbf24]">{guest.restriction}</p>
                              )}
                              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-[#1f2937]" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {tables.length === 0 && (
                <p className="col-span-full text-center text-[#6b7280]">No hay mesas creadas para tu evento.</p>
              )}
            </section>

            {/* Panel lateral de invitados no asignados */}
            <aside
              className="h-[calc(100vh-3rem)] rounded-2xl bg-[#f5fbf7] p-4 shadow-sm ring-1 ring-black/5 lg:sticky lg:top-6 lg:flex lg:flex-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const payload = e.dataTransfer.getData("application/json");
                if (!payload) return;
                const data = JSON.parse(payload) as { type: string; tableId?: string; seatIndex?: number };
                if (data.type === "seat" && data.tableId && data.seatIndex != null) {
                  const table = tables.find((t) => t.id === data.tableId);
                  const seat = table?.seats.find((s) => s.index === data.seatIndex);
                  if (seat?.guestId) unassignGuest(seat.guestId);
                }
              }}
            >
              <h3 className="mb-3 text-lg font-semibold text-brand">Invitados sin mesa</h3>
              <div className="space-y-2 lg:flex-1 lg:overflow-y-auto lg:pr-1">
                {unassignedGuests.map((guest) => (
                  <div
                    key={guest.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify({ type: "guest", guestId: guest.id }));
                    }}
                    className="cursor-grab rounded-xl border border-[#d1d5db] bg-white px-3 py-2 text-sm font-medium text-[#111827] shadow-sm"
                  >
                    <span>{guest.name}</span>
                    <span className="ml-2 text-[10px] text-[#6b7280]">{guest.grupo}</span>
                  </div>
                ))}
                {unassignedGuests.length === 0 && allGuests.length > 0 && (
                  <p className="text-center text-xs text-[#9ca3af]">¡Todos asignados!</p>
                )}
                {allGuests.length === 0 && (
                  <p className="text-center text-[12px] leading-relaxed text-[#6b7280]">
                    Nadie confirmó aún. Cuando los invitados confirmen asistencia, van a aparecer en esta lista para
                    asignar mesa.
                  </p>
                )}
              </div>
              <p className="mt-3 text-xs text-[#4b5563]">
                Arrastrá invitados a una silla. Doble clic para desasignar. Guardá para persistir cambios.
              </p>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
