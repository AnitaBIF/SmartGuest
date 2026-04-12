"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HostSidebar } from "../components/HostSidebar";
import { mapUiMenuToInvitadoColumns } from "@/lib/grupoFamiliar";

function Logo() {
  return (
    <span className="text-xl font-extrabold tracking-tight text-brand sm:text-2xl">
      SMART
      <span className="ml-1 font-normal text-brand" style={{ fontFamily: "var(--font-poppins)" }}>
        GUEST
      </span>
    </span>
  );
}

type AsistenciaDb = "pendiente" | "confirmado" | "rechazado";

type MenuPersonaApi = { restriccion: string; restriccionOtro: string | null };

type GuestApi = {
  id: string;
  name: string;
  mesaId: string | null;
  asistencia: AsistenciaDb;
  restriccion: string | null;
  restriccionOtro: string | null;
  grupo: string;
  /** Menú por persona (grupo familiar); si viene, los totales usan esto en lugar de una sola restricción. */
  grupoMenus: MenuPersonaApi[] | null;
};

type MesaApi = { id: string; numero: number };

/** Misma lógica que cocina / resumen: standard, celíaco, vegetariano/vegano, otro. */
function categoriaMenu(
  restriccion: string | null | undefined,
  restriccionOtro: string | null | undefined
): "standard" | "celiaco" | "vegetariano" | "otro" {
  const r = (restriccion ?? "").trim().toLowerCase();
  if (!r || r === "ninguna" || r === "standard" || r.includes("standard")) return "standard";
  if (
    r.includes("celiac") ||
    r.includes("celíac") ||
    r.includes("tacc") ||
    r === "sin tacc" ||
    r === "celiaco" ||
    r === "celíaco"
  ) {
    return "celiaco";
  }
  if (r.includes("vegetar") || r.includes("vegano") || r === "veg/veg" || r === "vegano/vegetariano") {
    return "vegetariano";
  }
  if (r === "otro" && restriccionOtro?.trim()) return "otro";
  if (r === "otro") return "otro";
  return "otro";
}

function etiquetaRestriccion(g: GuestApi): string {
  if (g.grupoMenus && g.grupoMenus.length > 0) {
    return g.grupoMenus
      .map((m, i) => {
        const leg = mapUiMenuToInvitadoColumns(m.restriccion, m.restriccionOtro);
        const r = leg.restriccion_alimentaria?.trim() ?? "";
        if (!r) return `Persona ${i + 1}: Standard`;
        if (r.toLowerCase() === "otro" && leg.restriccion_otro?.trim()) {
          return `Persona ${i + 1}: ${leg.restriccion_otro.trim()}`;
        }
        return `Persona ${i + 1}: ${r}`;
      })
      .join("\n");
  }
  const r = g.restriccion?.trim() ?? "";
  if (!r) return "Sin menú indicado";
  if (r.toLowerCase() === "otro" && g.restriccionOtro?.trim()) return g.restriccionOtro.trim();
  return r;
}

