"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string; // "HH:MM" 24 h
  onChange: (v: string) => void;
  className?: string;
};

const toRad = (deg: number) => (deg * Math.PI) / 180;

function parse(v: string): { h24: number; min: number } {
  if (!v) return { h24: 0, min: 0 };
  const [h, m] = v.split(":").map(Number);
  return { h24: isNaN(h) ? 0 : h, min: isNaN(m) ? 0 : m };
}

const CX = 100, CY = 100, R = 76;

function clockPos(angleDeg: number, radius = R) {
  return {
    x: CX + radius * Math.cos(toRad(angleDeg)),
    y: CY + radius * Math.sin(toRad(angleDeg)),
  };
}

export default function ClockPicker({ value, onChange, className = "" }: Props) {
  const [open, setOpen]   = useState(false);
  const [step, setStep]   = useState<"h" | "m">("h");
  const [h24,  setH24]    = useState(0);
  const [min,  setMin]    = useState(0);
  const [ampm, setAmpm]   = useState<"AM" | "PM">("AM");
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0, openUp: false });

  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const DROPDOWN_H = 340; // approximate height of the clock dropdown

  /* Position dropdown based on button's screen coordinates */
  const calcPos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < DROPDOWN_H + 8;
    setDropPos({
      top: openUp ? rect.top - DROPDOWN_H - 8 : rect.bottom + 8,
      left: rect.left,
      width: rect.width,
      openUp,
    });
  }, []);

  /* Close on outside click */
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

  /* Reposition on scroll/resize */
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

  const handleOpen = () => {
    const { h24: ph, min: pm } = parse(value);
    setH24(ph); setMin(pm);
    setAmpm(ph >= 12 ? "PM" : "AM");
    setStep("h");
    calcPos();
    setOpen(true);
  };

  const displayH = h24 % 12 || 12;

  const handAngleDeg = step === "h" ? displayH * 30 - 90 : min * 6 - 90;
  const handEnd      = clockPos(handAngleDeg, R - 14);

  const selectHour = (h: number) => {
    const newH24 = ampm === "AM" ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
    setH24(newH24);
    setStep("m");
  };

  const selectMinute = (m: number) => {
    setMin(m);
    onChange(`${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    setOpen(false);
    setStep("h");
  };

  const toggleAmPm = (ap: "AM" | "PM") => {
    const newH24 = ap === "AM" ? h24 % 12 : (h24 % 12) + 12;
    setAmpm(ap);
    setH24(newH24);
  };

  /* Button label */
  const { h24: bh, min: bm } = parse(value);
  const bDisplayH = bh % 12 || 12;
  const bAmPm     = bh >= 12 ? "PM" : "AM";
  const buttonLabel = value
    ? `${String(bDisplayH).padStart(2, "0")}:${String(bm).padStart(2, "0")} ${bAmPm}`
    : "Seleccionar hora";

  const hourItems   = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteItems = Array.from({ length: 12 }, (_, i) => i * 5);

  const dropdown = open ? (
    <div
      ref={dropRef}
      style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: Math.max(dropPos.width, 248), zIndex: 9999 }}
      className="rounded-2xl border border-border bg-card p-5 shadow-xl ring-1 ring-[var(--ring-soft)]"
    >
      {/* Header: HH : MM  +  AM/PM */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 text-[28px] font-bold leading-none">
          <button type="button" onClick={() => setStep("h")}
            className={`rounded px-1 transition-colors ${step === "h" ? "text-brand" : "text-muted hover:text-brand"}`}>
            {String(displayH).padStart(2, "0")}
          </button>
          <span className="text-muted">:</span>
          <button type="button" onClick={() => setStep("m")}
            className={`rounded px-1 transition-colors ${step === "m" ? "text-brand" : "text-muted hover:text-brand"}`}>
            {String(min).padStart(2, "0")}
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-border text-[11px] font-semibold">
          {(["AM", "PM"] as const).map((ap) => (
            <button key={ap} type="button" onClick={() => toggleAmPm(ap)}
              className={`block w-full px-2.5 py-1 transition-colors ${ampm === ap ? "bg-brand text-white" : "text-muted hover:bg-card-muted"}`}>
              {ap}
            </button>
          ))}
        </div>
      </div>

      {/* Step indicator */}
      <p className="mb-2 text-center text-[10px] font-medium uppercase tracking-widest text-muted">
        {step === "h" ? "Horas" : "Minutos"}
      </p>

      {/* SVG clock face */}
      <svg width="208" height="208" viewBox="0 0 200 200" className="mx-auto block">
        <circle cx={CX} cy={CY} r={R + 20} className="fill-[#f0f7f2] dark:fill-card-muted" />
        <line x1={CX} y1={CY} x2={handEnd.x} y2={handEnd.y} stroke="#2d5a41" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx={handEnd.x} cy={handEnd.y} r="5" fill="#2d5a41" />
        <circle cx={CX} cy={CY} r="4" fill="#2d5a41" />

        {step === "h"
          ? hourItems.map((h) => {
              const p   = clockPos(h * 30 - 90);
              const sel = displayH === h;
              return (
                <g key={h} onClick={() => selectHour(h)} style={{ cursor: "pointer" }}>
                  <circle cx={p.x} cy={p.y} r="15" fill={sel ? "#2d5a41" : "transparent"}
                    className={sel ? "" : "hover:fill-emerald-200/40 dark:hover:fill-zinc-600"} />
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                    fontSize="13" fontWeight={sel ? "700" : "400"} className={sel ? "fill-white" : "fill-[#374151] dark:fill-zinc-200"}
                    style={{ pointerEvents: "none" }}>{h}</text>
                </g>
              );
            })
          : minuteItems.map((m) => {
              const p   = clockPos(m * 6 - 90);
              const sel = min === m;
              return (
                <g key={m} onClick={() => selectMinute(m)} style={{ cursor: "pointer" }}>
                  <circle cx={p.x} cy={p.y} r="15" fill={sel ? "#2d5a41" : "transparent"}
                    className={sel ? "" : "hover:fill-emerald-200/40 dark:hover:fill-zinc-600"} />
                  <text x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central"
                    fontSize="11" fontWeight={sel ? "700" : "400"} className={sel ? "fill-white" : "fill-[#374151] dark:fill-zinc-200"}
                    style={{ pointerEvents: "none" }}>{String(m).padStart(2, "0")}</text>
                </g>
              );
            })
        }
      </svg>
    </div>
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleOpen}
        className="flex h-[38px] w-full items-center justify-between rounded-xl border border-border bg-input px-3 py-2 text-sm whitespace-nowrap text-foreground shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      >
        <span className={value ? "font-medium" : "text-muted"}>{buttonLabel}</span>
        <svg className="h-4 w-4 shrink-0 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </button>

      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
}
