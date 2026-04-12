"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import Sidebar from "../components/Sidebar";

type QrPayload = {
  token: string;
  expiresInMs: number;
  windowSeconds: number;
  scheme?: string;
};

export default function QRPage() {
  const [payload, setPayload] = useState<QrPayload | null>(null);
  const [segRest, setSegRest] = useState(30);
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/invitado/qr-token", { cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(typeof data.error === "string" ? data.error : "No se pudo obtener el código.");
      setPayload(null);
      setDeadlineMs(null);
      setLoading(false);
      return;
    }
    setError(null);
    const expiresInMs = data.expiresInMs as number;
    const windowSeconds = (data.windowSeconds as number) || 30;
    setPayload({
      token: data.token as string,
      expiresInMs,
      windowSeconds,
    });
    const until = Date.now() + expiresInMs;
    setDeadlineMs(until);
    setSegRest(Math.max(1, Math.ceil(expiresInMs / 1000)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Programar la próxima renovación según el vencimiento real (deadlineMs), no según el token:
  // mientras la ventana HMAC no cambie, el string del QR es idéntico y [payload?.token] no dispara
  // el efecto de nuevo — por eso el QR dejaba de rotar aunque el contador llegara a 0.
  useEffect(() => {
    if (deadlineMs == null) return;
    const ms = Math.max(400, deadlineMs - Date.now() - 600);
    const t = setTimeout(() => void refresh(), ms);
    return () => clearTimeout(t);
  }, [deadlineMs, refresh]);

  useEffect(() => {
    if (deadlineMs == null) return;
    const id = setInterval(() => {
      const sec = Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
      setSegRest(sec);
    }, 250);
    return () => clearInterval(id);
  }, [deadlineMs]);

  const pct = payload ? (segRest <= 0 ? 0 : segRest / payload.windowSeconds) : 1;
  const radius = 60;
  const circ = 2 * Math.PI * radius;
  const dash = circ * pct;
  const ringColor = pct > 0.5 ? "#22c55e" : pct > 0.2 ? "#f59e0b" : "#ef4444";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
        <Sidebar />

        <main className="flex flex-1 flex-col items-center justify-center pb-8">
          <h1 className="mb-8 self-end text-2xl font-bold text-brand">QR de ingreso</h1>

          {loading ? (
            <p className="text-[#9ca3af]">Preparando tu código de ingreso…</p>
          ) : error ? (
            <div className="max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-center text-[14px] text-amber-900">
              {error}
            </div>
          ) : !payload ? (
            <p className="text-[#6b7280]">No hay código disponible.</p>
          ) : (
            <div className="flex max-w-md flex-col items-center gap-6">
              <div className="rounded-2xl border border-[#c5dece] bg-[#f0f7f2] px-5 py-4 text-center">
                <p className="text-[13px] font-semibold text-[#2d5a41]">Tu entrada, siempre al día</p>
                <p className="mt-2 text-[12px] leading-relaxed text-[#4b5563]">
                  Podés ver tu QR acá todos los días. Cambia cada {payload.windowSeconds} segundos, así que solo
                  sirve el que tenés en pantalla en ese instante.
                </p>
              </div>

              <p className="text-center text-[14px] leading-relaxed text-[#4b5563]">
                El día del evento mostrá este QR en la entrada. Recordá mostrarlo desde esta página, no con una
                captura de pantalla.
              </p>

              <div className="rounded-3xl bg-white p-6 shadow-lg ring-1 ring-[#c5dece]">
                <QRCodeSVG value={payload.token} size={220} bgColor="#ffffff" fgColor="#111827" level="M" />
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
                    <circle cx="72" cy="72" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle
                      cx="72"
                      cy="72"
                      r={radius}
                      fill="none"
                      stroke={ringColor}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${dash} ${circ}`}
                      style={{ transition: "stroke-dasharray 0.9s linear, stroke 0.5s" }}
                    />
                  </svg>
                  <div className="text-center">
                    <span className="text-3xl font-extrabold text-[#111827]">{segRest}</span>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">seg</p>
                  </div>
                </div>
                <p className="text-[12px] text-[#6b7280]">Se actualiza solo antes de que venza</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
