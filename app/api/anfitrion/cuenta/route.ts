import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { isValidEmail, verifyCurrentPassword } from "@/lib/cuentaAuthHelpers";
import { normalizeDniInput } from "@/lib/invitadosImport";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getSessionUser(req: NextRequest) {
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  return user;
}

async function dniTomadoPorOtro(
  supabase: ReturnType<typeof adminClient>,
  dniVal: string,
  exceptId: string
): Promise<boolean> {
  if (!dniVal) return false;
  const { data: row } = await supabase.from("usuarios").select("id").eq("dni", dniVal).maybeSingle();
  return !!row && row.id !== exceptId;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = adminClient();
  const { data: profile, error } = await supabase
    .from("usuarios")
    .select("nombre, apellido, dni, email, tipo")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    return NextResponse.json({ error: "Perfil no encontrado." }, { status: 404 });
  }
  if (profile.tipo !== "anfitrion") {
    return NextResponse.json({ error: "Solo para cuentas de anfitrión." }, { status: 403 });
  }

  const email = (profile.email || user.email || "").trim();

  return NextResponse.json({
    nombre: profile.nombre ?? "",
    apellido: profile.apellido ?? "",
    dni: profile.dni ?? "",
    email,
  });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = adminClient();
  const { data: profile, error: pErr } = await supabase
    .from("usuarios")
    .select("nombre, apellido, dni, email, tipo")
    .eq("id", user.id)
    .single();

  if (pErr || !profile || profile.tipo !== "anfitrion") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  const apellido = typeof body.apellido === "string" ? body.apellido.trim() : "";
  const dni = normalizeDniInput(typeof body.dni === "string" ? body.dni : "");
  const emailNew = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  const newPasswordConfirm = typeof body.newPasswordConfirm === "string" ? body.newPasswordConfirm : "";

  if (!nombre || !apellido) {
    return NextResponse.json({ error: "Nombre y apellido son obligatorios." }, { status: 400 });
  }

  const emailActual = (profile.email || user.email || "").trim().toLowerCase();
  const quiereCambiarEmail = emailNew && emailNew !== emailActual;
  const quiereCambiarPassword = newPassword.length > 0;

  if (quiereCambiarEmail && !isValidEmail(emailNew)) {
    return NextResponse.json({ error: "Email no válido." }, { status: 400 });
  }

  if (quiereCambiarPassword) {
    if (newPassword.length < 8) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }
    if (newPassword !== newPasswordConfirm) {
      return NextResponse.json({ error: "Las contraseñas nuevas no coinciden." }, { status: 400 });
    }
  }

  if (quiereCambiarEmail || quiereCambiarPassword) {
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Ingresá tu contraseña actual para cambiar el email o la contraseña." },
        { status: 400 }
      );
    }
    const ok = await verifyCurrentPassword(emailActual, currentPassword);
    if (!ok) {
      return NextResponse.json({ error: "La contraseña actual no es correcta." }, { status: 401 });
    }
  }

  if (dni && (await dniTomadoPorOtro(supabase, dni, user.id))) {
    return NextResponse.json({ error: "Ese DNI ya está en uso por otra cuenta." }, { status: 409 });
  }

  if (quiereCambiarEmail) {
    const { data: dupe } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", emailNew)
      .neq("id", user.id)
      .maybeSingle();
    if (dupe) {
      return NextResponse.json({ error: "Ese email ya está registrado." }, { status: 409 });
    }
  }

  const authUpdate: { email?: string; password?: string; user_metadata?: Record<string, unknown> } = {
    user_metadata: {
      nombre,
      apellido,
      dni: dni || null,
      tipo: "anfitrion",
    },
  };
  if (quiereCambiarEmail) authUpdate.email = emailNew;
  if (quiereCambiarPassword) authUpdate.password = newPassword;

  const { error: authErr } = await supabase.auth.admin.updateUserById(user.id, authUpdate);
  if (authErr) {
    const msg = authErr.message || "No se pudo actualizar la cuenta.";
    if (/already|registered|exists/i.test(msg)) {
      return NextResponse.json({ error: "Ese email ya está en uso." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error: uErr } = await supabase
    .from("usuarios")
    .update({
      nombre,
      apellido,
      dni: dni || "",
      email: quiereCambiarEmail ? emailNew : profile.email,
    })
    .eq("id", user.id);

  if (uErr) {
    if (uErr.message.includes("unique") || uErr.code === "23505") {
      return NextResponse.json({ error: "Ese email o DNI ya está en uso." }, { status: 409 });
    }
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
