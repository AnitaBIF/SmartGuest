import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const TIPO_LABEL: Record<string, string> = {
  administrador: "Administrador",
  anfitrion: "Anfitrión",
  jefe_cocina: "Jefe de cocina",
  seguridad: "Seguridad",
  invitado: "Invitado",
};

/**
 * Perfil del usuario autenticado (nombre legible + rol).
 * Usa service role para leer `public.usuarios` aunque el cliente RLS falle en el navegador.
 */
export async function GET(req: NextRequest) {
  const response = NextResponse.next();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const db = adminClient();
  const { data: profile, error } = await db
    .from("usuarios")
    .select("nombre, apellido, email, tipo")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  const metaNombre = typeof meta?.nombre === "string" ? meta.nombre.trim() : "";
  const metaApellido = typeof meta?.apellido === "string" ? meta.apellido.trim() : "";

  const nombre = (profile?.nombre ?? "").trim() || metaNombre;
  const apellido = (profile?.apellido ?? "").trim() || metaApellido;
  const email = profile?.email ?? user.email ?? "";
  const tipoRaw = profile?.tipo ?? (typeof meta?.tipo === "string" ? meta.tipo : "invitado");

  const fromParts = [nombre, apellido].filter(Boolean).join(" ").trim();
  const displayName =
    fromParts || (email.includes("@") ? email.split("@")[0] : email) || "Usuario";

  const tipoLabel = TIPO_LABEL[tipoRaw] ?? tipoRaw;

  return NextResponse.json({
    displayName,
    tipoLabel,
    email,
    userId: user.id,
  });
}
