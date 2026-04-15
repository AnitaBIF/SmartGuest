import { NextRequest, NextResponse } from "next/server";
import type { Database, TipoUsuario } from "@/lib/database.types";
import { adminServiceClient, requireSalonAdmin } from "@/lib/adminSalonAuth";
import { dniFinalParaAltaUsuario, dniNormalizadoDesdeFormulario, dniProvisorioUsuario } from "@/lib/dniUsuarioForm";

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
  const { db, userId, salonNombre, salonDireccion } = auth.ctx;

  const { nombre, apellido, dni, email, password, tipo, max_invitados } = await req.json();

  if (!nombre || !apellido || !email || !password || !tipo) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }

  if (!TIPOS_SALON.includes(tipo as TipoUsuario)) {
    return NextResponse.json({ error: "Tipo de usuario no válido para el equipo del salón." }, { status: 400 });
  }

  if (!salonNombre || !salonDireccion) {
    return NextResponse.json(
      { error: "Completá nombre y dirección del salón en Configuración antes de crear usuarios del equipo." },
      { status: 400 }
    );
  }

  const { data: inviter, error: invErr } = await db
    .from("usuarios")
    .select(
      "cuit, habilitacion_numero, salon_menus_especiales, salon_menus_especiales_otro, salon_menu_standard"
    )
    .eq("id", userId)
    .single();

  if (invErr || !inviter) {
    return NextResponse.json({ error: "No se pudo cargar tu perfil de salón." }, { status: 500 });
  }

  const cuitInv = typeof inviter.cuit === "string" ? inviter.cuit.trim() : "";
  const habInv = typeof inviter.habilitacion_numero === "string" ? inviter.habilitacion_numero.trim() : "";

  const dniFinal = dniFinalParaAltaUsuario(dni);

  if (!dniFinal.startsWith("SG")) {
    const { data: dniOcupado } = await db.from("usuarios").select("id").eq("dni", dniFinal).maybeSingle();
    if (dniOcupado) {
      return NextResponse.json({ error: "Ya existe un usuario con ese DNI." }, { status: 409 });
    }
  }

  const userMeta: Record<string, unknown> = {
    nombre,
    apellido,
    dni: dniFinal,
    tipo,
    salon_nombre: salonNombre,
    salon_direccion: salonDireccion,
  };
  if (tipo === "administrador") {
    userMeta.cuit = cuitInv || null;
    userMeta.habilitacion_numero = habInv || null;
  }

  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: userMeta,
  });

  if (authError || !authData.user) {
    return NextResponse.json(
      { error: authError?.message ?? "Error al crear usuario." },
      { status: 400 }
    );
  }

  const newId = authData.user.id;
  const maxInv = tipo === "anfitrion" ? (max_invitados ?? 0) : 0;

  const patch: Database["public"]["Tables"]["usuarios"]["Update"] = {
    dni: dniFinal,
    max_invitados: maxInv,
  };

  if (tipo === "administrador") {
    patch.salon_menus_especiales = inviter.salon_menus_especiales ?? [];
    patch.salon_menus_especiales_otro = inviter.salon_menus_especiales_otro ?? null;
    patch.salon_menu_standard = inviter.salon_menu_standard ?? null;
  }

  const { error: updateError } = await db.from("usuarios").update(patch).eq("id", newId);

  if (updateError) {
    await db.auth.admin.deleteUser(newId);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (tipo === "administrador") {
    const { data: nuevoAuth, error: gErr } = await db.auth.admin.getUserById(newId);
    if (gErr || !nuevoAuth?.user) {
      await db.auth.admin.deleteUser(newId);
      return NextResponse.json({ error: gErr?.message ?? "No se pudo leer el usuario creado." }, { status: 500 });
    }
    const prevMeta = { ...(nuevoAuth.user.user_metadata as Record<string, unknown>) };
    const { error: metaErr } = await db.auth.admin.updateUserById(newId, {
      user_metadata: {
        ...prevMeta,
        nombre,
        apellido,
        dni: dniFinal,
        tipo: "administrador",
        salon_nombre: salonNombre,
        salon_direccion: salonDireccion,
        cuit: cuitInv || null,
        habilitacion_numero: habInv || null,
        salon_menu_standard: inviter.salon_menu_standard ?? null,
      },
    });
    if (metaErr) {
      await db.auth.admin.deleteUser(newId);
      return NextResponse.json({ error: metaErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: newId }, { status: 201 });
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

  const tipoFinal = tipo as TipoUsuario;
  if (!TIPOS_SALON.includes(tipoFinal)) {
    return NextResponse.json({ error: "Tipo de usuario no válido." }, { status: 400 });
  }

  const allowed = await puedeGestionarUsuario(db, userId, salonNombre, salonDireccion, id);
  if (!allowed) {
    return NextResponse.json({ error: "No autorizado a editar este usuario." }, { status: 403 });
  }

  const { data: filaActual, error: curErr } = await db.from("usuarios").select("dni").eq("id", id).maybeSingle();
  if (curErr) {
    return NextResponse.json({ error: curErr.message }, { status: 500 });
  }

  const dniNorm = dniNormalizadoDesdeFormulario(dni);
  const dniEnBlanco =
    dni == null ||
    (typeof dni === "string" && !dni.trim()) ||
    (typeof dni === "number" && !Number.isFinite(dni));

  let dniFinalPut: string;
  if (dniNorm) {
    dniFinalPut = dniNorm;
  } else if (dniEnBlanco) {
    const actual = (filaActual?.dni ?? "").trim();
    dniFinalPut = actual || dniProvisorioUsuario();
  } else {
    return NextResponse.json(
      { error: "DNI: ingresá entre 7 y 10 dígitos (sin puntos ni guiones) o dejá el campo vacío para mantener el actual." },
      { status: 400 }
    );
  }

  if (!dniFinalPut.startsWith("SG")) {
    const { data: dniOcupado } = await db.from("usuarios").select("id").eq("dni", dniFinalPut).neq("id", id).maybeSingle();
    if (dniOcupado) {
      return NextResponse.json({ error: "Ya existe otro usuario con ese DNI." }, { status: 409 });
    }
  }

  const maxInvPut = tipoFinal === "anfitrion" ? (max_invitados ?? 0) : 0;

  const { error: profileError } = await db
    .from("usuarios")
    .update({
      nombre,
      apellido,
      dni: dniFinalPut,
      email,
      tipo: tipoFinal,
      max_invitados: maxInvPut,
    })
    .eq("id", id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { data: authSnap, error: gAuthErr } = await db.auth.admin.getUserById(id);
  if (gAuthErr || !authSnap?.user) {
    return NextResponse.json({ error: gAuthErr?.message ?? "No se pudo leer el usuario en Auth." }, { status: 500 });
  }
  const metaPrev = { ...(authSnap.user.user_metadata as Record<string, unknown>) };
  const updateAuthPayload: Record<string, unknown> = {
    email,
    user_metadata: {
      ...metaPrev,
      dni: dniFinalPut,
      nombre,
      apellido,
      tipo: tipoFinal,
    },
  };
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
