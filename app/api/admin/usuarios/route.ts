import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database, TipoUsuario } from "@/lib/database.types";

// Cliente admin (service role) — solo se usa server-side
function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const TIPOS_SALON: TipoUsuario[] = ["administrador", "anfitrion", "jefe_cocina", "seguridad"];

// ─── GET: usuarios del salón (sin invitados) ─────────────────────────────────
export async function GET() {
  const supabase = adminClient();

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nombre, apellido, dni, email, tipo, max_invitados")
    .in("tipo", TIPOS_SALON)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// ─── POST: crear usuario ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { nombre, apellido, dni, email, password, tipo, max_invitados } =
    await req.json();

  if (!nombre || !apellido || !email || !password || !tipo) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }

  const supabase = adminClient();

  // 1. Crear el usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // confirmado automáticamente
    user_metadata: { nombre, apellido, dni, tipo },
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Error al crear usuario." },
      { status: 400 }
    );
  }

  // 2. El trigger handle_new_user ya crea la fila en public.usuarios.
  //    Actualizamos los campos adicionales (dni, max_invitados).
  const { error: updateError } = await supabase
    .from("usuarios")
    .update({ dni: dni ?? "", max_invitados: max_invitados ?? 0 })
    .eq("id", authData.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ id: authData.user.id }, { status: 201 });
}

// ─── PUT: editar usuario ────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const { id, nombre, apellido, dni, email, password, tipo, max_invitados } =
    await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const supabase = adminClient();

  // Actualizar perfil en public.usuarios
  const { error: profileError } = await supabase
    .from("usuarios")
    .update({
      nombre,
      apellido,
      dni,
      email,
      tipo: tipo as TipoUsuario,
      max_invitados: max_invitados ?? 0,
    })
    .eq("id", id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Actualizar email en Auth si cambió
  const updateAuthPayload: Record<string, unknown> = { email };
  if (password) updateAuthPayload.password = password;

  const { error: authError } = await supabase.auth.admin.updateUserById(
    id,
    updateAuthPayload
  );

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ─── DELETE: eliminar usuario ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const supabase = adminClient();

  // Eliminar de Auth (CASCADE borra public.usuarios automáticamente)
  const { error } = await supabase.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
