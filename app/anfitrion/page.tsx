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
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm ring-1 ring-[var(--ring-soft)]">
        <h3 className="mb-4 text-sm font-semibold text-brand">{label}</h3>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-card-muted ring-1 ring-border">
            <span className="px-3 text-center text-[10px] font-medium leading-tight text-muted">
              Sin datos
            </span>
          </div>
          <p className="text-[12px] leading-relaxed text-muted">
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
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm ring-1 ring-[var(--ring-soft)]">
      <h3 className="mb-4 text-sm font-semibold text-brand">{label}</h3>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="relative mx-auto h-28 w-28 shrink-0 sm:mx-0">
          <div
            className="h-full w-full rounded-full bg-card shadow-sm ring-1 ring-border dark:shadow-black/30"
            style={{ backgroundImage: gradient }}
          />
          <div className="pointer-events-none absolute inset-6 rounded-full bg-card/95 ring-1 ring-border backdrop-blur-sm dark:bg-card" />
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5 text-[13px]">
          {items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-full bg-card-muted px-3 py-1.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate text-muted">{item.label}</span>
              </div>
              <span className="shrink-0 font-semibold tabular-nums text-foreground">
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
  /** Legible en panel claro y en `bg-card` oscuro (evita #444 sobre gris) */
  pendientes: "#64748b",
};

