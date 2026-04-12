import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { normalizarMenusEspecialesEvento } from "@/lib/grupoFamiliar";
import { cuitValido, dniValido, formatearCuit, soloDigitos } from "@/lib/registroSalon";
import {
  formatSalonMenuStandardOpciones,
  parseSalonMenuStandardToOpciones,
  validateSalonMenuStandardOpciones,
} from "@/lib/salonMenuStandardOpciones";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Registro público del administrador del salón (cuenta + datos del local).
 * Crea usuario en Auth con email confirmado y fila en `usuarios` vía trigger `handle_new_user`.
 */
export async function POST(req: NextRequest) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Servidor sin configurar (service role)." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const nombre = str(body.nombre);
  const apellido = str(body.apellido);
  const dni = str(body.dni);
  const email = str(body.email).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const salonNombre = str(body.salon_nombre);
  const salonDireccion = str(body.salon_direccion);
  const cuitRaw = str(body.cuit);
  const habilitacion = str(body.habilitacion_numero);
  const menusRaw = body.menus_especiales;
  const menusEspeciales = Array.isArray(menusRaw)
    ? normalizarMenusEspecialesEvento(menusRaw.map((x) => String(x)))
    : [];
  const menusOtro = str(body.menus_especiales_otro);
  const menuStandard = str(body.menu_standard);

  if (!nombre || !apellido) {
    return NextResponse.json({ error: "Completá nombre y apellido." }, { status: 400 });
  }
  if (!dniValido(dni)) {
    return NextResponse.json({ error: "DNI inválido (7 u 8 dígitos)." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
  }
  if (salonNombre.length < 2) {
    return NextResponse.json({ error: "Indicá el nombre del salón." }, { status: 400 });
  }
  if (salonDireccion.length < 8) {
    return NextResponse.json({ error: "Indicá la dirección completa del local (calle, número, ciudad)." }, { status: 400 });
  }
  if (!cuitValido(cuitRaw)) {
    return NextResponse.json({ error: "CUIT inválido (debe tener 11 dígitos)." }, { status: 400 });
  }
  if (habilitacion.length < 2) {
    return NextResponse.json({ error: "Indicá el número de habilitación del local." }, { status: 400 });
  }
  const menuStdOpciones = parseSalonMenuStandardToOpciones(menuStandard);
  const menuStdErr = validateSalonMenuStandardOpciones(menuStdOpciones);
  if (menuStdErr) {
    return NextResponse.json({ error: menuStdErr }, { status: 400 });
  }
  const menuStandardNorm = formatSalonMenuStandardOpciones(menuStdOpciones);
  if (menusEspeciales.includes("Otro") && menusOtro.length < 2) {
    return NextResponse.json({ error: "Completá la descripción del menú especial «Otro»." }, { status: 400 });
  }

  const dniNorm = soloDigitos(dni);
  const cuitFmt = formatearCuit(cuitRaw);

  const supabase = adminClient();

  const { data: existingDni } = await supabase.from("usuarios").select("id").eq("dni", dniNorm).maybeSingle();
  if (existingDni) {
    return NextResponse.json({ error: "Ya existe un usuario con ese DNI." }, { status: 409 });
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre,
      apellido,
      dni: dniNorm,
      tipo: "administrador",
      salon_nombre: salonNombre,
      salon_direccion: salonDireccion,
      cuit: cuitFmt,
      habilitacion_numero: habilitacion,
      salon_menu_standard: menuStandardNorm,
    },
  });

  if (authError || !authData.user) {
    const msg = authError?.message ?? "No se pudo crear la cuenta.";
    if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
      return NextResponse.json({ error: "Ese email ya está registrado. Iniciá sesión o recuperá la contraseña." }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { error: upErr } = await supabase
    .from("usuarios")
    .update({
      dni: dniNorm,
      salon_nombre: salonNombre,
      salon_direccion: salonDireccion,
      cuit: cuitFmt,
      habilitacion_numero: habilitacion,
      salon_menus_especiales: menusEspeciales,
      salon_menus_especiales_otro: menusEspeciales.includes("Otro") ? menusOtro : null,
      salon_menu_standard: menuStandardNorm,
    })
    .eq("id", authData.user.id);

  if (upErr) {
    await supabase.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: authData.user.id }, { status: 201 });
}
