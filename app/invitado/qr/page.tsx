"use client";

import { useCallback, useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { InvitadoShell } from "@/components/InvitadoShell";

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
  const [qrSize, setQrSize] = useState(220);

  useEffect(() => {
    const ro = () => {
      const w = typeof window !== "undefined" ? window.innerWidth : 400;
      setQrSize(w < 380 ? 176 : w < 420 ? 200 : 220);
    };
    ro();
    window.addEventListener("resize", ro);
    return () => window.removeEventListener("resize", ro);
  }, []);

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
    <InvitadoShell mainClassName="flex flex-col items-center">
      <div className="flex w-full max-w-md flex-col items-center gap-5 sm:gap-6">
        <h1 className="w-full text-balance text-center text-2xl font-bold text-brand md:text-right">
          QR de ingreso
        </h1>

        {loading ? (
          <p className="text-center text-muted">Preparando tu código de ingreso…</p>
        ) : error ? (
          <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-center text-[14px] text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-5">
            {error}
          </div>
        ) : !payload ? (
          <p className="text-center text-muted">No hay código disponible.</p>
        ) : (
          <>
            <div className="w-full rounded-2xl border border-border bg-card-muted px-4 py-4 text-center sm:px-5">
              <p className="text-[13px] font-semibold text-brand">Código en vivo (no sirve una foto fija)</p>
              <p className="mt-2 text-[12px] leading-relaxed text-muted">
                El QR se renueva cada {payload.windowSeconds} segundos: solo es válido el que ves ahora en esta pantalla. Una
                captura de pantalla deja de servir al rato y en la puerta suelen rechazarla.
              </p>
            </div>

            <div className="w-full rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2.5 text-center text-[11px] leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/35 dark:text-amber-100">
              En el navegador <strong>no se puede impedir</strong> que saquen foto de pantalla; por eso el código cambia
              solo y seguridad ve si es primer ingreso o reingreso. En el evento abrí esta página en vivo.
            </div>

            <p className="w-full px-1 text-center text-[14px] leading-relaxed text-muted">
              En la entrada mostrá <strong>esta pantalla abierta</strong> (contador corriendo). No uses imagen guardada.
            </p>

            {/* select-none / touch-callout: en algunos móviles reduce guardar imagen con pulsación larga; no bloquea captura del sistema. */}
            <div className="flex w-full justify-center">
              <div
                className="rounded-3xl bg-[#ffffff] p-4 shadow-lg ring-1 ring-border sm:p-6 [&_svg]:pointer-events-none select-none [-webkit-touch-callout:none] [-webkit-user-select:none] [user-select:none]"
                aria-describedby="qr-live-hint"
              >
                <p id="qr-live-hint" className="sr-only">
                  Código bidimensional que se actualiza solo; mostrar en vivo en la entrada.
                </p>
                <div className="mb-2 flex justify-center">
                  <span className="rounded-md bg-emerald-600/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200">
                    En vivo · no foto
                  </span>
                </div>
                <QRCodeSVG
                  value={payload.token}
                  size={qrSize}
                  bgColor="#ffffff"
                  fgColor="#111827"
                  level="M"
                  className="mx-auto block h-auto w-auto max-w-full"
                />
              </div>
            </div>

            <div className="flex w-full flex-col items-center gap-2">
              <div className="relative mx-auto flex h-36 w-36 shrink-0 items-center justify-center">
                <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144" aria-hidden>
                  <circle
                    cx="72"
                    cy="72"
                    r={radius}
                    fill="none"
                    className="stroke-[#e5e7eb] dark:stroke-zinc-600"
                    strokeWidth="8"
                  />
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
                <div className="relative text-center">
                  <span className="text-3xl font-extrabold text-foreground">{segRest}</span>
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">seg</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </InvitadoShell>
  );
}
