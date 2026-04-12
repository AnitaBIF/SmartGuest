"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LeyendaObligatorios, Req } from "@/components/FormRequired";
import { AdminSidebar } from "./components/AdminSidebar";
import { MENUS_ESPECIALES_CATALOGO } from "@/lib/grupoFamiliar";
import { supabase } from "@/lib/supabase";
import ClockPicker from "./components/ClockPicker";
import DatePicker  from "./components/DatePicker";

/* ─── tipos internos para el calendario ─── */
type CalendarEvent = {
  id: string;
  day: number;
  month: number;
  year: number;
  color: "green" | "red" | "yellow";
  tipo: "evento" | "reunion";
  titulo: string;
  anfitriones?: string;
  anfitrion1?: string;
  anfitrion2?: string;
  tipoEvento?: string;
  fecha: string;
  fechaRaw: string;
  hora: string;
  invitados?: number;
  mesas?: number;
  menu?: string;
  menusEspeciales?: string[];
  menusOtro?: string;
  participantes?: string;
  notas?: string;
  montoTotal?: number;
  sena?: number;
  dressCode?: string;
  /** Lugar del evento (salón / quinta / nombre comercial) */
  salon?: string;
  /** Dirección postal del salón (obligatoria para mapa e invitaciones) */
  direccion?: string;
};

/* ─── helpers ─── */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function fmtMoney(n: number) {
  return `$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2 })}`;
}

/* ─── Logo ─── */
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

