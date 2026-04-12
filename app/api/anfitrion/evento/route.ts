import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { ensureMesasForEvento } from "@/lib/ensureEventoMesas";
import {
  contarMenuPersonaStats,
  menuOpcionesParaEvento,
  parseGrupoMenusJson,
  plazasSmartseatPorInvitado,
} from "@/lib/grupoFamiliar";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
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
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const supabase = adminClient();

  // Obtener datos del usuario (nombre)
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, apellido")
    .eq("id", user.id)
    .single();

  // Buscar el evento más reciente donde este usuario es anfitrión
  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, nombre, tipo, fecha, horario, salon, direccion, cant_invitados, cant_mesas, dress_code, anfitrion1_nombre, anfitrion2_nombre, monto_total, sena, menus_especiales"
    )
    .eq("anfitrion_id", user.id)
    .order("fecha", { ascending: false })
    .limit(1)
    .single();

  if (!evento) {
    return NextResponse.json({ error: "No tienes eventos asignados" }, { status: 404 });
  }

  const [{ data: invitados }, { data: mesasInitial }] = await Promise.all([
    supabase
      .from("invitados")
      .select(
        "id, asistencia, restriccion_alimentaria, restriccion_otro, rol_smartpool, mesa_id, usuario_id, created_at, grupo_menus_json, grupo_cupos_max, grupo_personas_confirmadas",
      )
      .eq("evento_id", evento.id),
    supabase.from("mesas").select("id, numero").eq("evento_id", evento.id).order("numero", { ascending: true }),
  ]);

  let mesasRows = mesasInitial ?? [];
  try {
    mesasRows = await ensureMesasForEvento(supabase, evento.id, evento.cant_mesas ?? 0);
  } catch (e) {
    console.warn("[anfitrion/evento] ensureMesasForEvento:", e);
    mesasRows = mesasInitial ?? [];
  }

  const stats = {
    /** Personas con asistencia confirmada (suma de grupo familiar). */
    confirmados: 0,
    /** Filas de invitación confirmadas (titular del grupo). */
    invitacionesConfirmadas: 0,
    noAsiste: 0,
    pendientes: 0,
    /** Mesas sin ningún confirmado asignado (vacías). */
    mesasPendientes: 0,
    /** Al menos un confirmado pero menos que la capacidad por mesa (SmartSeat). */
    mesasIncompletas: 0,
    /** Confirmados en la mesa ≥ cupo por mesa (⌈invitados/mesas⌉). */
    mesasCompletas: 0,
    menuStandard: 0,
    menuCeliaco: 0,
    menuOtros: 0,
    ecoSi: 0,
    ecoNo: 0,
  };

  const rawSeatsPerTable =
    evento.cant_mesas > 0
      ? Math.ceil((evento.cant_invitados ?? 0) / evento.cant_mesas)
      : 10;
  const seatsPerTable = rawSeatsPerTable > 0 ? rawSeatsPerTable : 1;

  /** Ocupación física por mesa: confirmados + pendientes con asiento (excluye rechazados). Misma idea que SmartSeat. */
  const ocupacionPorMesa = new Map<string, number>();
  for (const inv of invitados ?? []) {
    const plazas = plazasSmartseatPorInvitado({
      asistencia: inv.asistencia,
      grupo_cupos_max: inv.grupo_cupos_max,
      grupo_personas_confirmadas: inv.grupo_personas_confirmadas,
    });

    if (inv.asistencia === "confirmado") {
      stats.confirmados += plazas;
      stats.invitacionesConfirmadas += 1;
    } else if (inv.asistencia === "rechazado") stats.noAsiste++;
    else stats.pendientes++;

    /* Menús y EcoGuest: solo confirmados (pendientes/rechazados no cuentan para cocina ni el pool efectivo). */
    if (inv.asistencia === "confirmado") {
      const row = inv as (typeof inv) & { grupo_menus_json?: unknown };
      const menusGrupo = parseGrupoMenusJson(row.grupo_menus_json);
      if (menusGrupo.length > 0) {
        for (const m of menusGrupo) {
          contarMenuPersonaStats(m, stats);
        }
      } else {
        const r = inv.restriccion_alimentaria?.toLowerCase() ?? "";
        if (!r || r === "ninguna" || r === "standard") stats.menuStandard++;
        else if (r.includes("celiaco") || r.includes("celíaco") || r.includes("tacc")) stats.menuCeliaco++;
        else stats.menuOtros++;
      }

      if (inv.rol_smartpool && inv.rol_smartpool !== "no") stats.ecoSi++;
      else stats.ecoNo++;
    }

    const mesaKey =
      inv.mesa_id != null && inv.mesa_id !== ""
        ? String(inv.mesa_id).trim().toLowerCase()
        : "";
    if (inv.asistencia !== "rechazado" && mesaKey && plazas > 0) {
      ocupacionPorMesa.set(mesaKey, (ocupacionPorMesa.get(mesaKey) ?? 0) + plazas);
    }
  }

  for (const m of mesasRows ?? []) {
    const c = ocupacionPorMesa.get(String(m.id).trim().toLowerCase()) ?? 0;
    if (c === 0) stats.mesasPendientes++;
    else if (c >= seatsPerTable) stats.mesasCompletas++;
    else stats.mesasIncompletas++;
  }

  const sortedByRecent = [...(invitados ?? [])].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const recentSlice = sortedByRecent.slice(0, 12);
  const userIds = [...new Set(recentSlice.map((i) => i.usuario_id))];
  let nameByUser: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: usrs } = await supabase
      .from("usuarios")
      .select("id, nombre, apellido")
      .in("id", userIds);
    if (usrs) {
      nameByUser = Object.fromEntries(
        usrs.map((u) => [
          u.id,
          `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() || "Invitado",
        ]),
      );
    }
  }

  const actividadReciente = recentSlice.map((inv) => {
    const nombre = nameByUser[inv.usuario_id] ?? "Invitado";
    const r = inv.restriccion_alimentaria?.toLowerCase() ?? "";
    const otro = inv.restriccion_otro?.trim();

    let accion: string;
    if (inv.asistencia === "confirmado") {
      if (r.includes("celiac") || r.includes("celíac") || r.includes("tacc")) {
        accion = "Confirmó asistencia · menú celíaco";
      } else if (r === "otro" && otro) {
        accion = `Confirmó asistencia · ${otro}`;
      } else if (r && r !== "ninguna" && r !== "standard" && r !== "otro") {
        accion = `Confirmó asistencia · menú especial`;
      } else {
        accion = "Confirmó asistencia";
      }
    } else if (inv.asistencia === "rechazado") {
      accion = "Indicó que no asiste";
    } else if (r.includes("celiac") || r.includes("celíac") || r.includes("tacc")) {
      accion = "Marcó menú celíaco (pendiente de confirmar)";
    } else if (r === "otro" && otro) {
      accion = `Indicó restricción: ${otro}`;
    } else if (r && r !== "ninguna" && r !== "standard") {
      accion = "Completó datos de menú";
    } else if (inv.rol_smartpool && inv.rol_smartpool !== "no") {
      accion = "Se sumó a SmartPool / EcoGuest";
    } else {
      accion = "Se registró en el evento";
    }

    return { id: inv.id, nombre, accion };
  });

  const d = new Date(evento.fecha + "T12:00:00");
  const hoy = new Date();
  const diasRestantes = Math.max(0, Math.ceil((d.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)));

  const menuOpciones = menuOpcionesParaEvento(evento.menus_especiales);

  return NextResponse.json(
    {
    usuario: {
      nombre: `${usuario?.nombre ?? ""} ${usuario?.apellido ?? ""}`.trim(),
    },
    menuOpciones,
    evento: {
      id: evento.id,
      nombre: evento.nombre,
      tipo: evento.tipo,
      fecha: evento.fecha,
      horario: evento.horario,
      salon: evento.salon,
      direccion: evento.direccion,
      cantInvitados: evento.cant_invitados,
      cantMesas: evento.cant_mesas,
      diasRestantes,
      menus_especiales: evento.menus_especiales,
    },
    stats,
    actividadReciente,
    invitados: invitados ?? [],
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    }
  );
}
