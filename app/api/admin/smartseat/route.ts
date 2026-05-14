import { NextRequest, NextResponse } from "next/server";
import { eventoPerteneceAlSalon, requireSalonAdmin } from "@/lib/adminSalonAuth";
import { ensureMesasForEvento } from "@/lib/ensureEventoMesas";
import { plazasSmartseatPorInvitado } from "@/lib/grupoFamiliar";
import { nombreDisplayInvitado } from "@/lib/invitadosImport";

/**
 * Lectura del armado de mesas (SmartSeat) para el administrador del salón.
 * No modifica nada: solo devuelve la foto actual de mesas + invitados + asignaciones.
 */
export async function GET(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, salonNombre, salonDireccion } = auth.ctx;

  const eventoId = req.nextUrl.searchParams.get("eventoId")?.trim();
  if (!eventoId) {
    return NextResponse.json({ error: "Falta eventoId." }, { status: 400 });
  }

  const { data: evento, error: evErr } = await db
    .from("eventos")
    .select("id, nombre, fecha, horario, cant_invitados, cant_mesas, salon, direccion")
    .eq("id", eventoId)
    .maybeSingle();

  if (evErr || !evento) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }
  if (!eventoPerteneceAlSalon(evento, salonNombre, salonDireccion)) {
    return NextResponse.json({ error: "No autorizado a ver este evento." }, { status: 403 });
  }

  const cantInvitados = typeof evento.cant_invitados === "number" ? evento.cant_invitados : 0;
  const cantMesas = typeof evento.cant_mesas === "number" ? evento.cant_mesas : 0;

  let mesas: { id: string; numero: number }[] = [];
  try {
    mesas = await ensureMesasForEvento(db, evento.id, cantMesas);
  } catch (e) {
    console.warn("[admin smartseat GET] ensureMesasForEvento:", e);
    const { data: fallback } = await db
      .from("mesas")
      .select("id, numero")
      .eq("evento_id", evento.id)
      .order("numero", { ascending: true });
    mesas = fallback ?? [];
  }

  const { data: invitadosRaw } = await db
    .from("invitados")
    .select(
      "id, usuario_id, mesa_id, asistencia, restriccion_alimentaria, restriccion_otro, grupo, rango_etario, grupo_cupos_max, grupo_personas_confirmadas, pending_import_nombre"
    )
    .eq("evento_id", evento.id);

  const invitados = (invitadosRaw ?? []).filter((i) => i.asistencia !== "rechazado");

  const userIds = [...new Set(invitados.map((i) => i.usuario_id).filter((id): id is string => !!id))];
  const userNames: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: usuarios } = await db
      .from("usuarios")
      .select("id, nombre, apellido")
      .in("id", userIds);
    if (usuarios) {
      for (const u of usuarios) {
        userNames[u.id] = `${u.nombre} ${u.apellido}`.trim();
      }
    }
  }

  // Capacidad real: si cant_invitados está sin completar, usamos el total de plazas reales.
  const totalPlazasReales = invitados.reduce((s, i) => {
    const row = i as typeof i & { grupo_cupos_max?: number | null; grupo_personas_confirmadas?: number | null };
    return (
      s +
      plazasSmartseatPorInvitado({
        asistencia: i.asistencia,
        grupo_cupos_max: row.grupo_cupos_max,
        grupo_personas_confirmadas: row.grupo_personas_confirmadas,
      })
    );
  }, 0);
  const baseInvitados = Math.max(cantInvitados, totalPlazasReales);
  const seatsPerTable = cantMesas > 0 ? Math.max(1, Math.ceil(baseInvitados / cantMesas)) : 10;

  const guests = invitados.map((i) => {
    const row = i as typeof i & { grupo_cupos_max?: number | null; grupo_personas_confirmadas?: number | null };
    const seatCount = plazasSmartseatPorInvitado({
      asistencia: i.asistencia,
      grupo_cupos_max: row.grupo_cupos_max,
      grupo_personas_confirmadas: row.grupo_personas_confirmadas,
    });
    return {
      id: i.id,
      name: nombreDisplayInvitado({
        nombreUsuario: i.usuario_id ? userNames[i.usuario_id] ?? null : null,
        pendingImportNombre: (i as { pending_import_nombre?: string | null }).pending_import_nombre,
      }),
      mesaId: i.mesa_id,
      asistencia: i.asistencia,
      restriccion: i.restriccion_alimentaria,
      restriccionOtro: i.restriccion_otro,
      grupo: i.grupo || "Sin grupo",
      rangoEtario: i.rango_etario || "Adulto",
      seatCount,
    };
  });

  return NextResponse.json(
    {
      evento: {
        id: evento.id,
        nombre: evento.nombre,
        fecha: evento.fecha,
        horario: evento.horario,
        salon: evento.salon,
        direccion: evento.direccion,
      },
      seatsPerTable,
      mesas,
      guests,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