/* ─── Mini calendario ─── */
const DAYS_LABEL = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function MiniCalendar({ year, month, events, onDayClick, todayYear, todayMonth, todayDay }: {
  year: number;
  month: number;
  events: CalendarEvent[];
  onDayClick?: (ev: CalendarEvent) => void;
  todayYear: number;
  todayMonth: number;
  todayDay: number;
}) {
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const prevDays = getDaysInMonth(year, month - 1);
  const monthName = new Date(year, month, 1).toLocaleString("es-AR", { month: "long" }).toUpperCase();

  const eventMap = useMemo(() => {
    const m: Record<number, CalendarEvent> = {};
    events.filter((e) => e.month === month && e.year === year).forEach((e) => { m[e.day] = e; });
    return m;
  }, [events, month, year]);

  const colorHex: Record<string, string> = { green: "#22c55e", red: "#ef4444", yellow: "#f59e0b" };

  const cells: { day: number; current: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, current: false });
  for (let d = 1; d <= totalDays; d++) cells.push({ day: d, current: true });
  while (cells.length % 7 !== 0) cells.push({ day: cells.length - totalDays - firstDay + 2, current: false });

  return (
    <div className="flex-1">
      <h2 className="mb-4 text-center text-xl font-bold text-brand">{monthName}</h2>
      <div className="grid grid-cols-7 gap-y-1">
        {DAYS_LABEL.map((d) => (
          <div key={d} className="py-1 text-center text-[11px] font-semibold text-[#6b7280]">{d}</div>
        ))}
        {cells.map((cell, i) => {
          const ev = cell.current ? eventMap[cell.day] : null;
          const bg = ev ? colorHex[ev.color] : null;
          const isToday = cell.current && cell.day === todayDay && year === todayYear && month === todayMonth;
          return (
            <div key={i} className="flex items-center justify-center py-1">
              {bg ? (
                <button
                  type="button"
                  onClick={() => ev && onDayClick?.(ev)}
                  className="relative flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-white transition-opacity hover:opacity-80"
                  style={{ backgroundColor: bg }}
                  title={ev?.titulo}
                >
                  {cell.day}
                  {isToday && (
                    <span className="absolute bottom-0.5 left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full bg-white/80" />
                  )}
                </button>
              ) : (
                <span className={`relative flex h-8 w-8 items-center justify-center rounded-full text-[13px] ${cell.current ? "text-[#111827]" : "text-[#d1d5db]"}`}>
                  {cell.day}
                  {isToday && (
                    <span className="absolute bottom-0.5 left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full bg-[#2d5a41]" />
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Helpers de formulario (contraste alto + fondo explícito para legibilidad) ─── */
const inp =
  "w-full rounded-full border border-[#94a3b8] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#64748b] shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 flex-shrink-0 font-semibold text-[#374151]">{label}</span>
      <span className="text-[#4b5563]">{value}</span>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[12px] font-semibold tracking-wide text-[#1e293b]">
        {label}
        {required ? <Req /> : null}
      </label>
      {children}
    </div>
  );
}

/* ─── Modal detalle con edición completa ─── */
const editInp =
  "w-full rounded-full border border-[#94a3b8] bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#64748b] shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30";

function EventDetailModal({ event, onClose, onUpdated }: {
  event: CalendarEvent;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const isEvento = event.tipo === "evento";
  const [editing, setEditing] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved]     = useState(false);

  // Estado editable para evento
  const [eAnf1, setEAnf1]       = useState(event.anfitrion1 ?? "");
  const [eAnf2, setEAnf2]       = useState(event.anfitrion2 ?? "");
  const [eTipo, setETipo]        = useState(event.tipoEvento ?? "");
  const [eFecha, setEFecha]      = useState(event.fechaRaw);
  const [eHora, setEHora]        = useState(event.hora);
  const [eInv, setEInv]          = useState(String(event.invitados ?? 0));
  const [eMesas, setEMesas]      = useState(String(event.mesas ?? 0));
  const [eMenu, setEMenu]        = useState(event.menu ?? "");
  const [eDress, setEDress]      = useState(event.dressCode ?? "");
  const [eSalon, setESalon]      = useState(event.salon ?? "");
  const [eDireccion, setEDireccion] = useState(event.direccion ?? "");
  const [eMonto, setEMonto]      = useState(String(event.montoTotal ?? 0));
  const [eSena, setESena]        = useState(String(event.sena ?? 0));

  // Estado editable para reunión
  const [rTitulo, setRTitulo]               = useState(event.titulo);
  const [rFecha, setRFecha]                 = useState(event.fechaRaw);
  const [rHora, setRHora]                   = useState(event.hora);
  const [rParticipantes, setRParticipantes] = useState(event.participantes ?? "");
  const [rNotas, setRNotas]                 = useState(event.notas ?? "");

  const monto    = parseFloat(eMonto.replace(",", ".")) || 0;
  const sena     = parseFloat(eSena.replace(",", "."))  || 0;
  const faltante = monto - sena;

  const showSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2500); };

  const handleSaveEvento = async () => {
    if (!eSalon.trim() || !eDireccion.trim()) {
      alert("Completá el nombre del salón y la dirección (calle, número y ciudad) para que los invitados vean el mapa.");
      return;
    }
    setSaving(true);
    const tipoFinal = eTipo;
    const nombre = tipoFinal
      ? `${tipoFinal} ${[eAnf1, eAnf2].filter(Boolean).join(" y ")}`
      : [eAnf1, eAnf2].filter(Boolean).join(" y ") || "Evento";

    await fetch("/api/admin/eventos", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: event.id,
        nombre,
        tipo: tipoFinal || null,
        fecha: eFecha,
        horario: eHora,
        anfitrion1_nombre: eAnf1,
        anfitrion2_nombre: eAnf2 || null,
        salon: eSalon.trim(),
        direccion: eDireccion.trim(),
        cant_invitados: parseInt(eInv) || 0,
        cant_mesas: parseInt(eMesas) || 0,
        menu_standard: eMenu || null,
        dress_code: eDress || null,
        monto_total: monto,
        sena: sena,
      }),
    });
    setSaving(false);
    setEditing(false);
    showSaved();
    onUpdated();
  };

  const handleSaveReunion = async () => {
    setSaving(true);
    await fetch("/api/admin/reuniones", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: event.id, titulo: rTitulo, fecha: rFecha, hora: rHora,
        participantes: rParticipantes || null, notas: rNotas || null,
      }),
    });
    setSaving(false);
    setEditing(false);
    showSaved();
    onUpdated();
  };

  const handleDeleteReunion = async () => {
    setSaving(true);
    await fetch("/api/admin/reuniones", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: event.id }),
    });
    setSaving(false);
    onUpdated();
    onClose();
  };

  const handleDeleteEvento = async () => {
    if (
      !globalThis.confirm(
        "¿Eliminar este evento? Se borrarán mesas, invitados vinculados y datos asociados. Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/eventos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: event.id }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(typeof j.error === "string" ? j.error : "No se pudo eliminar el evento.");
        return;
      }
      onUpdated();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const bgColor = event.color === "green" ? "#dcfce7" : event.color === "red" ? "#fee2e2" : "#fef9c3";
  const badgeColor = event.color === "green" ? "#22c55e" : event.color === "red" ? "#ef4444" : "#f59e0b";

  const editBtn = (
    <button type="button" onClick={() => setEditing(true)}
      className="mt-2 flex items-center gap-1.5 rounded-full border border-brand px-4 py-1.5 text-[12px] font-medium text-brand transition-colors hover:bg-[#f0f7f2]">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      {isEvento ? "Editar evento" : "Editar reunión"}
    </button>
  );

  const saveBar = (onSave: () => void) => (
    <div className="flex gap-2 pt-1">
      <button type="button" onClick={() => setEditing(false)}
        className="flex-1 rounded-full border border-[#d1d5db] py-1.5 text-[12px] text-[#374151] hover:bg-white">Cancelar</button>
      <button type="button" onClick={onSave} disabled={saving}
        className="flex-1 rounded-full bg-[#2d5a41] py-1.5 text-[12px] font-semibold text-white hover:bg-[#24503a] disabled:opacity-60">
        {saving ? "Guardando..." : "Guardar"}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-xl ring-1 ring-black/5 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between rounded-t-3xl px-7 pt-6 pb-5 flex-shrink-0" style={{ backgroundColor: bgColor }}>
          <div>
            <span className="mb-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ backgroundColor: badgeColor }}>
              {isEvento ? "Evento" : "Reunión"}
            </span>
            <h2 className="text-lg font-bold text-[#111827]">{event.titulo}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-[#6b7280] hover:bg-white/60">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-7 py-5">
          <div className="space-y-3 text-[13px]">

          {isEvento && !editing && (
            <>
              <Row label="Fecha" value={`${event.fecha}, ${event.hora}`} />
              {event.anfitriones && <Row label="Anfitriones" value={event.anfitriones} />}
              {(event.salon || event.direccion) && (
                <Row
                  label="Lugar"
                  value={[event.salon, event.direccion].filter(Boolean).join(" — ") || "—"}
                />
              )}
              {event.invitados   ? <Row label="Invitados"   value={`${event.invitados} personas`} /> : null}
              {event.mesas       ? <Row label="Mesas"       value={`${event.mesas} mesas`} /> : null}
              {event.menu        && <Row label="Menú"        value={event.menu} />}
              {event.dressCode   && <Row label="Dress code"  value={event.dressCode} />}
              <hr className="border-[#e5efe8]" />
              <Row label="Monto total"  value={fmtMoney(event.montoTotal ?? 0)} />
              <Row label="Seña abonada" value={fmtMoney(event.sena ?? 0)} />
              <div className="flex gap-2">
                <span className="w-28 flex-shrink-0 font-semibold text-[#374151]">Pago faltante</span>
                <span className={`font-bold ${faltante > 0 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                  {faltante > 0 ? fmtMoney(faltante) : "✓ Pagado"}
                </span>
              </div>
              {editBtn}
            </>
          )}

          {isEvento && editing && (
            <div className="space-y-3 rounded-2xl border border-[#d1e7d9] bg-[#f5fbf7] p-4">
              <LeyendaObligatorios className="text-[11px] text-[#64748b]" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Anfitrión 1</label>
                  <input type="text" value={eAnf1} onChange={(e) => setEAnf1(e.target.value)} className={editInp} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Anfitrión 2</label>
                  <input type="text" value={eAnf2} onChange={(e) => setEAnf2(e.target.value)} className={editInp} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Tipo de evento</label>
                <input type="text" value={eTipo} onChange={(e) => setETipo(e.target.value)} className={editInp} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">
                  Nombre del salón / lugar
                  <Req />
                </label>
                <input
                  type="text"
                  placeholder="Ej: Salón Los Álamos"
                  value={eSalon}
                  onChange={(e) => setESalon(e.target.value)}
                  className={editInp}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">
                  Dirección del salón (calle, nº, ciudad)
                  <Req />
                </label>
                <input
                  type="text"
                  placeholder="Ej: Av. del Libertador 1250, Vicente López"
                  value={eDireccion}
                  onChange={(e) => setEDireccion(e.target.value)}
                  className={editInp}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">
                    Fecha
                    <Req />
                  </label>
                  <DatePicker value={eFecha} onChange={setEFecha} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Hora</label>
                  <ClockPicker value={eHora} onChange={setEHora} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Invitados</label>
                  <input type="number" min={0} value={eInv} onChange={(e) => setEInv(e.target.value)} className={editInp} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Mesas</label>
                  <input type="number" min={0} value={eMesas} onChange={(e) => setEMesas(e.target.value)} className={editInp} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Menú standard</label>
                <input type="text" value={eMenu} onChange={(e) => setEMenu(e.target.value)} className={editInp} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Dress code</label>
                <input type="text" value={eDress} onChange={(e) => setEDress(e.target.value)} className={editInp} />
              </div>
              <hr className="border-[#d1e7d9]" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Monto total</label>
                  <input type="text" value={eMonto} onChange={(e) => setEMonto(e.target.value)} className={editInp} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Seña abonada</label>
                  <input type="text" value={eSena} onChange={(e) => setESena(e.target.value)} className={editInp} />
                </div>
              </div>
              <div className="flex gap-2">
                <span className="text-[12px] font-semibold text-[#1e293b]">Pago faltante:</span>
                <span className={`text-[13px] font-bold ${faltante > 0 ? "text-[#ef4444]" : "text-[#22c55e]"}`}>
                  {faltante > 0 ? fmtMoney(faltante) : "✓ Pagado"}
                </span>
              </div>
              {saveBar(handleSaveEvento)}
            </div>
          )}

          {!isEvento && !editing && (
            <>
              <Row label="Fecha" value={`${event.fecha}, ${event.hora}`} />
              {event.participantes && <Row label="Participantes" value={event.participantes} />}
              {event.notas         && <Row label="Notas"         value={event.notas} />}
              {editBtn}
            </>
          )}

          {!isEvento && editing && (
            <div className="space-y-3 rounded-2xl border border-[#d1e7d9] bg-[#f5fbf7] p-4">
              <LeyendaObligatorios className="text-[11px] text-[#64748b]" />
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">
                  Título
                  <Req />
                </label>
                <input type="text" value={rTitulo} onChange={(e) => setRTitulo(e.target.value)} className={editInp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">
                    Fecha
                    <Req />
                  </label>
                  <DatePicker value={rFecha} onChange={setRFecha} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Hora</label>
                  <ClockPicker value={rHora} onChange={setRHora} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Participantes</label>
                <input type="text" value={rParticipantes} onChange={(e) => setRParticipantes(e.target.value)} className={editInp} />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-semibold text-[#1e293b]">Notas</label>
                <textarea
                  rows={2}
                  value={rNotas}
                  onChange={(e) => setRNotas(e.target.value)}
                  className="w-full rounded-2xl border border-[#94a3b8] bg-white px-3 py-2 text-sm text-[#0f172a] shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                />
              </div>
              {saveBar(handleSaveReunion)}
              <button type="button" onClick={handleDeleteReunion} disabled={saving}
                className="w-full rounded-full border border-[#ef4444] py-1.5 text-[12px] font-medium text-[#ef4444] hover:bg-[#fee2e2] disabled:opacity-60">
                Eliminar reunión
              </button>
            </div>
          )}

          {saved && (
            <p className="text-[12px] font-medium text-[#22c55e]">✓ Cambios guardados</p>
          )}

          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-7 py-4 flex-shrink-0 border-t border-[#e5efe8]">
          {isEvento ? (
            <button
              type="button"
              onClick={() => void handleDeleteEvento()}
              disabled={deleting || saving}
              className="rounded-full border border-[#fecaca] bg-white px-4 py-2 text-sm font-medium text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-60"
            >
              {deleting ? "Eliminando…" : "Eliminar evento"}
            </button>
          ) : (
            <span />
          )}
          <button type="button" onClick={onClose} className="rounded-full bg-[#2d5a41] px-6 py-2 text-sm font-medium text-white hover:bg-[#24503a]">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Página ─── */
export default function AdminDashboard() {
  const today = new Date();
  const [adminId, setAdminId]     = useState<string | null>(null);
  const [calEvents, setCalEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading]     = useState(true);

  const [showReunionModal, setShowReunionModal] = useState(false);
  const [reunion, setReunion] = useState({ titulo: "", fecha: "", hora: "", participantes: "" });
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventoModal, setShowEventoModal] = useState(false);
  const [savingEvento, setSavingEvento]   = useState(false);
  const [savingReunion, setSavingReunion] = useState(false);
  const [showMenusDropdown, setShowMenusDropdown] = useState(false);
  const [anfitriones, setAnfitriones] = useState<{ id: string; nombre: string; apellido: string }[]>([]);
  const [salonEventoDefaults, setSalonEventoDefaults] = useState({
    menusEspeciales: [] as string[],
    menusOtro: "",
    menuStandard: "",
  });
  const toggleMenu = (opcion: string) =>
    setEvento((p) => ({
      ...p,
      menusEspeciales: p.menusEspeciales.includes(opcion)
        ? p.menusEspeciales.filter((m) => m !== opcion)
        : [...p.menusEspeciales, opcion],
      menusOtro: opcion === "Otro" && p.menusEspeciales.includes("Otro") ? "" : p.menusOtro,
    }));
  const emptyEventoForm = () => ({
    anfitrionId: "",
    anfitrion1: "",
    anfitrion2: "",
    tipo: "",
    tipoOtro: "",
    fecha: "",
    horarioRecepcion: "",
    salon: "",
    direccionSalon: "",
    cantInvitados: "",
    cantMesas: "",
    menuStandard: "",
    menusEspeciales: [] as string[],
    menusOtro: "",
    montoTotal: "",
    sena: "",
    dressCode: "",
  });
  const [evento, setEvento] = useState(emptyEventoForm);
  const [eventoFormError, setEventoFormError] = useState("");
  const resetEvento = () => {
    setEventoFormError("");
    setEvento(emptyEventoForm());
  };
  const openNuevoEventoModal = () => {
    setEventoFormError("");
    setEvento({
      ...emptyEventoForm(),
      menusEspeciales: [...salonEventoDefaults.menusEspeciales],
      menusOtro: salonEventoDefaults.menusOtro,
      menuStandard: salonEventoDefaults.menuStandard,
    });
    setShowMenusDropdown(false);
    setShowEventoModal(true);
  };

  const pagoFaltante = (() => {
    const total = parseFloat(evento.montoTotal.replace(",", ".")) || 0;
    const sena  = parseFloat(evento.sena.replace(",", "."))  || 0;
    if (!total && !sena) return "";
    const faltante = total - sena;
    return fmtMoney(faltante);
  })();

  // Cargar perfil del admin y datos
  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) setAdminId(user.id);

    // Cargar anfitriones disponibles
    const anfRes = await fetch("/api/admin/usuarios");
    if (anfRes.ok) {
      const users = await anfRes.json();
      setAnfitriones(users.filter((u: { tipo: string }) => u.tipo === "anfitrion"));
    }

    const cuRes = await fetch("/api/admin/cuenta", { cache: "no-store" });
    if (cuRes.ok) {
      const c = await cuRes.json();
      setSalonEventoDefaults({
        menusEspeciales: Array.isArray(c.salonMenusEspeciales) ? c.salonMenusEspeciales : [],
        menusOtro: typeof c.salonMenusEspecialesOtro === "string" ? c.salonMenusEspecialesOtro : "",
        menuStandard: typeof c.salonMenuStandard === "string" ? c.salonMenuStandard : "",
      });
    }

    // Eventos
    const evRes = await fetch("/api/admin/eventos");
    const eventos = evRes.ok ? await evRes.json() : [];

    // Reuniones
    const reRes = await fetch("/api/admin/reuniones");
    const reuniones = reRes.ok ? await reRes.json() : [];

    // Transformar a CalendarEvent
    const mapped: CalendarEvent[] = [];

    for (const ev of eventos) {
      const d = new Date(ev.fecha + "T12:00:00");
      const anfitriones = [ev.anfitrion1_nombre, ev.anfitrion2_nombre].filter(Boolean).join(" y ");
      const faltante = (ev.monto_total ?? 0) - (ev.sena ?? 0);
      mapped.push({
        id: ev.id,
        day: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        color: faltante <= 0 ? "green" : "red",
        tipo: "evento",
        titulo: ev.nombre || ev.tipo || "Evento",
        tipoEvento: ev.tipo || "",
        anfitriones,
        anfitrion1: ev.anfitrion1_nombre || "",
        anfitrion2: ev.anfitrion2_nombre || "",
        fecha: d.toLocaleDateString("es-AR", { day: "numeric", month: "long" }),
        fechaRaw: ev.fecha,
        hora: ev.horario || "",
        invitados: ev.cant_invitados || 0,
        mesas: ev.cant_mesas || 0,
        menu: ev.menu_standard || "",
        menusEspeciales: ev.menus_especiales || [],
        menusOtro: ev.menus_especiales_otro || "",
        montoTotal: ev.monto_total,
        sena: ev.sena,
        dressCode: ev.dress_code || "",
        salon: ev.salon || "",
        direccion: ev.direccion || "",
      });
    }

    for (const r of reuniones) {
      const d = new Date(r.fecha + "T12:00:00");
      mapped.push({
        id: r.id,
        day: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        color: "yellow",
        tipo: "reunion",
        titulo: r.titulo,
        participantes: r.participantes || undefined,
        notas: r.notas || undefined,
        fecha: d.toLocaleDateString("es-AR", { day: "numeric", month: "long" }),
        fechaRaw: r.fecha,
        hora: r.hora || "—",
      });
    }

    setCalEvents(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Guardar evento real
  const handleCrearEvento = async () => {
    setEventoFormError("");
    if (!evento.fecha) {
      setEventoFormError("Elegí una fecha para el evento.");
      return;
    }
    const salon = evento.salon.trim();
    const direccion = evento.direccionSalon.trim();
    if (!salon || !direccion) {
      setEventoFormError("El nombre del salón y la dirección completa son obligatorios para crear el evento y mostrar el mapa a los invitados.");
      return;
    }

    setSavingEvento(true);

    const tipoFinal = evento.tipo === "Otro" ? evento.tipoOtro : evento.tipo;
    const nombre = tipoFinal
      ? `${tipoFinal} ${[evento.anfitrion1, evento.anfitrion2].filter(Boolean).join(" y ")}`
      : [evento.anfitrion1, evento.anfitrion2].filter(Boolean).join(" y ") || "Evento";

    const res = await fetch("/api/admin/eventos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        tipo: tipoFinal || null,
        fecha: evento.fecha,
        horario: evento.horarioRecepcion,
        salon,
        direccion,
        anfitrion_id: evento.anfitrionId || null,
        anfitrion1_nombre: evento.anfitrion1,
        anfitrion2_nombre: evento.anfitrion2 || null,
        cant_invitados: parseInt(evento.cantInvitados) || 0,
        cant_mesas: parseInt(evento.cantMesas) || 0,
        menu_standard: evento.menuStandard || null,
        monto_total: parseFloat(evento.montoTotal.replace(",", ".")) || 0,
        sena: parseFloat(evento.sena.replace(",", ".")) || 0,
        dress_code: evento.dressCode || null,
        menus_especiales: evento.menusEspeciales,
        menus_especiales_otro: evento.menusOtro || null,
      }),
    });

    setSavingEvento(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setEventoFormError(typeof j.error === "string" ? j.error : "No se pudo crear el evento.");
      return;
    }

    setShowEventoModal(false);
    setShowMenusDropdown(false);
    resetEvento();
    fetchData();
  };

  // Guardar reunión real
  const handleCrearReunion = async () => {
    if (!reunion.titulo || !reunion.fecha) return;
    setSavingReunion(true);

    await fetch("/api/admin/reuniones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titulo: reunion.titulo,
        fecha: reunion.fecha,
        hora: reunion.hora,
        participantes: reunion.participantes || null,
        creado_por: adminId,
      }),
    });

    setSavingReunion(false);
    setShowReunionModal(false);
    setReunion({ titulo: "", fecha: "", hora: "", participantes: "" });
    fetchData();
  };

  // Stats dinámicos
  const totalEventos   = calEvents.filter((e) => e.tipo === "evento").length;
  const totalReuniones = calEvents.filter((e) => e.tipo === "reunion").length;
  const proximoEvento  = calEvents
    .filter((e) => e.tipo === "evento")
    .sort((a, b) => {
      const da = new Date(a.year, a.month, a.day);
      const db = new Date(b.year, b.month, b.day);
      return da.getTime() - db.getTime();
    })
    .find((e) => new Date(e.year, e.month, e.day) >= today);

  const mes1Year  = today.getFullYear();
  const mes1Month = today.getMonth();
  const mes2Month = (mes1Month + 1) % 12;
  const mes2Year  = mes1Month === 11 ? mes1Year + 1 : mes1Year;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl gap-6 px-4 py-6 text-[#111827] sm:px-6 lg:px-8">
        <AdminSidebar active="dashboard" />

        <main className="flex-1 pb-8">
          <h1 className="mb-6 text-right text-2xl font-bold text-brand">Dashboard</h1>

          {/* Stat cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              { label: "Próximos Eventos",   value: loading ? "..." : String(totalEventos) },
              { label: "Impacto EcoGuest",   value: "—" },
              { label: "Próximas reuniones", value: loading ? "..." : String(totalReuniones) },
            ].map((card) => (
              <div key={card.label} className="rounded-2xl bg-[linear-gradient(135deg,#2d5a41,#3d7a56)] px-5 py-4 shadow-sm">
                <p className="text-[12px] font-medium text-[#a8d5b5]">{card.label}</p>
                <p className="mt-1 text-2xl font-bold text-white">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Calendarios */}
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-4 text-[12px] text-[#4b5563]">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#22c55e]" />Confirmado</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#ef4444]" />Pendiente</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-[#f59e0b]" />Reunión</span>
            </div>
            <button
              type="button"
              onClick={() => setShowReunionModal(true)}
              className="flex items-center gap-2 rounded-full border border-brand px-4 py-1.5 text-[13px] font-medium text-brand transition-colors hover:bg-[#f0f7f2]"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Agendar reunión
            </button>
          </div>
          <div className="mb-8 flex gap-8">
            <MiniCalendar year={mes1Year} month={mes1Month} events={calEvents} onDayClick={setSelectedEvent} todayYear={today.getFullYear()} todayMonth={today.getMonth()} todayDay={today.getDate()} />
            <MiniCalendar year={mes2Year} month={mes2Month} events={calEvents} onDayClick={setSelectedEvent} todayYear={today.getFullYear()} todayMonth={today.getMonth()} todayDay={today.getDate()} />
          </div>

          {/* Bottom row */}
          <div className="flex items-end justify-between gap-6">
            {proximoEvento ? (
              <button
                type="button"
                onClick={() => setSelectedEvent(proximoEvento)}
                className="w-full max-w-sm rounded-2xl border border-[#d7e6dd] bg-white px-6 py-5 shadow-sm text-left transition-shadow hover:shadow-md hover:border-brand"
              >
                <p className="mb-4 text-[13px] font-bold tracking-wide text-[#111827]">EVENTO MÁS PRÓXIMO</p>
                <div className="space-y-2 text-[13px]">
                  <p><span className="font-semibold text-[#374151]">TIPO:</span> <span className="text-[#4b5563]">{proximoEvento.titulo}</span></p>
                  {proximoEvento.anfitriones && (
                    <p><span className="font-semibold text-[#374151]">ANFITRIONES:</span> <span className="text-[#4b5563]">{proximoEvento.anfitriones}</span></p>
                  )}
                  <p><span className="font-semibold text-[#374151]">FECHA Y HORA:</span> <span className="text-[#4b5563]">{proximoEvento.fecha}, {proximoEvento.hora}</span></p>
                </div>
                <p className="mt-3 text-[11px] text-brand">Ver detalle →</p>
              </button>
            ) : (
              <div className="w-full max-w-sm rounded-2xl border border-[#d7e6dd] bg-white px-6 py-5 shadow-sm">
                <p className="text-[13px] text-[#9ca3af]">No hay eventos próximos.</p>
              </div>
            )}

            <button
              type="button"
              onClick={openNuevoEventoModal}
              className="whitespace-nowrap rounded-full bg-[#2d5a41] px-7 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#24503a]"
            >
              Crear evento nuevo
            </button>
          </div>
        </main>
      </div>

      {/* Modal crear evento: scroll interno para que todo el formulario sea accesible */}
      {showEventoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
          <div className="flex max-h-[min(92dvh,calc(100dvh-1.5rem))] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-black/10">
            <div className="flex shrink-0 items-center justify-between border-b border-[#e5efe8] bg-[#f8fafc] px-6 py-4 sm:px-7">
              <h2 className="text-lg font-bold text-[#0f172a]">Nuevo evento</h2>
              <button type="button" onClick={() => { setShowEventoModal(false); setShowMenusDropdown(false); resetEvento(); }} className="rounded-full p-1.5 text-[#475569] hover:bg-[#e2e8f0]" aria-label="Cerrar">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5 sm:px-7">
              <LeyendaObligatorios className="mb-3 text-[11px] text-[#64748b]" />
              <p className="mb-4 rounded-xl border border-[#c5dece] bg-[#f0f7f2] px-3 py-2.5 text-[11px] leading-relaxed text-[#374151]">
                Los menús se precargan desde{" "}
                <Link href="/admin/configuracion" className="font-semibold text-brand underline underline-offset-2">
                  Configuración → Carta del salón
                </Link>
                . Si cambió lo que ofrecen (cocina, presupuesto, carta), actualizá ahí y guardá: los próximos eventos nuevos usarán esos datos.
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="col-span-2">
                  <Field label="Vincular a usuario anfitrión">
                    <div className="relative">
                      <select
                        value={evento.anfitrionId}
                        onChange={(e) => {
                          const selected = anfitriones.find((a) => a.id === e.target.value);
                          setEvento((p) => ({
                            ...p,
                            anfitrionId: e.target.value,
                            anfitrion1: selected ? `${selected.nombre} ${selected.apellido}` : p.anfitrion1,
                          }));
                        }}
                        className={`${inp} appearance-none pr-8`}
                      >
                        <option value="">— Sin vincular —</option>
                        {anfitriones.map((a) => (
                          <option key={a.id} value={a.id}>{a.nombre} {a.apellido}</option>
                        ))}
                      </select>
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-xs">⌄</span>
                    </div>
                  </Field>
                </div>
                <Field label="Anfitrión 1 (nombre)">
                  <input type="text" value={evento.anfitrion1} onChange={(e) => setEvento((p) => ({ ...p, anfitrion1: e.target.value }))} className={inp} />
                </Field>
                <Field label="Anfitrión 2 (nombre)">
                  <input type="text" value={evento.anfitrion2} onChange={(e) => setEvento((p) => ({ ...p, anfitrion2: e.target.value }))} className={inp} />
                </Field>

                <Field label="Tipo de evento">
                  <div className="relative">
                    <select value={evento.tipo} onChange={(e) => setEvento((p) => ({ ...p, tipo: e.target.value, tipoOtro: "" }))} className={`${inp} appearance-none pr-8`}>
                      <option value="">Seleccionar tipo de evento</option>
                      <option>Casamiento</option>
                      <option>Cumpleaños de 15</option>
                      <option>Cumpleaños</option>
                      <option>Corporativo</option>
                      <option>Otro</option>
                    </select>
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-xs">⌄</span>
                  </div>
                  {evento.tipo === "Otro" && (
                    <input type="text" placeholder="Especificá el tipo de evento" value={evento.tipoOtro}
                      onChange={(e) => setEvento((p) => ({ ...p, tipoOtro: e.target.value }))}
                      className={`${inp} mt-1.5`} />
                  )}
                </Field>
                <Field label="Fecha" required>
                  <DatePicker value={evento.fecha} min={new Date().toISOString().split("T")[0]} onChange={(v) => setEvento((p) => ({ ...p, fecha: v }))} />
                </Field>

                <Field label="Horario de recepción">
                  <ClockPicker value={evento.horarioRecepcion} onChange={(v) => setEvento((p) => ({ ...p, horarioRecepcion: v }))} />
                </Field>
                <div className="col-span-2">
                  <Field label="Nombre del salón / lugar" required>
                    <input
                      type="text"
                      placeholder="Ej: Salón Los Álamos"
                      value={evento.salon}
                      onChange={(e) => setEvento((p) => ({ ...p, salon: e.target.value }))}
                      className={inp}
                    />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="Dirección del salón — calle, número y ciudad" required>
                    <input
                      type="text"
                      placeholder="Ej: Av. del Libertador 1250, Vicente López, Buenos Aires"
                      value={evento.direccionSalon}
                      onChange={(e) => setEvento((p) => ({ ...p, direccionSalon: e.target.value }))}
                      className={inp}
                    />
                  </Field>
                </div>
                <Field label="Menús especiales">
                  <div className="relative">
                    <button type="button" onClick={() => setShowMenusDropdown((v) => !v)} className={`${inp} flex items-center justify-between text-left`}>
                      <span className={evento.menusEspeciales.length === 0 ? "text-[#9ca3af]" : "text-[#111827]"}>
                        {evento.menusEspeciales.length === 0 ? "Seleccionar..." : evento.menusEspeciales.join(", ")}
                      </span>
                      <span className="text-[#6b7280] text-xs ml-2">⌄</span>
                    </button>
                    {showMenusDropdown && (
                      <div className="absolute z-20 mt-1 w-full rounded-xl border border-[#d1e7d9] bg-white shadow-lg">
                        {MENUS_ESPECIALES_CATALOGO.map((op) => (
                          <label key={op} className="flex cursor-pointer items-center gap-2.5 px-4 py-2.5 hover:bg-[#f0f7f2] first:rounded-t-xl last:rounded-b-xl">
                            <input type="checkbox" checked={evento.menusEspeciales.includes(op)} onChange={() => toggleMenu(op)} className="accent-[#2d5a41] h-4 w-4 rounded" />
                            <span className="text-sm text-[#374151]">{op}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {evento.menusEspeciales.includes("Otro") && (
                    <input type="text" placeholder="Especificá el menú especial" value={evento.menusOtro}
                      onChange={(e) => setEvento((p) => ({ ...p, menusOtro: e.target.value }))}
                      className={`${inp} mt-1.5`} />
                  )}
                  <p className="mt-1.5 text-[11px] leading-snug text-[#6b7280]">
                    Solo las opciones marcadas aparecerán para el anfitrión y los invitados al elegir menú.
                  </p>
                </Field>

                <Field label="Cantidad de invitados">
                  <input
                    type="number"
                    min={0}
                    placeholder="Ej: 120"
                    value={evento.cantInvitados}
                    onChange={(e) => setEvento((p) => ({ ...p, cantInvitados: e.target.value }))}
                    className={inp}
                  />
                </Field>
                <Field label="Cantidad de mesas">
                  <input
                    type="number"
                    min={0}
                    placeholder="Ej: 12"
                    value={evento.cantMesas}
                    onChange={(e) => setEvento((p) => ({ ...p, cantMesas: e.target.value }))}
                    className={inp}
                  />
                </Field>

                <Field label="Monto total">
                  <input type="text" placeholder="$ 0,00" value={evento.montoTotal} onChange={(e) => setEvento((p) => ({ ...p, montoTotal: e.target.value }))} className={inp} />
                </Field>
                <Field label="Seña">
                  <input type="text" placeholder="$ 0,00" value={evento.sena} onChange={(e) => setEvento((p) => ({ ...p, sena: e.target.value }))} className={inp} />
                </Field>
                <div className="col-span-2">
                  <Field label="Pago faltante">
                    <input type="text" readOnly value={pagoFaltante} placeholder="Se calcula automáticamente" className={`${inp} bg-[#f5fbf7] text-brand font-semibold cursor-default`} />
                  </Field>
                </div>

                <div className="col-span-2">
                  <Field label="Menú standard">
                    <textarea
                      rows={3}
                      value={evento.menuStandard}
                      onChange={(e) => setEvento((p) => ({ ...p, menuStandard: e.target.value }))}
                      className="w-full rounded-2xl border border-[#94a3b8] bg-white px-4 py-3 text-sm text-[#0f172a] placeholder:text-[#64748b] shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
                      placeholder="Detalle del menú principal del evento"
                    />
                  </Field>
                </div>

                <div className="col-span-2">
                  <Field label="Dress code">
                    <input type="text" placeholder="Ej: Formal, Cocktail, Casual elegante…" value={evento.dressCode}
                      onChange={(e) => setEvento((p) => ({ ...p, dressCode: e.target.value }))} className={inp} />
                  </Field>
                </div>
              </div>
            </div>

            {eventoFormError && (
              <p className="shrink-0 bg-red-50 px-6 py-2 text-center text-[13px] font-medium text-red-700 ring-1 ring-red-100 sm:px-7">
                {eventoFormError}
              </p>
            )}

            <div className="flex shrink-0 justify-center border-t border-[#e5efe8] bg-[#f8fafc] px-6 py-4 sm:px-7">
              <button
                type="button"
                onClick={handleCrearEvento}
                disabled={savingEvento}
                className="rounded-full bg-[#2d5a41] px-10 py-2.5 text-sm font-semibold text-white hover:bg-[#24503a] disabled:opacity-60"
              >
                {savingEvento ? "Guardando..." : "Crear evento"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle evento/reunión */}
      {selectedEvent && (
        <EventDetailModal
          key={selectedEvent.id}
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onUpdated={fetchData}
        />
      )}

      {/* Modal agendar reunión */}
      {showReunionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl ring-1 ring-black/5">
            <h2 className="mb-3 text-lg font-semibold text-brand">Agendar reunión</h2>
            <LeyendaObligatorios className="mb-4 text-[11px] text-[#6b7280]" />
            <div className="space-y-4">
              {(["titulo", "participantes"] as const).map((key) => (
                <div key={key}>
                  <label className="mb-1 block text-[12px] font-medium text-[#4b5563]">
                    {key === "titulo" ? (
                      <>
                        Título
                        <Req />
                      </>
                    ) : (
                      "Participantes"
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder={key === "titulo" ? "Ej: Reunión con cliente" : "Nombres separados por coma"}
                    value={reunion[key]}
                    onChange={(e) => setReunion((p) => ({ ...p, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-[#d1d5db] px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#4b5563]">
                    Fecha
                    <Req />
                  </label>
                  <DatePicker value={reunion.fecha} onChange={(v) => setReunion((p) => ({ ...p, fecha: v }))} />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-[#4b5563]">Hora</label>
                  <ClockPicker value={reunion.hora} onChange={(v) => setReunion((p) => ({ ...p, hora: v }))} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setShowReunionModal(false)}
                className="flex-1 rounded-xl border border-[#d1d5db] py-2 text-sm text-[#374151] hover:bg-[#f3f4f6]">
                Cancelar
              </button>
              <button type="button" onClick={handleCrearReunion} disabled={savingReunion}
                className="flex-1 rounded-xl bg-brand py-2 text-sm font-medium text-white hover:bg-[#24503a] disabled:opacity-60">
                {savingReunion ? "Guardando..." : "Agendar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
