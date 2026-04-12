"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HostSidebar } from "../components/HostSidebar";
import { downloadEcoGuestsPdf } from "@/lib/ecoguestsReportPdf";

type RolPool = "conductor" | "pasajero" | "no" | null;

type InvitadoApi = {
  id: string;
  nombre: string;
  asistencia: "Pendiente" | "Asiste" | "No asiste";
  grupo: string;
  telefono: string;
  eco: "Sí" | "No";
  rolSmartpool: RolPool;
  /** Personas confirmadas del grupo (SmartSeat / pool); por defecto 1 si la API no lo envía. */
  personasGrupo?: number;
};

function EcoGuestRow({ guest }: { guest: InvitadoApi }) {
  const esConductor = guest.rolSmartpool === "conductor";
  const rolLabel = esConductor ? "Conductor" : "Pasajero";

  return (
    <li className="flex gap-4 px-4 py-3.5 transition-colors hover:bg-[#f6faf7] sm:px-5 sm:py-4">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[#e8f3ec] ring-1 ring-[#c5dece]">
        <Image src="/ecoguest-badge.png" alt="" fill className="object-contain p-1" sizes="48px" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <p className="truncate text-[14px] font-semibold text-[#111827]" title={guest.nombre}>
            {guest.nombre}
          </p>
          <span
            className={`inline-flex w-fit shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              esConductor ? "bg-[#1a4d2e]/10 text-[#1a4d2e]" : "bg-[#3d6b5c]/10 text-[#2d5a41]"
            }`}
          >
            {rolLabel}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-[#6b7280]" title={guest.grupo}>
          Grupo: {guest.grupo || "—"}
          {!esConductor && (guest.personasGrupo ?? 1) > 1 ? (
            <span className="text-[#2d5a41]"> · {guest.personasGrupo} pers. confirmadas (SmartPool)</span>
          ) : null}
        </p>
      </div>
    </li>
  );
}

function downloadCsv(guests: InvitadoApi[]) {
  const header = "Nombre,Rol,Asistencia,Grupo,Personas grupo,Teléfono\n";
  const rows = guests
    .map((g) => {
      const rol = g.rolSmartpool === "conductor" ? "Conductor" : "Pasajero";
      const tel = (g.telefono ?? "").replace(/"/g, '""');
      const pers = g.rolSmartpool === "pasajero" ? String(g.personasGrupo ?? 1) : "";
      return `"${g.nombre.replace(/"/g, '""')}",${rol},${g.asistencia},"${(g.grupo ?? "").replace(/"/g, '""')}",${pers},"${tel}"`;
    })
    .join("\n");
  const blob = new Blob(["\ufeff" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "reporte-ecoguests.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function EcoGuestsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userName, setUserName] = useState("Anfitrión");
  const [eventoNombre, setEventoNombre] = useState("");
  const [eventoFecha, setEventoFecha] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<InvitadoApi[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resInv, resEvt] = await Promise.all([
        fetch("/api/anfitrion/invitados", { cache: "no-store" }),
        fetch("/api/anfitrion/evento", { cache: "no-store" }),
      ]);

      if (resEvt.ok) {
        const evt = await resEvt.json();
        const n = evt?.usuario?.nombre;
        if (typeof n === "string" && n.trim()) setUserName(n.trim());
        const nomEv = evt?.evento?.nombre;
        if (typeof nomEv === "string" && nomEv.trim()) setEventoNombre(nomEv.trim());
        else setEventoNombre("");
        const fEv = evt?.evento?.fecha;
        setEventoFecha(typeof fEv === "string" && fEv.trim() ? fEv.trim() : undefined);
      }

      if (!resInv.ok) {
        const err = await resInv.json().catch(() => ({}));
        setError(typeof err.error === "string" ? err.error : "No se pudieron cargar los invitados.");
        setRows([]);
        return;
      }

      const data = await resInv.json();
      const list = (data.invitados ?? []) as InvitadoApi[];
      setRows(list);
    } catch {
      setError("Error de conexión.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Mismo criterio que el resumen: solo confirmados que eligieron conductor o pasajero en SmartPool. */
  const ecoGuests = useMemo(() => {
    return rows
      .filter(
        (r) =>
          r.asistencia === "Asiste" &&
          (r.rolSmartpool === "conductor" || r.rolSmartpool === "pasajero")
      )
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [rows]);

  const conteo = useMemo(() => {
    let conductores = 0;
    let pasajerosPlazas = 0;
    let pasajerosFilas = 0;
    for (const g of ecoGuests) {
      if (g.rolSmartpool === "conductor") conductores += 1;
      else if (g.rolSmartpool === "pasajero") {
        pasajerosFilas += 1;
        pasajerosPlazas += g.personasGrupo ?? 1;
      }
    }
    return { conductores, pasajeros: pasajerosPlazas, pasajerosFilas, total: ecoGuests.length };
  }, [ecoGuests]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 text-[#111827] sm:px-6 lg:px-8">
        <HostSidebar hostName={userName} active="ecoguests" />

        <main className="flex-1 pb-8">
          <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-brand">EcoGuests</h1>
              <p className="mt-1 max-w-xl text-[12px] text-[#6b7280]">
                Solo invitados con <strong>asistencia confirmada</strong> que en SmartPool eligieron{" "}
                <strong>conductor</strong> o <strong>pasajero</strong> (mismo criterio que el resumen del evento).
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
              <button
                type="button"
                disabled={ecoGuests.length === 0}
                onClick={() =>
                  downloadEcoGuestsPdf({
                    eventoNombre: eventoNombre || "Mi evento",
                    eventoFecha,
                    anfitrionNombre: userName,
                    conteo: {
                      total: conteo.total,
                      conductores: conteo.conductores,
                      pasajeros: conteo.pasajeros,
                      pasajerosFilas: conteo.pasajerosFilas,
                    },
                    guests: ecoGuests.map((g) => ({
                      nombre: g.nombre,
                      rol: g.rolSmartpool === "conductor" ? "Conductor" : "Pasajero",
                      grupo: g.grupo || "—",
                      telefono: g.telefono || "—",
                      asistencia: g.asistencia,
                      personasGrupo: g.rolSmartpool === "pasajero" ? (g.personasGrupo ?? 1) : undefined,
                    })),
                  })
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#24503a] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3"
                  />
                </svg>
                Descargar PDF
              </button>
              <button
                type="button"
                disabled={ecoGuests.length === 0}
                onClick={() => downloadCsv(ecoGuests)}
                className="text-center text-[11px] font-medium text-[#2d5a41] underline underline-offset-2 hover:text-[#1a4d2e] disabled:cursor-not-allowed disabled:opacity-40"
              >
                También en CSV (Excel)
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-[13px] text-[#6b7280]">Cargando…</p>
          ) : error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">{error}</div>
          ) : ecoGuests.length === 0 ? (
            <div className="rounded-2xl bg-white/90 px-5 py-8 text-center shadow-sm ring-1 ring-black/5">
              <div className="relative mx-auto mb-3 h-14 w-14 overflow-hidden rounded-2xl bg-[#e8f3ec] ring-1 ring-[#c5dece]">
                <Image src="/ecoguest-badge.png" alt="EcoGuest" fill className="object-contain p-2" sizes="56px" />
              </div>
              <p className="text-[13px] leading-relaxed text-[#4b5563]">
                Todavía no hay EcoGuests en este evento. Los invitados tienen que{" "}
                <strong>confirmar asistencia</strong> y elegir conductor o pasajero en{" "}
                <strong>SmartPool</strong> desde su cuenta.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#4b5563]">
                <span className="rounded-full bg-white/90 px-3 py-1 font-medium shadow-sm ring-1 ring-black/5">
                  {conteo.total} {conteo.total === 1 ? "EcoGuest" : "EcoGuests"}
                </span>
                <span className="rounded-full bg-[#1a4d2e]/8 px-3 py-1 font-medium text-[#1a4d2e]">
                  {conteo.conductores} {conteo.conductores === 1 ? "conductor" : "conductores"}
                </span>
                <span className="rounded-full bg-[#2d5a41]/8 px-3 py-1 font-medium text-[#2d5a41]">
                  {conteo.pasajeros} plaza{conteo.pasajeros === 1 ? "" : "s"} pasajero
                  {conteo.pasajerosFilas !== conteo.pasajeros ? (
                    <span className="font-normal text-[#4b5563]"> ({conteo.pasajerosFilas} invit.)</span>
                  ) : null}
                </span>
              </div>

              <div className="overflow-hidden rounded-2xl bg-white/90 shadow-sm ring-1 ring-black/5">
                <div className="border-b border-[#e8efe9] bg-[#f6faf7] px-4 py-2.5 sm:px-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                    Lista del evento
                  </p>
                </div>
                <ul className="divide-y divide-[#e8efe9]">
                  {ecoGuests.map((guest) => (
                    <EcoGuestRow key={guest.id} guest={guest} />
                  ))}
                </ul>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
