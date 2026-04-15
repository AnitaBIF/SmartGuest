import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { eventoCoincideConSalonPerfil } from "@/lib/adminSalonAuth";
import { ensureMesasForEvento } from "@/lib/ensureEventoMesas";
import { parseGrupoMenusJson, plazasSmartseatPorInvitado } from "@/lib/grupoFamiliar";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUserId(req: NextRequest) {
  const response = NextResponse.next();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(c) { c.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
      },
    }
  );
  const { data: { user } } = await supabaseAuth.auth.getUser();
  return user?.id ?? null;
}

type EventoSmartseatScoped = {
  id: string;
  cant_invitados: number;
  cant_mesas: number;
  salon: string;
  direccion: string;
};

async function eventoSmartseatDelAnfitrion(
  supabase: ReturnType<typeof adminClient>,
  userId: string,
  variant: "get" | "put" | "post"
): Promise<EventoSmartseatScoped | null> {
  const { data: me } = await supabase
    .from("usuarios")
    .select("tipo, salon_nombre, salon_direccion")
    .eq("id", userId)
    .single();
  if (me?.tipo !== "anfitrion") return null;

  const { data: evento } =
    variant === "put"
      ? await supabase
          .from("eventos")
          .select("id, cant_mesas, salon, direccion")
          .eq("anfitrion_id", userId)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await supabase
          .from("eventos")
          .select("id, cant_invitados, cant_mesas, salon, direccion")
          .eq("anfitrion_id", userId)
          .order("fecha", { ascending: false })
          .limit(1)
          .maybeSingle();

  if (!evento) return null;
  if (!eventoCoincideConSalonPerfil(evento, me.salon_nombre ?? "", me.salon_direccion ?? "")) {
    return null;
  }
  const row = evento as Partial<EventoSmartseatScoped> & { id: string; salon: string; direccion: string };
  const cant_invitados =
    typeof row.cant_invitados === "number" ? row.cant_invitados : variant === "put" ? 0 : 0;
  const cant_mesas = typeof row.cant_mesas === "number" ? row.cant_mesas : 0;
  return {
    id: row.id,
    salon: row.salon,
    direccion: row.direccion,
    cant_invitados,
    cant_mesas,
  };
}

