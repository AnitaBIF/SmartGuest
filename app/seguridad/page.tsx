"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { logout } from "@/lib/supabase";

type GuestInfo = {
  nombre: string;
  dni: string;
  mesa: number | null;
  evento: string;
};

type Estado = "scanning" | "valid" | "invalid" | "validating";

/* ─── Logo ─── */
function Logo({ dark }: { dark?: boolean }) {
  const c = dark ? "#2d5a41" : "white";
  return (
    <span className="text-xl font-extrabold tracking-tight" style={{ color: c }}>
      SMART<span className="font-normal" style={{ fontFamily: "var(--font-poppins)", color: c }}>GUEST</span>
    </span>
  );
}

function SadFace() {
  return (
    <svg viewBox="0 0 60 60" className="h-16 w-16" fill="none">
      <circle cx="20" cy="22" r="4" fill="#2d5a41" />
      <circle cx="40" cy="22" r="4" fill="#2d5a41" />
      <path d="M18 44 Q30 34 42 44" stroke="#2d5a41" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export default function SeguridadPage() {
  const [estado, setEstado] = useState<Estado>("scanning");
  const [guest, setGuest] = useState<GuestInfo | null>(null);
  const [invalidMsg, setInvalidMsg] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const qrRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const validarToken = useCallback(async (raw: string) => {
    setEstado("validating");
    setInvalidMsg(null);
    try {
      const r = await fetch("/api/seguridad/validar-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: raw.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setInvalidMsg(typeof data.error === "string" ? data.error : "Código no válido.");
        setEstado("invalid");
        return;
      }
      setGuest({
        nombre: data.nombre as string,
        dni: data.dni as string,
        mesa: (data.mesa as number | null) ?? null,
        evento: (data.evento as string) || "Evento",
      });
      setEstado("valid");
    } catch {
      setInvalidMsg("Error de red al validar.");
      setEstado("invalid");
    }
  }, []);

  const startScanner = useCallback(async () => {
    setCamError(null);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const qr = new Html5Qrcode("qr-reader-div");

      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        (text) => {
          void qr.stop().catch(() => {});
          qrRef.current = null;
          void validarToken(text);
        },
        () => {}
      );
      qrRef.current = qr;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setCamError(
        msg.includes("permission") || msg.includes("NotAllowed")
          ? "Permiso de cámara denegado. Habilitalo en la configuración del navegador."
          : "No se pudo acceder a la cámara."
      );
    }
  }, [validarToken]);

  useEffect(() => {
    if (estado !== "scanning") return;
    const t = setTimeout(() => startScanner(), 150);
    return () => {
      clearTimeout(t);
      qrRef.current?.stop().catch(() => {});
      qrRef.current = null;
    };
  }, [estado, scanKey, startScanner]);

  const reset = () => {
    setGuest(null);
    setCamError(null);
    setInvalidMsg(null);
    setEstado("scanning");
    setScanKey((k) => k + 1);
  };

  if (estado === "validating") {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#3a3a3a] px-6">
        <Logo />
        <p className="mt-8 text-center text-lg font-medium text-white">Verificando código…</p>
        <p className="mt-2 max-w-xs text-center text-sm text-white/60">Un momento por favor.</p>
      </div>
    );
  }

  if (estado === "scanning") {
    return (
      <div className="flex min-h-[100dvh] flex-col" style={{ backgroundColor: "#3a3a3a" }}>
        <header className="flex items-center justify-between px-6 pt-6 pb-2">
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-white/30 px-4 py-2 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10"
          >
            Cerrar sesión
          </button>
          <Logo />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-6 pb-12">
          <div className="relative mb-8" style={{ width: 280, height: 280 }}>
            <div
              id="qr-reader-div"
              key={scanKey}
              className="h-full w-full overflow-hidden rounded-2xl bg-black/40"
              style={{ minHeight: 280 }}
            />

            {(["tl", "tr", "bl", "br"] as const).map((pos) => (
              <span
                key={pos}
                className="absolute h-9 w-9"
                style={{
                  top: pos.startsWith("t") ? 0 : "auto",
                  bottom: pos.startsWith("b") ? 0 : "auto",
                  left: pos.endsWith("l") ? 0 : "auto",
                  right: pos.endsWith("r") ? 0 : "auto",
                  borderTop: pos.startsWith("t") ? "4px solid #f59e0b" : undefined,
                  borderBottom: pos.startsWith("b") ? "4px solid #f59e0b" : undefined,
                  borderLeft: pos.endsWith("l") ? "4px solid #f59e0b" : undefined,
                  borderRight: pos.endsWith("r") ? "4px solid #f59e0b" : undefined,
                  borderRadius:
                    pos === "tl" ? "12px 0 0 0" : pos === "tr" ? "0 12px 0 0" : pos === "bl" ? "0 0 0 12px" : "0 0 12px 0",
                }}
              />
            ))}
          </div>

          {camError ? (
            <p className="max-w-xs text-center text-sm text-red-300">{camError}</p>
          ) : (
            <p className="text-center text-base text-white/80">Escanee el QR dinámico del invitado</p>
          )}
        </div>
      </div>
    );
  }

  if (estado === "valid" && guest) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        <header className="flex items-center justify-between px-6 pt-6 pb-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-[#d1d5db] px-4 py-2 text-[13px] font-medium text-[#374151] transition-colors hover:bg-[#f3f4f6]"
          >
            ← Volver
          </button>
          <Logo dark />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
          <p className="mb-2 rounded-full bg-[#ecfdf5] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#166534]">
            Verificado
          </p>
          <h1 className="mb-2 text-4xl font-extrabold" style={{ color: "#2d5a41" }}>
            {guest.nombre}
          </h1>
          <p className="mb-6 text-sm text-[#6b7280]">{guest.evento}</p>

          <div className="mb-8 space-y-2">
            <p className="text-lg text-[#4b5563]">
              DNI: <span className="font-semibold">{guest.dni}</span>
            </p>
            <p className="text-lg text-[#4b5563]">
              Mesa:{" "}
              <span className="font-semibold">{guest.mesa != null ? `N° ${guest.mesa}` : "Sin asignar"}</span>
            </p>
          </div>

          <p className="mb-8 text-base font-semibold" style={{ color: "#2d5a41" }}>
            Corroborá el DNI con el documento.
          </p>

          <div className="mb-10 flex h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: "#dcfce7" }}>
            <svg
              viewBox="0 0 24 24"
              className="h-14 w-14"
              fill="none"
              stroke="#16a34a"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <button
            type="button"
            onClick={reset}
            className="rounded-full px-10 py-3 text-base font-semibold text-white shadow transition-colors"
            style={{ backgroundColor: "#2d5a41" }}
          >
            Escanear otro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white">
      <header className="flex items-center justify-between px-6 pt-6 pb-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-[#d1d5db] px-4 py-2 text-[13px] font-medium text-[#374151] transition-colors hover:bg-[#f3f4f6]"
        >
          ← Volver
        </button>
        <Logo dark />
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-8 pb-16 text-center">
        <h1 className="mb-4 text-3xl font-extrabold" style={{ color: "#2d5a41" }}>
          Código no válido
        </h1>
        {invalidMsg && <p className="mb-6 max-w-sm text-sm text-[#6b7280]">{invalidMsg}</p>}

        <SadFace />

        <div className="my-10 flex h-24 w-24 items-center justify-center rounded-full" style={{ backgroundColor: "#ef4444" }}>
          <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>

        <button
          type="button"
          onClick={reset}
          className="rounded-full px-10 py-3 text-base font-semibold text-white shadow transition-colors"
          style={{ backgroundColor: "#2d5a41" }}
        >
          Intentar de nuevo
        </button>
      </div>
    </div>
  );
}