function badgeAsistencia(a: AsistenciaDb) {
  if (a === "confirmado") {
    return (
      <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 text-[10px] font-semibold text-[#166534]">
        Confirmado
      </span>
    );
  }
  if (a === "rechazado") {
    return (
      <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-[10px] font-semibold text-[#991b1b]">
        No asiste
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#f3f4f6] px-2 py-0.5 text-[10px] font-semibold text-[#4b5563]">
      Pendiente
    </span>
  );
}

export default function RestriccionesPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userName, setUserName] = useState("Anfitrión");
  const [mesas, setMesas] = useState<MesaApi[]>([]);
  const [guests, setGuests] = useState<GuestApi[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [resSeat, resEvt] = await Promise.all([
        fetch("/api/anfitrion/smartseat", { cache: "no-store" }),
        fetch("/api/anfitrion/evento", { cache: "no-store" }),
      ]);

      if (resEvt.ok) {
        const evt = await resEvt.json();
        const n = evt?.usuario?.nombre;
        if (typeof n === "string" && n.trim()) setUserName(n.trim());
      }

      if (!resSeat.ok) {
        const err = await resSeat.json().catch(() => ({}));
        setLoadError(typeof err.error === "string" ? err.error : "No se pudieron cargar los datos.");
        setMesas([]);
        setGuests([]);
        return;
      }

      const data = await resSeat.json();
      const rawGuests = (data.guests ?? []) as GuestApi[];
      setGuests(
        rawGuests.map((g) => {
          const raw = g as GuestApi & { grupoMenus?: unknown };
          const gm = raw.grupoMenus;
          const grupoMenus =
            Array.isArray(gm) && gm.length > 0
              ? (gm as MenuPersonaApi[]).filter(
                  (x) => x && typeof x === "object" && typeof (x as MenuPersonaApi).restriccion === "string",
                )
              : null;
          return {
            id: g.id,
            name: g.name || "Invitado",
            mesaId: g.mesaId,
            asistencia: g.asistencia,
            restriccion: g.restriccion ?? null,
            restriccionOtro: g.restriccionOtro ?? null,
            grupo: g.grupo ?? "—",
            grupoMenus: grupoMenus && grupoMenus.length > 0 ? grupoMenus : null,
          };
        }),
      );
      setMesas(((data.mesas ?? []) as MesaApi[]).slice().sort((a, b) => a.numero - b.numero));
    } catch {
      setLoadError("Error de conexión.");
      setMesas([]);
      setGuests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const conteosConfirmados = useMemo(() => {
    let standard = 0;
    let celiaco = 0;
    let vegetariano = 0;
    let otro = 0;
    for (const g of guests) {
      if (g.asistencia !== "confirmado") continue;
      if (g.grupoMenus && g.grupoMenus.length > 0) {
        for (const m of g.grupoMenus) {
          const leg = mapUiMenuToInvitadoColumns(m.restriccion, m.restriccionOtro);
          const cat = categoriaMenu(leg.restriccion_alimentaria, leg.restriccion_otro);
          if (cat === "standard") standard++;
          else if (cat === "celiaco") celiaco++;
          else if (cat === "vegetariano") vegetariano++;
          else otro++;
        }
      } else {
        const cat = categoriaMenu(g.restriccion, g.restriccionOtro);
        if (cat === "standard") standard++;
        else if (cat === "celiaco") celiaco++;
        else if (cat === "vegetariano") vegetariano++;
        else otro++;
      }
    }
    return { standard, celiaco, vegetariano, otro };
  }, [guests]);

  const invitadosPorMesa = useMemo(() => {
    const map = new Map<string | null, GuestApi[]>();
    for (const g of guests) {
      const k = g.mesaId;
      const list = map.get(k) ?? [];
      list.push(g);
      map.set(k, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "es"));
    }
    return map;
  }, [guests]);

  const sinMesa = invitadosPorMesa.get(null) ?? [];

  const mesaIdsValidas = useMemo(() => new Set(mesas.map((m) => m.id)), [mesas]);
  const mesaDesconocida = useMemo(() => {
    const out: GuestApi[] = [];
    for (const g of guests) {
      if (g.mesaId && !mesaIdsValidas.has(g.mesaId)) out.push(g);
    }
    out.sort((a, b) => a.name.localeCompare(b.name, "es"));
    return out;
  }, [guests, mesaIdsValidas]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)] text-foreground">
      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-8 text-[#111827]">
        <HostSidebar hostName={userName} active="restricciones" />

        <main className="flex-1 pb-8">
          <header className="mb-6 flex items-center justify-between md:hidden">
            <Logo />
          </header>

          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <h1 className="text-xl font-semibold text-brand sm:text-2xl">Restricciones Alimentarias</h1>
          </div>

          {loading ? (
            <p className="text-[13px] text-[#6b7280]">Cargando invitados y mesas…</p>
          ) : loadError ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
              {loadError}
            </div>
          ) : (
            <>
              <p className="mb-4 text-[12px] text-[#6b7280]">
                Los totales de arriba son solo de invitados con <strong>asistencia confirmada</strong> (igual que en el
                resumen). Si alguien confirmó un <strong>grupo familiar</strong>, cada menú de cada persona suma al
                conteo. Abajo ves a todos los invitados agrupados por mesa (SmartSeat).
              </p>

              <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-5 py-4 text-white shadow-md shadow-brand/40">
                  <p className="text-xs font-medium opacity-90">Menú Standard</p>
                  <p className="mt-2 text-2xl font-semibold leading-none">{conteosConfirmados.standard}</p>
                </div>
                <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-5 py-4 text-white shadow-md shadow-brand/40">
                  <p className="text-xs font-medium opacity-90">Menú Celíaco</p>
                  <p className="mt-2 text-2xl font-semibold leading-none">{conteosConfirmados.celiaco}</p>
                </div>
                <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-5 py-4 text-white shadow-md shadow-brand/40">
                  <p className="text-xs font-medium opacity-90">Menú Vegetariano/Vegano</p>
                  <p className="mt-2 text-2xl font-semibold leading-none">{conteosConfirmados.vegetariano}</p>
                </div>
                <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-5 py-4 text-white shadow-md shadow-brand/40">
                  <p className="text-xs font-medium opacity-90">Otro menú especial</p>
                  <p className="mt-2 text-2xl font-semibold leading-none">{conteosConfirmados.otro}</p>
                </div>
              </section>

              <hr className="mb-6 border-t border-[#d1e3d7]" />

              <section className="space-y-8">
                {mesas.length === 0 && guests.length === 0 ? (
                  <p className="text-[13px] text-[#6b7280]">Todavía no hay invitados cargados en este evento.</p>
                ) : (
                  <>
                    {mesas.map((mesa) => {
                      const enMesa = invitadosPorMesa.get(mesa.id) ?? [];
                      return (
                        <div key={mesa.id}>
                          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand">
                            Mesa {mesa.numero}
                          </h2>
                          {enMesa.length === 0 ? (
                            <p className="text-[12px] text-[#9ca3af]">Nadie asignado a esta mesa en SmartSeat.</p>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {enMesa.map((g) => (
                                <div
                                  key={g.id}
                                  className="rounded-2xl bg-[#f5fbf7] px-4 py-4 text-left shadow-[0_18px_35px_rgba(0,0,0,0.04)] ring-1 ring-[#e3efe8]"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-[#111827]">{g.name}</p>
                                    {badgeAsistencia(g.asistencia)}
                                  </div>
                                  <p className="mt-2 whitespace-pre-line text-[12px] leading-snug text-[#374151]">
                                    {etiquetaRestriccion(g)}
                                  </p>
                                  <p className="mt-1 text-[10px] text-[#9ca3af]">Grupo: {g.grupo}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {mesaDesconocida.length > 0 && (
                      <div>
                        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800">
                          Mesa no encontrada (revisá SmartSeat)
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {mesaDesconocida.map((g) => (
                            <div
                              key={g.id}
                              className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-left"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-[#111827]">{g.name}</p>
                                {badgeAsistencia(g.asistencia)}
                              </div>
                              <p className="mt-2 whitespace-pre-line text-[12px] text-[#374151]">
                                {etiquetaRestriccion(g)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {sinMesa.length > 0 && (
                      <div>
                        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                          Sin mesa asignada
                        </h2>
                        <p className="mb-3 text-[11px] text-[#9ca3af]">
                          Asigná mesas desde <Link href="/anfitrion/smartseat" className="font-semibold text-brand underline">SmartSeat</Link>.
                        </p>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {sinMesa.map((g) => (
                            <div
                              key={g.id}
                              className="rounded-2xl bg-[#fafafa] px-4 py-4 text-left shadow-sm ring-1 ring-[#e5e7eb]"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-[#111827]">{g.name}</p>
                                {badgeAsistencia(g.asistencia)}
                              </div>
                              <p className="mt-2 whitespace-pre-line text-[12px] leading-snug text-[#374151]">
                                {etiquetaRestriccion(g)}
                              </p>
                              <p className="mt-1 text-[10px] text-[#9ca3af]">Grupo: {g.grupo}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
