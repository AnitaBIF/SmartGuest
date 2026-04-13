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
    <InvitadoShell mainClassName="flex flex-col items-center justify-center">
      <h1 className="mb-6 w-full text-center text-2xl font-bold text-brand md:mb-8 md:text-right md:self-end">
        QR de ingreso
      </h1>

      <div className="flex w-full min-w-0 max-w-md flex-col items-center gap-6">
          {loading ? (
            <p className="text-muted">Preparando tu código de ingreso…</p>
          ) : error ? (
            <div className="w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-center text-[14px] text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100 sm:px-5">
              {error}
            </div>
          ) : !payload ? (
            <p className="text-muted">No hay código disponible.</p>
          ) : (
            <>
              <div className="w-full rounded-2xl border border-border bg-card-muted px-4 py-4 text-center sm:px-5">
                <p className="text-[13px] font-semibold text-brand">Tu entrada, siempre al día</p>
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  Podés ver tu QR acá todos los días. Cambia cada {payload.windowSeconds} segundos, así que solo
                  sirve el que tenés en pantalla en ese instante.
                </p>
              </div>

              <p className="px-1 text-center text-[14px] leading-relaxed text-muted">
                El día del evento mostrá este QR en la entrada. Recordá mostrarlo desde esta página, no con una
                captura de pantalla.
              </p>

              {/* Fondo blanco fijo: mejor contraste para lectores en puerta (claro u oscuro en el resto de la UI). */}
              <div className="rounded-3xl bg-[#ffffff] p-4 shadow-lg ring-1 ring-border sm:p-6">
                <QRCodeSVG value={payload.token} size={qrSize} bgColor="#ffffff" fgColor="#111827" level="M" />
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="relative flex h-36 w-36 items-center justify-center">
                  <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 144 144">
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
                  <div className="text-center">
                    <span className="text-3xl font-extrabold text-foreground">{segRest}</span>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">seg</p>
                  </div>
                </div>
                <p className="text-[12px] text-muted">Se actualiza solo antes de que venza</p>
              </div>
            </>
          )}
      </div>
    </InvitadoShell>
  );
}
