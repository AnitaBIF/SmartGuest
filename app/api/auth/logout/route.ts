import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Cierre de sesión server-side: invalida los tokens de Supabase y borra todas
 * las cookies `sb-*` del navegador.
 *
 * Lo llaman dos consumidores:
 *  - `lib/supabase.ts#logout()` (botón "cerrar sesión" del usuario).
 *  - `components/SessionWatchdog.tsx` cuando detecta que todas las pestañas
 *    estuvieron muertas más de 30 s y la cookie de sesión seguía viva (caso
 *    "cerré la pestaña y volví más tarde" → consideramos sesión expirada).
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
