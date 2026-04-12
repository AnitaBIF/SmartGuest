import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { plazasSmartseatPorInvitado } from "@/lib/grupoFamiliar";

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reporte de ingresos por evento (QR en puerta). Solo administrador del salón.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: perfil } = await supabase.from("usuarios").select("tipo").eq("id", user.id).single();
  if (perfil?.tipo !== "administrador") {
    return NextResponse.json({ error: "Solo administradores del salón pueden ver este reporte." }, { status: 403 });
  }

  const eventoId = req.nextUrl.searchParams.get("eventoId")?.trim() ?? "";
  if (!UUID_RE.test(eventoId)) {
    return NextResponse.json({ error: "Indicá un evento válido (?eventoId=…)." }, { status: 400 });
  }

  const { data: evento, error: eErr } = await supabase
    .from("eventos")
    .select("id, nombre, fecha")
    .eq("id", eventoId)
    .maybeSingle();

  if (eErr || !evento) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const { data: rows, error: rErr } = await supabase
    .from("invitados")
    .select(
      "id, asistencia, ingresado, ingreso_at, grupo, grupo_cupos_max, grupo_personas_confirmadas, mesa_id, usuario_id"
    )
    .eq("evento_id", eventoId);

  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 });
  }

  const list = rows ?? [];
  const userIds = [...new Set(list.map((r) => r.usuario_id))];
  const { data: usrs } =
    userIds.length > 0
      ? await supabase.from("usuarios").select("id, nombre, apellido, dni").in("id", userIds)
      : { data: [] as { id: string; nombre: string; apellido: string; dni: string }[] };

  const byUser = Object.fromEntries((usrs ?? []).map((u) => [u.id, u]));

  const mesaIds = [...new Set(list.map((r) => r.mesa_id).filter(Boolean))] as string[];
  const { data: mesas } =
    mesaIds.length > 0
      ? await supabase.from("mesas").select("id, numero").in("id", mesaIds)
      : { data: [] as { id: string; numero: number }[] };
  const mesaNumById = Object.fromEntries((mesas ?? []).map((m) => [m.id, m.numero]));

  let invitacionesConfirmadas = 0;
  let personasConfirmadasEsperadas = 0;
  let invitacionesIngresadas = 0;
  let personasIngresadas = 0;

  const filas = list.map((r) => {
    const u = byUser[r.usuario_id];
    const nombre = u ? `${u.nombre} ${u.apellido}`.trim() : "—";
    const plazas = plazasSmartseatPorInvitado({
      asistencia: r.asistencia,
      grupo_cupos_max: r.grupo_cupos_max,
      grupo_personas_confirmadas: r.grupo_personas_confirmadas,
    });

    if (r.asistencia === "confirmado") {
      invitacionesConfirmadas += 1;
      personasConfirmadasEsperadas += plazas;
    }
    if (r.ingresado) {
      invitacionesIngresadas += 1;
      personasIngresadas += plazas;
    }

    return {
      id: r.id,
      nombre,
      dni: u?.dni ?? "—",
      grupo: r.grupo ?? "—",
      asistencia: r.asistencia,
      personasGrupo: plazas,
      ingresado: !!r.ingresado,
      ingresoAt: r.ingreso_at,
      mesaNumero: r.mesa_id ? (mesaNumById[r.mesa_id] ?? null) : null,
    };
  });

  filas.sort((a, b) => {
    if (a.ingresoAt && b.ingresoAt) return b.ingresoAt.localeCompare(a.ingresoAt);
    if (a.ingresoAt) return -1;
    if (b.ingresoAt) return 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return NextResponse.json({
    evento: { id: evento.id, nombre: evento.nombre, fecha: evento.fecha },
    resumen: {
      invitacionesTotales: list.length,
      invitacionesConfirmadas,
      personasConfirmadasEsperadas,
      invitacionesIngresadas,
      personasIngresadas,
    },
    filas,
  });
}