const MESAS_COLORS = {
  pendientes: "#64748b",
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
    /** Personas confirmadas (incluye grupo familiar). */
    confirmados: number;
    invitacionesConfirmadas: number;
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
    invitacionesConfirmadas: 0,
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
    <div className="min-h-screen text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:px-8 text-foreground">
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
            <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-5 py-4 text-white shadow-md shadow-brand/40 dark:bg-[linear-gradient(135deg,#1e3d2d,#2a5240)] dark:shadow-black/40">
              <p className="text-xs uppercase tracking-wide opacity-80">
                Días para el evento
              </p>
              <p className="mt-1 text-2xl font-semibold">{data?.evento.diasRestantes ?? "—"} días</p>
            </div>
            <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-5 py-4 text-white shadow-md shadow-brand/40 dark:bg-[linear-gradient(135deg,#1e3d2d,#2a5240)] dark:shadow-black/40">
              <p className="text-xs uppercase tracking-wide opacity-80">
                Capacidad del salón
              </p>
              <p className="mt-1 text-2xl font-semibold">{data?.evento.cantInvitados ?? "—"} invitados</p>
            </div>
            <div className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3f7a52)] px-5 py-4 text-white shadow-md shadow-brand/40 dark:bg-[linear-gradient(135deg,#1e3d2d,#2a5240)] dark:shadow-black/40">
              <p className="text-xs uppercase tracking-wide opacity-80">
                Cantidad de mesas
              </p>
              <p className="mt-1 text-2xl font-semibold">{data?.evento.cantMesas ?? "—"} mesas</p>
            </div>
          </section>

          <p className="mb-6 rounded-2xl border border-border bg-card px-4 py-3 text-[12px] leading-relaxed text-muted shadow-sm ring-1 ring-[var(--ring-soft)]">
            <span className="font-semibold text-foreground">Menús especiales para invitados: </span>
            {menusOfrecidosText}
          </p>

          {/* Donut charts grid — valores reales desde Supabase (sin mínimos artificiales) */}
          <section className="grid gap-4 md:grid-cols-2">
            <div>
              <Donut
                label="Invitados"
                emptyHint="Cuando cargues invitados (Excel, manual o link), verás confirmados, rechazos y pendientes."
                legend={[
                  {
                    label: "Confirmados",
                    value: stats.confirmados,
                    color: INVITED_COLORS.confirmados,
                  },
                  { label: "No asiste", value: stats.noAsiste, color: INVITED_COLORS.noAsiste },
                  { label: "Pendientes", value: stats.pendientes, color: INVITED_COLORS.pendientes },
                ]}
              />
              {stats.invitacionesConfirmadas > 0 && stats.confirmados !== stats.invitacionesConfirmadas && (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">
                  {stats.invitacionesConfirmadas} invitación
                  {stats.invitacionesConfirmadas === 1 ? "" : "es"} confirmada
                  {stats.invitacionesConfirmadas === 1 ? "" : "s"} · {stats.confirmados} personas en total
                </p>
              )}
            </div>
            <Donut
              label="Mesas"
              emptyHint="Igual que SmartSeat: cupo por mesa = invitados del evento ÷ cantidad de mesas (redondeado hacia arriba). La ocupación cuenta personas (grupo familiar), no solo filas de invitación."
              legend={[
                { label: "Pendientes", value: stats.mesasPendientes, color: MESAS_COLORS.pendientes },
                { label: "Incompletas", value: stats.mesasIncompletas, color: MESAS_COLORS.incompletas },
                { label: "Completas", value: stats.mesasCompletas, color: MESAS_COLORS.completas },
              ]}
            />
            <Donut
              label="Menús"
              emptyHint="Solo confirmados: una fila por persona del grupo si cargaron menú por integrante; si no, se usa la restricción única de la invitación."
              legend={[
                { label: "Standard", value: stats.menuStandard, color: "#6cc58c" },
                { label: "Celíaco", value: stats.menuCeliaco, color: "#b0c4de" },
                { label: "Otros", value: stats.menuOtros, color: "#64748b" },
              ]}
            />
            <Donut
              label="EcoGuests"
              emptyHint="Solo entre confirmados: Sí = conductor o pasajero en SmartPool; No = resto."
              legend={[
                { label: "Sí", value: stats.ecoSi, color: "#6cc58c" },
                { label: "No", value: stats.ecoNo, color: "#64748b" },
              ]}
            />
          </section>

          {/* Actividad reciente */}
          <section className="mt-8 overflow-hidden rounded-2xl border border-border border-t-[3px] border-t-brand bg-card shadow-[0_8px_30px_rgba(0,0,0,0.06)] ring-1 ring-[var(--ring-soft)] dark:shadow-black/25">
            <h2 className="border-b border-border-subtle px-5 py-4 text-sm font-semibold text-brand">
              Actividad reciente
            </h2>
            {actividad.length === 0 ? (
              <p className="px-5 py-10 text-center text-[13px] text-muted">
                Todavía no hay movimientos. La actividad aparece cuando los invitados se registran o actualizan su información.
              </p>
            ) : (
              <ul className="px-3 py-3 sm:px-4">
                {actividad.map((row, idx) => (
                  <li
                    key={row.id}
                    className={`flex flex-col gap-1 px-3 py-3.5 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:gap-6 ${
                      idx % 2 === 0 ? "rounded-xl bg-card-muted" : "rounded-xl bg-card"
                    }`}
                  >
                    <span className="font-medium text-foreground">{row.nombre}</span>
                    <span className="text-muted sm:text-right">{row.accion}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Superposición: Link de invitación */}
          {openLink && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 dark:bg-black/55">
              <div className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-xl ring-1 ring-[var(--ring-soft)]">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-base font-semibold text-brand">
                    Link de invitación
                  </h2>
                  <button
                    type="button"
                    onClick={() => setOpenLink(false)}
                    className="text-sm text-muted hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
                <p className="mb-2 text-xs text-muted">
                  Comparte este enlace con tus invitados para que confirmen su
                  asistencia al evento.
                </p>
                <p className="mb-3 rounded-xl border border-border bg-card-muted px-3 py-2 text-[11px] leading-relaxed text-foreground ring-1 ring-[var(--ring-soft)]">
                  Si cargaste invitados por Excel o carga manual, enviá a cada uno el{" "}
                  <strong>enlace personal</strong> desde Gestión de invitados (ícono de enlace en la tabla).
                  Así la confirmación actualiza su fila (asistencia y restricciones). Este enlace es el genérico del
                  evento.
                </p>
                {loading ? (
                  <p className="text-[12px] text-muted">Cargando...</p>
                ) : !invitationUrl ? (
                  <p className="text-[12px] text-[#ef4444]">No tenés un evento vinculado. Pedile al administrador que te asigne uno.</p>
                ) : (
                  <div className="flex items-center gap-2 rounded-2xl border border-border bg-card-muted px-3 py-2">
                    <span className="truncate text-[11px] text-foreground">
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

