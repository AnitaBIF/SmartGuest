import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { isQrReplay } from "@/lib/qr-replay-guard";
import { verifyRollingQrToken } from "@/lib/secure-qr-token";

type ValidarQrResponse = {
  nombre: string;
  dni: string;
  mesa: number | null;
  evento: string;
  verified: string;
};

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Valida el QR escaneado: firma HMAC, ventana temporal, anti-replay, rol seguridad.
 */
export async function POST(req: NextRequest) {
  const response = NextResponse.next();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(c) {
          c.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
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

  const supabase = adminClient();
  const { data: perfil } = await supabase
    .from("usuarios")
    .select("tipo")
    .eq("id", user.id)
    .single();

  if (perfil?.tipo !== "seguridad") {
    return NextResponse.json({ error: "Solo personal de seguridad puede validar códigos." }, { status: 403 });
  }

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Falta el código escaneado." }, { status: 400 });
  }

  const verified = verifyRollingQrToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  if (isQrReplay(token)) {
    return NextResponse.json(
      { error: "Este código ya fue usado hace instantes (anti-copia / anti-replay)." },
      { status: 409 }
    );
  }

  const { data: inv } = await supabase
    .from("invitados")
    .select("id, evento_id, usuario_id, mesa_id, asistencia")
    .eq("id", verified.invitadoId)
    .single();

  if (
    !inv ||
    inv.evento_id.toLowerCase() !== verified.eventoId ||
    inv.id.toLowerCase() !== verified.invitadoId
  ) {
    return NextResponse.json({ error: "Invitación no encontrada o datos incoherentes." }, { status: 404 });
  }

  if (inv.asistencia !== "confirmado") {
    return NextResponse.json({ error: "Asistencia no confirmada para este invitado." }, { status: 403 });
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, apellido, dni")
    .eq("id", inv.usuario_id)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  let mesaNumero: number | null = null;
  if (inv.mesa_id) {
    const { data: mesa } = await supabase
      .from("mesas")
      .select("numero")
      .eq("id", inv.mesa_id)
      .single();
    mesaNumero = mesa?.numero ?? null;
  }

  const { data: evento } = await supabase
    .from("eventos")
    .select("nombre")
    .eq("id", inv.evento_id)
    .single();

  const payload: ValidarQrResponse = {
    nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
    dni: usuario.dni,
    mesa: mesaNumero,
    evento: evento?.nombre ?? "Evento",
    verified: "rolling-hmac",
  };

  return NextResponse.json(payload);
}
