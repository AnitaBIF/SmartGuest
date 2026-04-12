"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HostSidebar } from "./components/HostSidebar";

function Logo() {
  return (
    <span className="text-xl font-extrabold tracking-tight text-brand sm:text-2xl">
      SMART
      <span
        className="ml-1 font-normal text-brand"
        style={{ fontFamily: "var(--font-poppins)" }}
      >
        GUEST
      </span>
    </span>
  );
}

function Donut({
  label,
  legend,
  emptyHint,
}: {
  label: string;
  legend: { label: string; value: number; color: string }[];
  emptyHint?: string;
}) {
  const items = legend.map((item) => ({
    ...item,
    value: Math.max(0, Math.floor(Number(item.value) || 0)),
  }));
  const total = items.reduce((acc, item) => acc + item.value, 0);

  if (total === 0) {
    return (
      <div className="rounded-2xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
        <h3 className="mb-4 text-sm font-semibold text-brand">{label}</h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-[#ecefe9] ring-1 ring-[#d1d5db]">
            <span className="px-3 text-center text-[10px] font-medium leading-tight text-[#6b7280]">
              Sin datos
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-[#6b7280]">
            {emptyHint ??
              "Los valores aparecen cuando hay información en el evento."}
          </p>
        </div>
      </div>
    );
  }

  let current = 0;
  const stops: string[] = [];
  items.forEach((item) => {
    const start = (current / total) * 360;
    const end = ((current + item.value) / total) * 360;
    stops.push(`${item.color} ${start}deg ${end}deg`);
    current += item.value;
  });

  const gradient = `conic-gradient(${stops.join(", ")})`;

  return (
    <div className="rounded-2xl bg-white/90 p-6 shadow-sm ring-1 ring-black/5">
      <h3 className="mb-4 text-sm font-semibold text-brand">{label}</h3>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0">
          <div
            className="h-full w-full rounded-full bg-white shadow-sm shadow-black/10 ring-1 ring-[#e5e7eb]"
            style={{ backgroundImage: gradient }}
          />
          <div className="pointer-events-none absolute inset-6 rounded-full bg-white/96 backdrop-blur-sm ring-1 ring-[#e5e7eb]" />
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-full bg-[#f5f7f4] px-3 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-[#374151]">{item.label}</span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-[#111827]">
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const INVITED_COLORS = {
  confirmados: "#6cc58c",
  noAsiste: "#b0c4de",
  pendientes: "#444444",
};

const MESAS_COLORS = {
  pendientes: "#444444",
  incompletas: "#f59e0b",
  completas: "#6cc58c",
};

type EventoData = {
  usuario: { nombre: string };
  menuOpciones?: string[];
  evento: {
    id: string;
    cantInvitados: number;
    cantMesas: number;
    diasRestantes: number;
  };
  stats: {
    confirmados: number;
    noAsiste: number;
    pendientes: number;
    mesasPendientes: number;
    mesasIncompletas: number;
    mesasCompletas: number;
    menuStandard: number;
    menuCeliaco: number;
    menuOtros: number;
    ecoSi: number;
    ecoNo: number;
  };
  actividadReciente?: { id: string; nombre: string; accion: string }[];
};

export default function AnfitrionDashboard() {
  const [openLink, setOpenLink] = useState(false);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState<EventoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [anfitrionName, setAnfitrionName] = useState("Anfitrión");

  useEffect(() => {
    let cancelled = false;

    const load = (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      fetch("/api/anfitrion/evento", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (cancelled) return;
          if (d) {
            setData(d);
            setAnfitrionName(d.usuario.nombre || "Anfitrión");
          }
          setLoading(false);
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    };

    load();

    const onVis = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    const onFocus = () => load({ silent: true });
    /** Tras SmartSeat + “atrás”, bfcache puede restaurar la página sin remount → gráfico viejo. */
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onFocus);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const invitationUrl = data
    ? `${window.location.origin}/invitacion/${data.evento.id}`
    : "";

  const handleCopy = () => {
    if (navigator && "clipboard" in navigator && invitationUrl) {
      navigator.clipboard.writeText(invitationUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  const stats = data?.stats ?? {
    confirmados: 0,
    noAsiste: 0,
    pendientes: 0,
    mesasPendientes: 0,
    mesasIncompletas: 0,
    mesasCompletas: 0,
    menuStandard: 0,
    menuCeliaco: 0,
    menuOtros: 0,
    ecoSi: 0,
    ecoNo: 0,
  };

  const actividad = data?.actividadReciente ?? [];

  const menusOfrecidosText = (() => {
    const opts = data?.menuOpciones?.filter((m) => m !== "Ninguna") ?? [];
    if (opts.length === 0) return "Solo menú estándar (sin especiales).";
    return opts.join(" · ");
  })();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_0,#e3efe8_0,#f5f7f4_45%,#ffffff_100%)] text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:px-8 text-[#111827]">
        {/* Sidebar */}
        <HostSidebar hostName={anfitrionName} active="resumen" />

        {/* Main content */}
        <main className="flex-1 pb-8">
          <header className="mb-6 flex items-center justify-between md:hidden">
            <Logo />
          </header>

          {/* Top header */}
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setOpenLink(true)}
              className="rounded-full bg-brand px-6 py-2 text-sm font-medium text-white shadow-md shadow-brand/30"
            >
              Link de invitación
            </button>
            <h1 className="text-xl font-semibold text-brand sm:text-2xl">
              Resumen de tu evento
            </h1>
          </div>

          {/* Stats pills */}
          <section className="mb-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] text-white px-5 py-4 shadow-md shadow-brand/40">
              <p className="text-xs uppercase tracking-wide opacity-80">
                Días para el evento
              </p>
              <p className="mt-1 text-2xl font-semibold">{data?.evento.diasRestantes ?? "—"} días</p>
            </div>
            <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] text-white px-5 py-4 shadow-md shadow-brand/40">
              <p className="text-xs uppercase tracking-wide opacity-80">
                Capacidad del salón
              </p>
              <p className="mt-1 text-2xl font-semibold">{data?.evento.cantInvitados ?? "—"} invitados</p>
            </div>
            <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] text-white px-5 py-4 shadow-md shadow-brand/40">
              <p className="text-xs uppercase tracking-wide opacity-80">
                Cantidad de mesas
              </p>
              <p className="mt-1 text-2xl font-semibold">{data?.evento.cantMesas ?? "—"} mesas</p>
            </div>
          </section>

          <p className="mb-6 rounded-2xl border border-[#d7e6dd] bg-white/90 px-4 py-3 text-[12px] leading-relaxed text-[#4b5563] shadow-sm ring-1 ring-black/5">
            <span className="font-semibold text-[#374151]">Menús especiales para invitados: </span>
            {menusOfrecidosText}
          </p>

          {/* Donut charts grid — valores reales desde Supabase (sin mínimos artificiales) */}
          <section className="grid gap-4 md:grid-cols-2">
            <Donut
              label="Invitados"
              emptyHint="Cuando cargues invitados (Excel, manual o link), verás confirmados, rechazos y pendientes."
              legend={[
                { label: "Confirmados", value: stats.confirmados, color: INVITED_COLORS.confirmados },
                { label: "No asiste", value: stats.noAsiste, color: INVITED_COLORS.noAsiste },
                { label: "Pendientes", value: stats.pendientes, color: INVITED_COLORS.pendientes },
              ]}
            />
            <Donut
              label="Mesas"
              emptyHint="Igual que SmartSeat: cupo por mesa = invitados del evento ÷ cantidad de mesas (redondeado hacia arriba). Cuenta confirmados y pendientes con mesa asignada; vacía = nadie en la mesa; incompleta = hay gente pero falta cupo; completa = cupo lleno."
              legend={[
                { label: "Pendientes", value: stats.mesasPendientes, color: MESAS_COLORS.pendientes },
                { label: "Incompletas", value: stats.mesasIncompletas, color: MESAS_COLORS.incompletas },
                { label: "Completas", value: stats.mesasCompletas, color: MESAS_COLORS.completas },
              ]}
            />
            <Donut
              label="Menús"
              emptyHint="Solo invitados con asistencia confirmada, según la restricción alimentaria que cargaron."
              legend={[
                { label: "Standard", value: stats.menuStandard, color: "#6cc58c" },
                { label: "Celíaco", value: stats.menuCeliaco, color: "#b0c4de" },
                { label: "Otros", value: stats.menuOtros, color: "#444444" },
              ]}
            />
            <Donut
              label="EcoGuests"
              emptyHint="Solo entre confirmados: Sí = conductor o pasajero en SmartPool; No = resto."
              legend={[
                { label: "Sí", value: stats.ecoSi, color: "#6cc58c" },
                { label: "No", value: stats.ecoNo, color: "#444444" },
              ]}
            />
          </section>

          {/* Actividad reciente */}
          <section className="mt-8 overflow-hidden rounded-2xl border-t-[3px] border-brand bg-white/95 shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-[#d7e6dd]">
            <h2 className="border-b border-[#e8efe9] px-5 py-4 text-sm font-semibold text-brand">
              Actividad reciente
            </h2>
            {actividad.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-[#6b7280]">
                Todavía no hay movimientos. La actividad aparece cuando los invitados se registran o actualizan su información.
              </p>
            ) : (
              <ul className="px-3 py-3 sm:px-4">
                {actividad.map((row, idx) => (
                  <li
                    key={row.id}
                    className={`flex flex-col gap-1 px-3 py-3.5 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${
                      idx % 2 === 0
                        ? "rounded-xl bg-[#f0f7f2]"
                        : "rounded-xl bg-white"
                    }`}
                  >
                    <span className="font-medium text-[#111827]">{row.nombre}</span>
                    <span className="text-[#4b5563] sm:text-right">{row.accion}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Superposición: Link de invitación */}
          {openLink && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
              <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-brand">
                    Link de invitación
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpenLink(false)}
                    className="text-sm text-[#6b7280] hover:text-[#111827]"
                  >
                    ✕
                  </button>
                </div>
                <p className="mb-2 text-xs text-[#4b5563]">
                  Comparte este enlace con tus invitados para que confirmen su
                  asistencia al evento.
                </p>
                <p className="mb-3 rounded-xl bg-[#f0f7f2] px-3 py-2 text-[11px] leading-relaxed text-[#374151] ring-1 ring-[#c5dece]">
                  Si cargaste invitados por Excel o carga manual, enviá a cada uno el{" "}
                  <strong>enlace personal</strong> desde Gestión de invitados (ícono de enlace en la tabla).
                  Así la confirmación actualiza su fila (asistencia y restricciones). Este enlace es el genérico del
                  evento.
                </p>
                {loading ? (
                  <p className="text-[12px] text-[#9ca3af]">Cargando...</p>
                ) : !invitationUrl ? (
                  <p className="text-[12px] text-[#ef4444]">No tenés un evento vinculado. Pedile al administrador que te asigne uno.</p>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl border border-[#d1d5db] bg-[#f9fafb] px-3 py-2">
                    <span className="truncate text-[11px] text-[#111827]">
                      {invitationUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="whitespace-nowrap rounded-full bg-brand px-3 py-1 text-[11px] font-medium text-white hover:bg-brand/90"
                    >
                      {copied ? "¡Copiado!" : "Copiar"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

