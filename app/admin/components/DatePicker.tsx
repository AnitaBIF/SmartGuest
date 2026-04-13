"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string;        // "YYYY-MM-DD"
  onChange: (v: string) => void;
  min?: string;         // "YYYY-MM-DD"
  className?: string;
};

const MONTHS_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAYS_ES   = ["Do","Lu","Ma","Mi","Ju","Vi","Sá"];

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}
function firstWeekday(y: number, m: number) {
  return new Date(y, m, 1).getDay(); // 0=Sun
}
function formatDisplay(v: string) {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}`;
}

const DROPDOWN_H = 310;

export default function DatePicker({ value, onChange, min, className = "" }: Props) {
  const today = new Date();

  const initYear  = value ? parseInt(value.split("-")[0]) : today.getFullYear();
  const initMonth = value ? parseInt(value.split("-")[1]) - 1 : today.getMonth();

  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(initYear);
  const [viewMonth, setViewMonth] = useState(initMonth);
  const [dropPos,   setDropPos]   = useState({ top: 0, left: 0, width: 0 });

  const btnRef  = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top = spaceBelow < DROPDOWN_H + 8 ? rect.top - DROPDOWN_H - 8 : rect.bottom + 8;
    setDropPos({ top, left: rect.left, width: rect.width });
  }, []);

  const handleOpen = () => {
    const y = value ? parseInt(value.split("-")[0]) : today.getFullYear();
    const m = value ? parseInt(value.split("-")[1]) - 1 : today.getMonth();
    setViewYear(y);
    setViewMonth(m);
    calcPos();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const update = () => calcPos();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, calcPos]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const selectDay = (d: number) => {
    const str = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    onChange(str);
    setOpen(false);
  };

  const isDisabled = (d: number) => {
    if (!min) return false;
    const str = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return str < min;
  };

  const isSelected = (d: number) => {
    if (!value) return false;
    const str = `${viewYear}-${String(viewMonth + 1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    return str === value;
  };

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  /* Build calendar grid */
  const total   = daysInMonth(viewYear, viewMonth);
  const startDow = firstWeekday(viewYear, viewMonth);
  const cells: (number | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const dropdown = open ? (
    <div
      ref={dropRef}
      style={{ position: "fixed", top: dropPos.top, left: dropPos.left, minWidth: Math.max(dropPos.width, 260), zIndex: 9999 }}
      className="rounded-2xl bg-white p-4 shadow-xl ring-1 ring-black/10 select-none"
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={prevMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f0f7f2] transition-colors">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="text-sm font-semibold text-foreground">
          {MONTHS_ES[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth}
          className="flex h-7 w-7 items-center justify-center rounded-full text-[#6b7280] hover:bg-[#f0f7f2] transition-colors">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_ES.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-semibold text-[#9ca3af]">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const sel  = isSelected(d);
          const tod  = isToday(d);
          const dis  = isDisabled(d);
          return (
            <button
              key={i}
              type="button"
              disabled={dis}
              onClick={() => selectDay(d)}
              className={`
                relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[13px] transition-colors
                ${dis  ? "text-[#d1d5db] cursor-not-allowed" : ""}
                ${!dis && !sel ? "text-[#374151] hover:bg-[#e0ede6]" : ""}
                ${sel  ? "bg-[#2d5a41] text-white font-semibold" : ""}
              `}
            >
              {d}
              {tod && !sel && (
                <span className="absolute bottom-0.5 left-1/2 h-[2px] w-3 -translate-x-1/2 rounded-full bg-[#2d5a41]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex h-[38px] w-full items-center justify-between rounded-xl border border-[#94a3b8] bg-white px-3 py-2 text-sm whitespace-nowrap shadow-sm outline-none focus:border-[#2d5a41] focus:ring-2 focus:ring-[#2d5a41]/30"
      >
        <span className={value ? "font-medium text-[#0f172a]" : "text-[#64748b]"}>
          {formatDisplay(value) ?? "dd/mm/aaaa"}
        </span>
        <svg className="h-4 w-4 flex-shrink-0 text-[#6b7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </button>

      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
