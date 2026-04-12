import { createHmac, timingSafeEqual } from "node:crypto";

/** Duración de cada código (misma idea que TOTP, pero firmado en servidor). */
export const QR_WINDOW_MS = 30_000;

const VERSION = 1;
/** Etiqueta visible en el payload del QR (presentable en el trabajo). */
export const QR_SCHEME_PREFIX = "SGv1";

function getSecret(): string {
  const s = process.env.QR_ROLLING_SECRET?.trim();
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Configurá QR_ROLLING_SECRET (mín. 32 caracteres) en el entorno de producción.");
  }
  return "dev-smartguest-qr-secret-min-32-chars!!";
}

export function currentWindowIndex(now = Date.now()): number {
  return Math.floor(now / QR_WINDOW_MS);
}

export function canonicalPayload(invitadoId: string, eventoId: string, window: number): string {
  return `${VERSION}|${invitadoId}|${eventoId}|${window}`;
}

function signBody(bodyUtf8: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(bodyUtf8, "utf8").digest().subarray(0, 16);
}

/**
 * Token para el QR: no contiene secreto; solo el servidor puede generar la firma válida.
 * Formato: SGv1.<base64url(body)>.<base64url(mac16)>
 */
export function mintRollingQrToken(invitadoId: string, eventoId: string, window: number): string {
  const secret = getSecret();
  const body = canonicalPayload(invitadoId.toLowerCase(), eventoId.toLowerCase(), window);
  const bodyB64 = Buffer.from(body, "utf8").toString("base64url");
  const mac = signBody(body, secret).toString("base64url");
  return `${QR_SCHEME_PREFIX}.${bodyB64}.${mac}`;
}

export type VerifyOk = {
  ok: true;
  invitadoId: string;
  eventoId: string;
  window: number;
};

export type VerifyFail = { ok: false; reason: string };

/**
 * Verifica firma y que la ventana temporal sea exactamente la actual.
 * No aceptamos ventana anterior/siguiente: una captura deja de servir en el próximo tick (~30 s).
 * Emisión y validación usan el mismo servidor (`Date.now()`), sin tolerancia extra.
 */
export function verifyRollingQrToken(token: string, now = Date.now()): VerifyOk | VerifyFail {
  const secret = getSecret();
  const raw = token.trim();
  if (!raw.startsWith(`${QR_SCHEME_PREFIX}.`)) {
    return { ok: false, reason: "Esquema de código no reconocido." };
  }
  const rest = raw.slice(QR_SCHEME_PREFIX.length + 1);
  const dot = rest.indexOf(".");
  if (dot < 0) return { ok: false, reason: "Código incompleto." };
  const bodyB64 = rest.slice(0, dot);
  const sigB64 = rest.slice(dot + 1);
  if (!bodyB64 || !sigB64) return { ok: false, reason: "Código incompleto." };

  let body: string;
  try {
    body = Buffer.from(bodyB64, "base64url").toString("utf8");
  } catch {
    return { ok: false, reason: "Payload ilegible." };
  }

  const re = /^(\d+)\|([0-9a-f-]{36})\|([0-9a-f-]{36})\|(\d+)$/i;
  const m = re.exec(body);
  if (!m) return { ok: false, reason: "Payload inválido." };

  const ver = parseInt(m[1], 10);
  if (ver !== VERSION) return { ok: false, reason: "Versión de código obsoleta." };

  const invitadoId = m[2].toLowerCase();
  const eventoId = m[3].toLowerCase();
  const window = parseInt(m[4], 10);
  if (!Number.isFinite(window)) return { ok: false, reason: "Ventana inválida." };

  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sigB64, "base64url");
  } catch {
    return { ok: false, reason: "Firma ilegible." };
  }

  const expected = signBody(body, secret);
  if (sigBuf.length !== expected.length) {
    return { ok: false, reason: "Firma incorrecta." };
  }
  if (!timingSafeEqual(sigBuf, expected)) {
    return { ok: false, reason: "Firma incorrecta." };
  }

  const cw = currentWindowIndex(now);
  if (window !== cw) {
    return {
      ok: false,
      reason: "Código vencido: el QR cambia cada pocos segundos. Pedí que muestren el código en vivo desde la app.",
    };
  }

  return { ok: true, invitadoId, eventoId, window };
}

export function msUntilNextWindow(now = Date.now()): number {
  const next = (currentWindowIndex(now) + 1) * QR_WINDOW_MS;
  return Math.max(0, next - now);
}