// GET: mesas, invitados y asignaciones actuales
export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = adminClient();

  const evento = await eventoSmartseatDelAnfitrion(supabase, userId, "get");
  if (!evento) return NextResponse.json({ error: "Sin evento" }, { status: 404 });

  const seatsPerTable = evento.cant_mesas > 0
    ? Math.ceil(evento.cant_invitados / evento.cant_mesas)
    : 10;

  let mesas: { id: string; numero: number }[] = [];
  try {
    mesas = await ensureMesasForEvento(supabase, evento.id, evento.cant_mesas ?? 0);
  } catch (e) {
    console.warn("[smartseat GET] ensureMesasForEvento:", e);
    const { data: fallback } = await supabase
      .from("mesas")
      .select("id, numero")
      .eq("evento_id", evento.id)
      .order("numero", { ascending: true });
    mesas = fallback ?? [];
  }

  const { data: invitadosRaw } = await supabase
    .from("invitados")
    .select(
      "id, usuario_id, mesa_id, asistencia, restriccion_alimentaria, restriccion_otro, grupo, rango_etario, grupo_menus_json, grupo_cupos_max, grupo_personas_confirmadas"
    )
    .eq("evento_id", evento.id);

  /** SmartSeat: todos los que pueden ocupar mesa (pendiente o confirmado; los que no asisten no entran). */
  const invitados = (invitadosRaw ?? []).filter((i) => i.asistencia !== "rechazado");

  // Nombres de los invitados
  const userIds = invitados.map((i) => i.usuario_id).filter(Boolean);
  const userNames: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: usuarios } = await supabase
      .from("usuarios")
      .select("id, nombre, apellido")
      .in("id", userIds);
    if (usuarios) {
      for (const u of usuarios) {
        userNames[u.id] = `${u.nombre} ${u.apellido}`.trim();
      }
    }
  }

  const guests = invitados.map((i) => {
    const row = i as typeof i & { grupo_menus_json?: unknown };
    const grupoMenus = parseGrupoMenusJson(row.grupo_menus_json);
    const seatCount = plazasSmartseatPorInvitado({
      asistencia: i.asistencia,
      grupo_cupos_max: row.grupo_cupos_max,
      grupo_personas_confirmadas: row.grupo_personas_confirmadas,
    });
    return {
      id: i.id,
      name: userNames[i.usuario_id] || "Invitado",
      mesaId: i.mesa_id,
      asistencia: i.asistencia,
      restriccion: i.restriccion_alimentaria,
      restriccionOtro: i.restriccion_otro,
      grupo: i.grupo || "Sin grupo",
      rangoEtario: i.rango_etario || "Adulto",
      grupoMenus: grupoMenus.length > 0 ? grupoMenus : null,
      seatCount,
    };
  });

  return NextResponse.json(
    {
      eventoId: evento.id,
      seatsPerTable,
      mesas,
      guests,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

// PUT: guardar asignaciones de mesa
export async function PUT(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { assignments } = await req.json() as {
    assignments: { invitadoId: string; mesaId: string | null }[];
  };

  const supabase = adminClient();

  const evento = await eventoSmartseatDelAnfitrion(supabase, userId, "put");
  if (!evento) {
    return NextResponse.json({ error: "Sin evento" }, { status: 404 });
  }

  try {
    await ensureMesasForEvento(supabase, evento.id, evento.cant_mesas ?? 0);
  } catch (e) {
    console.warn("[smartseat PUT] ensureMesasForEvento:", e);
  }

  if (!Array.isArray(assignments)) {
    return NextResponse.json({ error: "Falta assignments." }, { status: 400 });
  }

  const idsEnPayload = [
    ...new Set(
      assignments
        .map((a) => (typeof a?.invitadoId === "string" ? a.invitadoId.trim() : ""))
        .filter(Boolean)
    ),
  ];

  /* Quitar mesa solo a las filas que este guardado toca (confirmados y pendientes en SmartSeat). */
  if (idsEnPayload.length > 0) {
    const { error: clearErr } = await supabase
      .from("invitados")
      .update({ mesa_id: null })
      .eq("evento_id", evento.id)
      .in("id", idsEnPayload);

    if (clearErr) {
      return NextResponse.json({ error: clearErr.message }, { status: 500 });
    }
  }

  for (const a of assignments) {
    if (!a?.invitadoId || typeof a.invitadoId !== "string") continue;
    const mesaId = a.mesaId === null || a.mesaId === undefined || a.mesaId === "" ? null : String(a.mesaId);
    const { error: upErr } = await supabase
      .from("invitados")
      .update({ mesa_id: mesaId })
      .eq("id", a.invitadoId.trim())
      .eq("evento_id", evento.id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

// POST: ejecutar clustering y devolver sugerencia
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = adminClient();

  const evento = await eventoSmartseatDelAnfitrion(supabase, userId, "post");
  if (!evento) return NextResponse.json({ error: "Sin evento" }, { status: 404 });

  const seatsPerTable = evento.cant_mesas > 0
    ? Math.ceil(evento.cant_invitados / evento.cant_mesas)
    : 10;

  let mesas: { id: string; numero: number }[] = [];
  try {
    mesas = await ensureMesasForEvento(supabase, evento.id, evento.cant_mesas ?? 0);
  } catch (e) {
    console.warn("[smartseat POST] ensureMesasForEvento:", e);
    const { data: fallback } = await supabase
      .from("mesas")
      .select("id, numero")
      .eq("evento_id", evento.id)
      .order("numero", { ascending: true });
    mesas = fallback ?? [];
  }

  const { data: invitados } = await supabase
    .from("invitados")
    .select("id, grupo, rango_etario, asistencia, grupo_cupos_max, grupo_personas_confirmadas")
    .eq("evento_id", evento.id)
    .eq("asistencia", "confirmado");

  if (!invitados || mesas.length === 0) {
    return NextResponse.json({ error: "Sin mesas o invitados" }, { status: 400 });
  }

  type InvW = { id: string; grupo: string; rangoEtario: string; plazas: number };
  const weighted: InvW[] = invitados.map((inv) => ({
    id: inv.id,
    grupo: inv.grupo || "Sin grupo",
    rangoEtario: inv.rango_etario || "Adulto",
    plazas: plazasSmartseatPorInvitado({
      asistencia: inv.asistencia,
      grupo_cupos_max: inv.grupo_cupos_max,
      grupo_personas_confirmadas: inv.grupo_personas_confirmadas,
    }),
  }));

  // ─── Algoritmo de clustering (plazas = personas del grupo familiar) ───
  const RANGO_ORDER: Record<string, number> = {
    Niño: 0,
    Adolescente: 1,
    Joven: 2,
    Adulto: 3,
    Mayor: 4,
  };

  const groups: Record<string, InvW[]> = {};
  for (const w of weighted) {
    if (w.plazas <= 0) continue;
    if (!groups[w.grupo]) groups[w.grupo] = [];
    groups[w.grupo].push(w);
  }

  for (const g of Object.keys(groups)) {
    groups[g].sort(
      (a, b) =>
        (RANGO_ORDER[a.rangoEtario] ?? 3) - (RANGO_ORDER[b.rangoEtario] ?? 3)
    );
  }

  const sumPlazas = (arr: InvW[]) => arr.reduce((s, x) => s + x.plazas, 0);
  const sortedGroups = Object.entries(groups).sort(([, a], [, b]) => sumPlazas(b) - sumPlazas(a));

  const tableSlots: { mesaId: string; capacity: number; used: number; assigned: string[] }[] = mesas.map(
    (m) => ({ mesaId: m.id, capacity: seatsPerTable, used: 0, assigned: [] })
  );

  for (const [, members] of sortedGroups) {
    const remaining = [...members];
    while (remaining.length > 0) {
      const bestTable = tableSlots
        .filter((t) => t.used < t.capacity)
        .sort((a, b) => b.capacity - b.used - (a.capacity - a.used))[0];
      if (!bestTable) break;
      let space = bestTable.capacity - bestTable.used;
      let placed = false;
      while (remaining.length > 0 && space > 0) {
        const inv = remaining[0];
        if (inv.plazas > space) break;
        remaining.shift();
        bestTable.used += inv.plazas;
        bestTable.assigned.push(inv.id);
        space -= inv.plazas;
        placed = true;
      }
      if (!placed) break;
    }
  }

  const suggestion: Record<string, string | null> = {};
  for (const table of tableSlots) {
    for (const invId of table.assigned) {
      suggestion[invId] = table.mesaId;
    }
  }
  for (const inv of invitados) {
    if (!(inv.id in suggestion)) {
      suggestion[inv.id] = null;
    }
  }

  return NextResponse.json({ suggestion });
}
