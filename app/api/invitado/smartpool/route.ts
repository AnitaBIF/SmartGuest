import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database, RolSmartpool } from "@/lib/database.types";
import {
  fetchInvitacionPriorizada,
  type InvitadoSmartpoolRow,
} from "@/lib/invitacionUsuarioPriorizada";
import {
  rankPasajerosParaConductor,
  type ConductorCtx,
} from "@/lib/smartpoolSugerencias";
import { rankPasajerosConIaTucuman } from "@/lib/smartpoolTucumanIa";
import {
  clampCuposMax,
  ecoGuestPermitidoPorCuposInvitacion,
  plazasSmartpoolPasajeros,
} from "@/lib/grupoFamiliar";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Igual que /api/invitado/evento (cookies de sesión en la petición). */
function createAuthClient(req: NextRequest) {
  const response = NextResponse.next();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}

function eventoIdFromRequest(req: NextRequest, body?: { eventoId?: string }): string | null {
  const q = req.nextUrl.searchParams.get("eventoId")?.trim() || req.nextUrl.searchParams.get("evento_id")?.trim();
  if (q) return q;
  const b = body?.eventoId?.trim();
  return b || null;
}

function isMissingColumnError(err: { message?: string; code?: string } | null): boolean {
  if (!err) return false;
  const m = (err.message ?? "").toLowerCase();
  return err.code === "42703" || m.includes("column") || m.includes("does not exist");
}

type InvitadoSugerenciaRow = {
  id: string;
  usuario_id: string;
  localidad: string | null;
  direccion: string | null;
  rol_smartpool: string | null;
};

function rowsToPasajerosInput(
  rows: InvitadoSugerenciaRow[],
  byUser: Record<string, { nombre: string; apellido: string } | undefined>
) {
  return rows.map((r) => {
    const u = byUser[r.usuario_id];
    return {
      id: r.id,
      localidad: r.localidad,
      direccion: r.direccion,
      smartpool_lat: null as number | null,
      smartpool_lng: null as number | null,
      nombre: u?.nombre ?? "Invitado",
      apellido: u?.apellido ?? "",
    };
  });
}

type SugerenciaPasajeroApi = {
  invitadoId: string;
  nombre: string;
  localidad: string | null;
  direccion: string | null;
  distanciaKm: number | null;
};

function sugerenciasSoloDatos(
  ordenados: Array<{ invitadoId: string; nombre: string; localidad: string | null; distanciaKm: number | null }>,
  byRowId: Map<string, InvitadoSugerenciaRow>
): SugerenciaPasajeroApi[] {
  return ordenados.map((s) => {
    const idNorm = s.invitadoId.trim().toLowerCase();
    const r = byRowId.get(idNorm);
    const dir = r?.direccion?.trim() || null;
    const loc = (r?.localidad ?? s.localidad)?.trim() || null;
    return {
      invitadoId: idNorm,
      nombre: s.nombre,
      localidad: loc,
      direccion: dir,
      distanciaKm: s.distanciaKm,
    };
  });
}

