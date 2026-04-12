import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database, EstadoAsistencia } from "@/lib/database.types";
import { clampCuposMax, mapUiMenuToInvitadoColumns, menuOpcionesParaEvento, plazasSmartpoolPasajeros } from "@/lib/grupoFamiliar";
import { normalizeDniInput, splitNombreCompleto } from "@/lib/invitadosImport";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getSessionUser(req: NextRequest) {
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
  return user;
}

function mapAsistenciaUiToDb(ui: string): EstadoAsistencia {
  if (ui === "Asiste") return "confirmado";
  if (ui === "No asiste") return "rechazado";
  return "pendiente";
}

async function assertInvitadoOwnedByAnfitrion(
  supabase: ReturnType<typeof adminClient>,
  invitadoId: string,
  userId: string
) {
  const { data: inv, error: invErr } = await supabase
    .from("invitados")
    .select("id, usuario_id, evento_id, rol_smartpool")
    .eq("id", invitadoId)
    .single();

  if (invErr || !inv) return { ok: false as const, status: 404 as const };

  const { data: ev } = await supabase
    .from("eventos")
    .select("anfitrion_id, menus_especiales")
    .eq("id", inv.evento_id)
    .single();

  if (!ev || ev.anfitrion_id !== userId) return { ok: false as const, status: 403 as const };

  const { data: me } = await supabase.from("usuarios").select("tipo").eq("id", userId).single();
  if (me?.tipo !== "anfitrion") return { ok: false as const, status: 403 as const };

  return { ok: true as const, inv, menusEspeciales: ev?.menus_especiales ?? [] };
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await context.params;
  const supabase = adminClient();
  const owned = await assertInvitadoOwnedByAnfitrion(supabase, id, user.id);
  if (!owned.ok) {
    return NextResponse.json({ error: "No encontrado" }, { status: owned.status });
  }

  const body = await req.json();
  const nombreFull = String(body.nombre ?? "").trim();
  const dni = normalizeDniInput(String(body.dni ?? ""));
  const grupo = String(body.grupo ?? "").trim();
  const rango = String(body.rango ?? "").trim();
  const restriccionUi = String(body.restriccion ?? "").trim() || "Ninguna";
  const restriccionOtroIn = String(body.restriccionOtro ?? "").trim();
  const asistencia = String(body.asistencia ?? "Pendiente");
  const eco = String(body.eco ?? "No");
  const telefono = String(body.telefono ?? "").trim();
  const grupoCuposMaxRaw = body.grupoCuposMax;

  if (!nombreFull || !dni) {
    return NextResponse.json({ error: "Nombre y DNI son obligatorios." }, { status: 400 });
  }

  const { nombre, apellido } = splitNombreCompleto(nombreFull);

  const permitidas = new Set(menuOpcionesParaEvento(owned.menusEspeciales));
  if (!permitidas.has(restriccionUi)) {
    return NextResponse.json({ error: "Opción de menú no permitida para este evento." }, { status: 400 });
  }
  if (restriccionUi === "Otro" && !restriccionOtroIn) {
    return NextResponse.json({ error: "Completá el detalle de «Otro»." }, { status: 400 });
  }

  const leg = mapUiMenuToInvitadoColumns(restriccionUi, restriccionOtroIn || null);

  const { error: uErr } = await supabase
    .from("usuarios")
    .update({ nombre, apellido, dni })
    .eq("id", owned.inv.usuario_id);

  if (uErr) {
    if (uErr.message.includes("unique") || uErr.code === "23505") {
      return NextResponse.json({ error: "Ese DNI ya está en uso por otro usuario." }, { status: 409 });
    }
    return NextResponse.json({ error: uErr.message }, { status: 500 });
  }

  const prevRol = owned.inv.rol_smartpool;
  /** Eco Sí desde el panel no debe pisar la elección del invitado en SmartPool (conductor / pasajero). */
  let rolSmartpool: string | null;
  if (eco === "Sí") {
    if (prevRol === "conductor" || prevRol === "pasajero") {
      rolSmartpool = prevRol;
    } else {
      rolSmartpool = "pasajero";
    }
  } else {
    rolSmartpool = null;
  }

  const invUpdate: Record<string, unknown> = {
    grupo: grupo || null,
    rango_etario: rango || null,
    telefono: telefono || null,
    asistencia: mapAsistenciaUiToDb(asistencia),
    restriccion_alimentaria: leg.restriccion_alimentaria,
    restriccion_otro: leg.restriccion_otro,
    rol_smartpool: rolSmartpool,
  };
  if (grupoCuposMaxRaw !== undefined && grupoCuposMaxRaw !== null && grupoCuposMaxRaw !== "") {
    const n = clampCuposMax(grupoCuposMaxRaw as number | string, 1);
    invUpdate.grupo_cupos_max = n;
    invUpdate.smartpool_cupos_max = plazasSmartpoolPasajeros(n);
  }

  const { error: iErr } = await supabase
    .from("invitados")
    .update(invUpdate as Database["public"]["Tables"]["invitados"]["Update"])
    .eq("id", id);

  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

const SYNTHETIC_EMAIL_SUFFIX = "@import.smartguest.app";

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id } = await context.params;
  const supabase = adminClient();
  const owned = await assertInvitadoOwnedByAnfitrion(supabase, id, user.id);
  if (!owned.ok) {
    return NextResponse.json({ error: "No encontrado" }, { status: owned.status });
  }

  const usuarioId = owned.inv.usuario_id;

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("email")
    .eq("id", usuarioId)
    .single();

  const { error: delErr } = await supabase.from("invitados").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const { data: rest } = await supabase
    .from("invitados")
    .select("id")
    .eq("usuario_id", usuarioId)
    .limit(1);

  const email = usuario?.email ?? "";
  if ((!rest || rest.length === 0) && email.endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
    await supabase.auth.admin.deleteUser(usuarioId);
  }

  return NextResponse.json({ ok: true });
}
