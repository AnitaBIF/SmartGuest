import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { emptyMenuBuckets, mergeMenuBuckets, menuBucketsFromInvitado } from "@/lib/cocinaConteos";

type Db = SupabaseClient<Database>;

async function confirmadosPorEventoIds(db: Db, eventoIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const chunk = 200;
  for (let i = 0; i < eventoIds.length; i += chunk) {
    const slice = eventoIds.slice(i, i + chunk);
    if (slice.length === 0) continue;
    const { data } = await db
      .from("invitados")
      .select("evento_id")
      .in("evento_id", slice)
      .eq("asistencia", "confirmado");
    for (const r of data ?? []) {
      const eid = r.evento_id;
      map.set(eid, (map.get(eid) ?? 0) + 1);
    }
  }
  return map;
}

async function cocinaAgregadoEventosFuturos(
  db: Db,
  salonNombre: string,
  salonDireccion: string,
  todayIso: string
): Promise<{
  eventos_futuros_con_mesa_y_confirmados: number;
  cubiertos_confirmados_totales: number;
  estandar: number;
  celiaco: number;
  vegetariano_o_vegano: number;
  otras: number;
}> {
  const { data: eventos } = await db
    .from("eventos")
    .select("id")
    .eq("salon", salonNombre)
    .eq("direccion", salonDireccion)
    .gte("fecha", todayIso)
    .order("fecha", { ascending: true })
    .limit(22);

  let merged = emptyMenuBuckets();
  let eventosConCubiertos = 0;

  const perEvent = await Promise.all(
    (eventos ?? []).map(async (ev) => {
      const { data: mesas } = await db.from("mesas").select("id").eq("evento_id", ev.id).limit(1);
      if (!mesas?.length) return null;

      const { data: invitados } = await db
        .from("invitados")
        .select("restriccion_alimentaria, restriccion_otro, grupo_menus_json, asistencia")
        .eq("evento_id", ev.id);

      const confirmados = (invitados ?? []).filter((i) => i.asistencia === "confirmado");
      if (confirmados.length === 0) return null;

      let local = emptyMenuBuckets();
      for (const inv of confirmados) {
        local = mergeMenuBuckets(local, menuBucketsFromInvitado(inv));
      }
      return local;
    })
  );

  for (const local of perEvent) {
    if (!local) continue;
    eventosConCubiertos++;
    merged = mergeMenuBuckets(merged, local);
  }

  return {
    eventos_futuros_con_mesa_y_confirmados: eventosConCubiertos,
    cubiertos_confirmados_totales: merged.standard + merged.celiaco + merged.vegVeg + merged.otros,
    estandar: merged.standard,
    celiaco: merged.celiaco,
    vegetariano_o_vegano: merged.vegVeg,
    otras: merged.otros,
  };
}

/**
 * Datos en vivo para el asistente del administrador del salón (métricas, cocina, reuniones, agenda).
 */
export async function buildAdminSalonChatEnrichment(
  db: Db,
  userId: string,
  salonNombre: string,
  salonDireccion: string
): Promise<{
  eventos_en_salon: Record<string, unknown>[];
  admin_metricas: Record<string, unknown>;
  admin_cocina_resumen: Record<string, unknown>;
  admin_reuniones: Record<string, unknown>;
}> {
  const todayIso = new Date().toISOString().slice(0, 10);

  const [
    { data: evFutureIds },
    { data: evList },
    admin_cocina_resumen,
    { data: reu },
  ] = await Promise.all([
    db
      .from("eventos")
      .select("id")
      .eq("salon", salonNombre)
      .eq("direccion", salonDireccion)
      .gte("fecha", todayIso),
    db
      .from("eventos")
      .select("id, nombre, fecha, horario, cant_invitados, anfitrion1_nombre")
      .eq("salon", salonNombre)
      .eq("direccion", salonDireccion)
      .gte("fecha", todayIso)
      .order("fecha", { ascending: true })
      .limit(24),
    cocinaAgregadoEventosFuturos(db, salonNombre, salonDireccion, todayIso),
    db
      .from("reuniones")
      .select("titulo, fecha, hora, participantes")
      .eq("creado_por", userId)
      .order("fecha", { ascending: true })
      .limit(80),
  ]);

  const allFutIds = (evFutureIds ?? []).map((r) => r.id);

  const confirmMap = await confirmadosPorEventoIds(db, allFutIds);
  let invConfirmadosFuturos = 0;
  for (const id of allFutIds) {
    invConfirmadosFuturos += confirmMap.get(id) ?? 0;
  }

  const eventos_en_salon = (evList ?? []).map((e) => ({
    id: e.id,
    nombre: e.nombre,
    fecha: e.fecha,
    horario: e.horario,
    cupo_invitados: e.cant_invitados,
    anfitrion: e.anfitrion1_nombre,
    invitaciones_confirmadas: confirmMap.get(e.id) ?? 0,
  }));

  const admin_metricas = {
    fecha_consulta_iso: todayIso,
    total_eventos_futuros_en_salon: allFutIds.length,
    invitaciones_confirmadas_en_eventos_futuros: invConfirmadosFuturos,
  };

  const proximas = (reu ?? []).filter((r) => String(r.fecha) >= todayIso).slice(0, 16);

  const admin_reuniones = {
    proximas: proximas.map((r) => ({
      titulo: r.titulo,
      fecha: r.fecha,
      hora: r.hora ?? "",
      participantes: r.participantes,
    })),
    total_en_lista: reu?.length ?? 0,
  };

  return {
    eventos_en_salon,
    admin_metricas,
    admin_cocina_resumen,
    admin_reuniones,
  };
}