async function buildSugerenciasConductor(
  supabase: ReturnType<typeof adminClient>,
  me: InvitadoSmartpoolRow,
  parejaColumnsOk: boolean
): Promise<SugerenciaPasajeroApi[]> {
  const conductor: ConductorCtx = {
    localidad: me.localidad ?? null,
    direccion: me.direccion ?? null,
    lat: null,
    lng: null,
  };

  let q = supabase
    .from("invitados")
    .select("id, usuario_id, localidad, direccion, rol_smartpool")
    .eq("evento_id", me.evento_id)
    .eq("asistencia", "confirmado")
    .or("rol_smartpool.eq.pasajero,rol_smartpool.is.null")
    .neq("id", me.id);

  if (parejaColumnsOk) {
    q = q.is("smartpool_pareja_invitado_id", null);
  }

  const { data: rowList, error: listErr } = await q;

  if (listErr) {
    console.warn("[smartpool] listado pasajeros:", listErr.message);
    return [];
  }
  if (!rowList?.length) return [];

  const rows = rowList as InvitadoSugerenciaRow[];
  const byRowId = new Map(rows.map((r) => [r.id.trim().toLowerCase(), r]));
  const userIds = [...new Set(rows.map((x) => x.usuario_id))];
  const { data: usrs } = await supabase.from("usuarios").select("id, nombre, apellido").in("id", userIds);
  const byUser = Object.fromEntries((usrs ?? []).map((u) => [u.id, u]));

  const committed = rows.filter((r) => r.rol_smartpool === "pasajero");
  const pending = rows.filter((r) => r.rol_smartpool == null);

  const max = 12;
  const inCommitted = rowsToPasajerosInput(committed, byUser);
  const inPending = rowsToPasajerosInput(pending, byUser);

  const rankedCommitted = rankPasajerosParaConductor(conductor, inCommitted, max);
  const rest = max - rankedCommitted.length;
  const rankedPending =
    rest > 0 ? rankPasajerosParaConductor(conductor, inPending, rest) : [];

  const heuristicRaw = [...rankedCommitted, ...rankedPending];

  const apiKey =
    process.env.SMARTGUEST_OPENAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  if (apiKey && heuristicRaw.length > 0) {
    const iaIn = [...inCommitted, ...inPending].map((p) => ({
      id: p.id,
      localidad: p.localidad,
      direccion: p.direccion,
      nombre: `${p.nombre} ${p.apellido}`.trim() || p.nombre,
    }));
    const ia = await rankPasajerosConIaTucuman(
      { localidad: me.localidad ?? null, direccion: me.direccion ?? null },
      iaIn,
      apiKey
    );
    if (ia && ia.length > 0) {
      const ordenIa = ia.slice(0, max).map((x) => ({
        invitadoId: x.invitadoId,
        nombre: x.nombre,
        localidad: x.localidad,
        distanciaKm: x.distanciaKm,
      }));
      return sugerenciasSoloDatos(ordenIa, byRowId);
    }
  }

  return sugerenciasSoloDatos(heuristicRaw, byRowId);
}

function cuposInvitacionEnFila(inv: InvitadoSmartpoolRow): number {
  return clampCuposMax(inv.grupo_cupos_max, 1);
}

function plazasPasajeroPoolEfectivas(inv: InvitadoSmartpoolRow): number {
  return plazasSmartpoolPasajeros(cuposInvitacionEnFila(inv));
}

