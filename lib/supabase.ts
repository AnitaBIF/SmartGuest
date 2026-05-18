import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (typeof window !== "undefined" && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    "[SmartGuest] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Creá .env.local en la raíz del proyecto, pegá las variables del dashboard de Supabase (Settings → API) y reiniciá npm run dev."
  );
}

/**
 * Adapter de cookies para `createBrowserClient` que fuerza **session cookies**
 * en el navegador del usuario: descartamos `maxAge` y `expires` al guardar.
 *
 * Resultado: cuando se cierra TODO el navegador, las cookies `sb-*` se borran
 * solas. Es la primera capa del logout automático (la segunda es
 * `SessionWatchdog`, que detecta "última pestaña cerrada y vuelta tiempo
 * después").
 */
function readBrowserCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split(";")
    .map((pair) => {
      const trimmed = pair.trim();
      if (!trimmed) return null;
      const eq = trimmed.indexOf("=");
      if (eq < 0) return { name: trimmed, value: "" };
      const name = trimmed.slice(0, eq);
      const raw = trimmed.slice(eq + 1);
      try {
        return { name, value: decodeURIComponent(raw) };
      } catch {
        return { name, value: raw };
      }
    })
    .filter((c): c is { name: string; value: string } => c !== null && c.name.length > 0);
}

type BrowserCookieOptions = {
  domain?: string;
  path?: string;
  secure?: boolean;
  sameSite?: boolean | "lax" | "strict" | "none";
  httpOnly?: boolean;
};

function writeBrowserCookie(name: string, value: string, options: BrowserCookieOptions | undefined) {
  if (typeof document === "undefined") return;
  // Si Supabase pide borrar la cookie (value vacío con expira en el pasado),
  // honramos esa intención.
  const isDeletion = value === "" && options && "maxAge" in options
    ? (options as { maxAge?: number }).maxAge === 0
    : false;

  const parts: string[] = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`path=${options?.path ?? "/"}`);
  if (options?.domain) parts.push(`domain=${options.domain}`);
  if (options?.secure) parts.push("secure");
  if (options?.sameSite) {
    const ss = typeof options.sameSite === "string"
      ? options.sameSite
      : options.sameSite
        ? "strict"
        : "lax";
    parts.push(`samesite=${ss}`);
  }
  if (isDeletion) {
    parts.push("expires=Thu, 01 Jan 1970 00:00:00 GMT");
    parts.push("max-age=0");
  }
  // Caso contrario: NO añadimos `max-age` ni `expires` → queda como
  // session cookie y desaparece al cerrar el navegador.
  document.cookie = parts.join("; ");
}

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
  cookies: {
    getAll() {
      return readBrowserCookies();
    },
    setAll(cookiesToSet) {
      for (const { name, value, options } of cookiesToSet) {
        writeBrowserCookie(name, value, options as BrowserCookieOptions | undefined);
      }
    },
  },
});

/**
 * Objetivo ~500 ms percibidos: el POST al servidor no bloquea la navegación
 * (`keepalive` sigue en vuelo durante el unload). Lo crítico es `signOut` local
 * + barrido de cookies `sb-*` en el cliente.
 */
const LOGOUT_UI_CAP_MS = 500;

/** Aviso al servidor sin await (sobrevive al cambio de página). */
export function notifyServerLogoutKeepalive(): void {
  if (typeof window === "undefined") return;
  try {
    void fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      keepalive: true,
    });
  } catch {
    /* */
  }
}

export async function signOutLocalCapped(maxMs: number = LOGOUT_UI_CAP_MS): Promise<void> {
  try {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
    ]);
  } catch {
    /* */
  }
}

function sweepSbCookiesFromDocument(): void {
  if (typeof document === "undefined") return;
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name.startsWith("sb-")) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  });
}

function clearLastAliveKey(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("smartguest:session:last-alive:v1");
  } catch {
    /* ignore */
  }
}

/** Limpieza rápida sin redirigir (p. ej. SessionWatchdog). */
export async function logoutCleanupFast(): Promise<void> {
  notifyServerLogoutKeepalive();
  await signOutLocalCapped(LOGOUT_UI_CAP_MS);
  sweepSbCookiesFromDocument();
  clearLastAliveKey();
}

export async function logout() {
  await logoutCleanupFast();
  if (typeof window !== "undefined") {
    window.location.replace("/");
  }
}
