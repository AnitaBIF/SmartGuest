import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Cierre de sesión server-side: invalida los tokens de Supabase y borra todas
 * las cookies `sb-*` del navegador.
 *
 * Lo dispara el cliente con POST + `keepalive` (no bloquea el cierre) desde:
 *  - `lib/supabase.ts` (`logout` / `logoutCleanupFast`).
 *  - `components/SessionWatchdog.tsx` (sesión vencida / inactividad).
 *
 * Aceptamos `POST` y `GET` para poder usarlo también con
 * `navigator.sendBeacon` o `<img src>` como último recurso en `pagehide`.
 */
async function clearSession() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );

  try {
    await supabase.auth.signOut();
  } catch {
    /* aunque falle, igual borramos las cookies abajo */
  }

  const res = NextResponse.json({ ok: true });
  // Por las dudas, también borramos manualmente cualquier cookie sb-* que
  // siga apareciendo (algunas se setean por dominios distintos en SSR).
  for (const c of cookieStore.getAll()) {
    if (c.name.startsWith("sb-")) {
      res.cookies.set(c.name, "", {
        path: "/",
        maxAge: 0,
        expires: new Date(0),
      });
    }
  }
  return res;
}

export async function POST() {
  return clearSession();
}

export async function GET() {
  return clearSession();
}
