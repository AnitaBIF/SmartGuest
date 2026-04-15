import { NextRequest, NextResponse } from "next/server";
import type { Database, TipoUsuario } from "@/lib/database.types";
import { adminServiceClient, requireSalonAdmin } from "@/lib/adminSalonAuth";

const TIPOS_SALON: TipoUsuario[] = ["administrador", "anfitrion", "jefe_cocina", "seguridad"];

async function puedeGestionarUsuario(
  db: ReturnType<typeof adminServiceClient>,
  adminId: string,
  salonNombre: string,
  salonDireccion: string,
  targetId: string
): Promise<boolean> {
  if (targetId === adminId) return true;
  if (!salonNombre || !salonDireccion) return false;
  const { data } = await db
    .from("usuarios")
    .select("id")
    .eq("id", targetId)
    .eq("salon_nombre", salonNombre)
    .eq("salon_direccion", salonDireccion)
    .maybeSingle();
  return !!data;
}

// ─── GET: equipo del mismo salón que el administrador autenticado ───────────
export async function GET(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, userId, salonNombre, salonDireccion } = auth.ctx;

  const baseSelect = "id, nombre, apellido, dni, email, tipo, max_invitados, created_at";

  const { data: self, error: eSelf } = await db
    .from("usuarios")
    .select(baseSelect)
    .eq("id", userId)
    .in("tipo", TIPOS_SALON)
    .maybeSingle();

  if (eSelf) {
    return NextResponse.json({ error: eSelf.message }, { status: 500 });
  }

  const byId = new Map<string, (typeof self & {})>();

  if (self) {
    byId.set(self.id, self);
  }

  if (salonNombre && salonDireccion) {
    const { data: team, error: eTeam } = await db
      .from("usuarios")
      .select(baseSelect)
      .in("tipo", TIPOS_SALON)
      .eq("salon_nombre", salonNombre)
      .eq("salon_direccion", salonDireccion);

    if (eTeam) {
      return NextResponse.json({ error: eTeam.message }, { status: 500 });
    }
    for (const u of team ?? []) {
      byId.set(u.id, u);
    }
  }

  const merged = [...byId.values()].sort((a, b) =>
    String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
  );

  const out = merged.map(({ created_at: _c, ...rest }) => rest);
  return NextResponse.json(out);
}

// ─── POST: crear usuario (mismo salón que el admin) ─────────────────────────
export async function POST(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, salonNombre, salonDireccion } = auth.ctx;

  const { nombre, apellido, dni, email, password, tipo, max_invitados } = await req.json();

  if (!nombre || !apellido || !email || !password || !tipo) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }

  if (tipo === "administrador") {
    return NextResponse.json(
      { error: "Un segundo administrador del salón no se crea desde acá: usá «Registro de salón» con otro email." },
      { status: 400 }
    );
  }

  if (!salonNombre || !salonDireccion) {
    return NextResponse.json(
      { error: "Completá nombre y dirección del salón en Configuración antes de crear usuarios del equipo." },
      { status: 400 }
    );
  }

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre,
      apellido,
      dni,
      tipo,
      salon_nombre: salonNombre,
      salon_direccion: salonDireccion,
    },
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Error al crear usuario." },
      { status: 400 }
    );
  }

  const { error: updateError } = await db
    .from("usuarios")
    .update({ dni: dni ?? "", max_invitados: max_invitados ?? 0 })
    .eq("id", authData.user.id);

  if (updateError) {
    await db.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ id: authData.user.id }, { status: 201 });
}

// ─── PUT: editar usuario ────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, userId, salonNombre, salonDireccion } = auth.ctx;

  const { id, nombre, apellido, dni, email, password, tipo, max_invitados } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const allowed = await puedeGestionarUsuario(db, userId, salonNombre, salonDireccion, id);
  if (!allowed) {
    return NextResponse.json({ error: "No autorizado a editar este usuario." }, { status: 403 });
  }

  if (tipo === "administrador" && id !== userId) {
    return NextResponse.json({ error: "No podés asignar el rol administrador a otro usuario." }, { status: 400 });
  }

  const { error: profileError } = await db
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

  const updateAuthPayload: Record<string, unknown> = { email };
  if (password) updateAuthPayload.password = password;

  const { error: authError } = await db.auth.admin.updateUserById(id, updateAuthPayload);

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ─── DELETE: eliminar usuario ───────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, userId, salonNombre, salonDireccion } = auth.ctx;

  const { id } = await req.json();

  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  if (id === userId) {
    return NextResponse.json({ error: "No podés eliminar tu propia cuenta desde acá." }, { status: 400 });
  }

  const allowed = await puedeGestionarUsuario(db, userId, salonNombre, salonDireccion, id);
  if (!allowed) {
    return NextResponse.json({ error: "No autorizado a eliminar este usuario." }, { status: 403 });
  }

  const { error } = await db.auth.admin.deleteUser(id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