/** Deja rol_smartpool en `no` y limpia pareja / pasajeros. Devuelve mensaje de error o null si OK. */
async function salirSmartpool(
  supabase: ReturnType<typeof adminClient>,
  myInvId: string
): Promise<string | null> {
  const { data: me, error: eSel } = await supabase
    .from("invitados")
    .select("smartpool_pareja_invitado_id, rol_smartpool")
    .eq("id", myInvId)
    .maybeSingle();

  if (eSel && isMissingColumnError(eSel)) {
    const { error } = await supabase
      .from("invitados")
      .update({ rol_smartpool: "no" })
      .eq("id", myInvId);
    return error?.message ?? null;
  }

  if (eSel) {
    return eSel.message;
  }

  const partnerId = me?.smartpool_pareja_invitado_id ?? null;
  const soyConductor = me?.rol_smartpool === "conductor";

  if (soyConductor) {
    const libPax = await supabase
      .from("invitados")
      .update({ smartpool_pareja_invitado_id: null, smartpool_acepto: false })
      .eq("smartpool_pareja_invitado_id", myInvId);
    if (libPax.error && !isMissingColumnError(libPax.error)) {
      return libPax.error.message;
    }
  }

  const uMe = await supabase
    .from("invitados")
    .update({
      rol_smartpool: "no",
      smartpool_pareja_invitado_id: null,
      smartpool_acepto: false,
    })
    .eq("id", myInvId);

  if (uMe.error) {
    if (isMissingColumnError(uMe.error)) {
      const { error } = await supabase
        .from("invitados")
        .update({ rol_smartpool: "no" })
        .eq("id", myInvId);
      return error?.message ?? null;
    }
    return uMe.error.message;
  }

  if (partnerId) {
    const uP = await supabase
      .from("invitados")
      .update({ smartpool_pareja_invitado_id: null, smartpool_acepto: false })
      .eq("id", partnerId);
    if (uP.error) {
      return uP.error.message;
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const supabaseAuth = createAuthClient(req);
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const supabase = adminClient();
  const eventoId = eventoIdFromRequest(req);
  const { row: me, error: loadErr, parejaColumnsOk } = await fetchInvitacionPriorizada(supabase, userId, {
    eventoId,
  });

  if (loadErr || !me) {
    return NextResponse.json({ error: loadErr ?? "No se encontró invitación" }, { status: 404 });
  }

  const current = me;
  const nInvitacion = cuposInvitacionEnFila(current);

  if (!ecoGuestPermitidoPorCuposInvitacion(nInvitacion)) {
    return NextResponse.json({
      rol: null,
      ecoInvitacionSinCarpooling: true,
      grupoCuposInvitacion: nInvitacion,
      tieneTelefono: !!(current.telefono && current.telefono.trim()),
      pareja: null,
      pasajeros: [],
      cuposMax: null,
      cuposOcupados: null,
      sugerencias: [] as unknown[],
    });
  }

  const rol = current.rol_smartpool;
  /* null = aún no eligió; "no" = guardó "No me interesa" */
  if (rol == null || rol === "no") {
    return NextResponse.json({
      rol: rol === "no" ? "no" : null,
      grupoCuposInvitacion: nInvitacion,
      plazasSmartpoolPasajeros: plazasPasajeroPoolEfectivas(current),
      tieneTelefono: !!(current.telefono && current.telefono.trim()),
      pareja: null,
      pasajeros: [],
      cuposMax: null,
      cuposOcupados: null,
      sugerencias: [] as unknown[],
    });
  }

  const cuposMax = plazasPasajeroPoolEfectivas(current);

  if (rol === "conductor") {
    const { data: pasajerosRows, error: paxErr } = await supabase
      .from("invitados")
      .select("id, usuario_id, rol_smartpool, telefono, smartpool_acepto, created_at")
      .eq("smartpool_pareja_invitado_id", current.id)
      .order("created_at", { ascending: true });

    if (paxErr) {
      console.warn("[smartpool] pasajeros del conductor:", paxErr.message);
    }

    const rows = pasajerosRows ?? [];
    const ocupados = rows.length;
    const userIds = [...new Set(rows.map((r) => r.usuario_id))];
    const { data: usrs } =
      userIds.length > 0
        ? await supabase.from("usuarios").select("id, nombre, apellido").in("id", userIds)
        : { data: [] as { id: string; nombre: string; apellido: string }[] };
    const byUser = Object.fromEntries((usrs ?? []).map((u) => [u.id, u]));

    const pasajeros = rows.map((r) => {
      const u = byUser[r.usuario_id];
      const nombre = u ? `${u.nombre} ${u.apellido}`.trim() : "Invitado/a";
      const elAcepto = !!r.smartpool_acepto;
      return {
        id: r.id,
        nombre,
        rol: r.rol_smartpool,
        yoAcepte: true,
        elAcepto,
        mutuo: elAcepto,
        telefono: elAcepto ? (r.telefono?.trim() || null) : null,
      };
    });

    const hayCupos = ocupados < cuposMax;
    let sugerencias: Awaited<ReturnType<typeof buildSugerenciasConductor>> = [];
    if (parejaColumnsOk && hayCupos) {
      try {
        sugerencias = await buildSugerenciasConductor(supabase, current, parejaColumnsOk);
      } catch {
        sugerencias = [];
      }
    }

    return NextResponse.json({
      rol,
      grupoCuposInvitacion: nInvitacion,
      plazasSmartpoolPasajeros: cuposMax,
      tieneTelefono: !!(current.telefono && current.telefono.trim()),
      pareja: null,
      pasajeros,
      cuposMax,
      cuposOcupados: ocupados,
      sugerencias,
    });
  }

  /* Pasajero: el vínculo es smartpool_pareja_invitado_id → conductor */
  if (!current.smartpool_pareja_invitado_id) {
    return NextResponse.json({
      rol,
      grupoCuposInvitacion: nInvitacion,
      plazasSmartpoolPasajeros: plazasPasajeroPoolEfectivas(current),
      tieneTelefono: !!(current.telefono && current.telefono.trim()),
      pareja: null,
      pasajeros: [],
      cuposMax: null,
      cuposOcupados: null,
      sugerencias: [],
    });
  }

  const { data: partnerInv, error: pErr } = await supabase
    .from("invitados")
    .select("id, usuario_id, rol_smartpool, telefono, smartpool_acepto")
    .eq("id", current.smartpool_pareja_invitado_id)
    .maybeSingle();

  if (pErr || !partnerInv) {
    return NextResponse.json({
      rol,
      grupoCuposInvitacion: nInvitacion,
      plazasSmartpoolPasajeros: plazasPasajeroPoolEfectivas(current),
      tieneTelefono: !!(current.telefono && current.telefono.trim()),
      pareja: null,
      pasajeros: [],
      cuposMax: null,
      cuposOcupados: null,
      sugerencias: [],
    });
  }

  const { data: u } = await supabase
    .from("usuarios")
    .select("nombre, apellido")
    .eq("id", partnerInv.usuario_id)
    .single();

  const nombrePareja = u ? `${u.nombre} ${u.apellido}`.trim() : "Invitado/a";
  const partnerEsConductor = partnerInv.rol_smartpool === "conductor";
  const elAcepto = partnerEsConductor ? true : !!partnerInv.smartpool_acepto;
  const mutuo = !!current.smartpool_acepto && elAcepto;

  return NextResponse.json({
    rol,
    grupoCuposInvitacion: nInvitacion,
    plazasSmartpoolPasajeros: plazasPasajeroPoolEfectivas(current),
    tieneTelefono: !!(current.telefono && current.telefono.trim()),
    pareja: {
      id: partnerInv.id,
      nombre: nombrePareja,
      rol: partnerInv.rol_smartpool,
      yoAcepte: current.smartpool_acepto,
      elAcepto,
      mutuo,
      telefono: mutuo ? (partnerInv.telefono?.trim() || null) : null,
    },
    pasajeros: [],
    cuposMax: null,
    cuposOcupados: null,
    sugerencias: [],
  });
}

export async function PUT(req: NextRequest) {
  const supabaseAuth = createAuthClient(req);
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: { rol?: string; eventoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const eventoId = eventoIdFromRequest(req, body);

  const rol = body.rol as RolSmartpool | "no" | undefined;
  if (rol !== "conductor" && rol !== "pasajero" && rol !== "no") {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  const supabase = adminClient();
  const { row: inv, error: invErr } = await fetchInvitacionPriorizada(supabase, userId, { eventoId });

  if (invErr || !inv) {
    return NextResponse.json({ error: invErr ?? "No se encontró invitación" }, { status: 404 });
  }

  const nInv = cuposInvitacionEnFila(inv);
  if (!ecoGuestPermitidoPorCuposInvitacion(nInv) && (rol === "conductor" || rol === "pasajero")) {
    return NextResponse.json(
      {
        error:
          "Las invitaciones de más de 5 personas no tienen acceso a EcoGuest ni al SmartPool. Pedile al anfitrión que ajuste los cupos de tu invitación si corresponde.",
      },
      { status: 403 }
    );
  }

  if (rol === "no") {
    const salirErr = await salirSmartpool(supabase, inv.id);
    if (salirErr) {
      return NextResponse.json({ error: salirErr }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const poolSlots = plazasPasajeroPoolEfectivas(inv);
  const updatePayload =
    rol === "conductor"
      ? { rol_smartpool: rol, smartpool_cupos_max: poolSlots }
      : { rol_smartpool: rol };

  const { error: upErr } = await supabase.from("invitados").update(updatePayload).eq("id", inv.id);

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
