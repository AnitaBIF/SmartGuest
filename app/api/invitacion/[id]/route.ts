import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { clampCuposMax, menuOpcionesParaEvento } from "@/lib/grupoFamiliar";
import { dniValido } from "@/lib/registroSalon";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = adminClient();

  /** Si `id` es una fila de `invitados`, resolvemos el evento desde ahí (enlace personal). */
  let eventoId = id;
  let invitadoId: string | null = null;
  let invitadoPrecargado: {
    nombreCompleto: string;
    telefono: string | null;
    /** Si el DNI en BD es real, el formulario no lo pide; si es provisorio (SG…) o vacío, hay que completarlo. */
    dniConocido: string | null;
  } | null = null;

  const { data: invRow } = await supabase
    .from("invitados")
    .select("id, evento_id, telefono, usuario_id, grupo_cupos_max")
    .eq("id", id)
    .maybeSingle();

  if (invRow) {
    eventoId = invRow.evento_id;
    invitadoId = invRow.id;

    const { data: u } = await supabase
      .from("usuarios")
      .select("nombre, apellido, dni")
      .eq("id", invRow.usuario_id)
      .maybeSingle();

    const nombreCompleto = u ? `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() : "";
    const dniRaw = (u?.dni ?? "").trim();
    const dniEsProvisorioSmartguest = /^sg[0-9a-f]+$/i.test(dniRaw.replace(/\s/g, ""));
    /** Solo precargamos DNI si es un documento argentino típico (7–8 dígitos), no provisorio SG… */
    const dniParaPrecarga =
      !dniEsProvisorioSmartguest && dniValido(dniRaw) ? dniRaw.replace(/\D/g, "") : null;

    invitadoPrecargado = {
      nombreCompleto: nombreCompleto || "Invitado",
      telefono: invRow.telefono?.trim() || null,
      dniConocido: dniParaPrecarga,
    };
  }

  const { data: evento, error } = await supabase
    .from("eventos")
    .select(
      "id, nombre, tipo, fecha, horario, salon, direccion, dress_code, anfitrion1_nombre, anfitrion2_nombre, menus_especiales"
    )
    .eq("id", eventoId)
    .single();

  if (error || !evento) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const d = new Date(evento.fecha + "T12:00:00");
  const fechaFormateada = d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const anfitriones = [evento.anfitrion1_nombre, evento.anfitrion2_nombre]
    .filter(Boolean)
    .join(" y ");

  const grupoCuposMax = invRow
    ? clampCuposMax((invRow as { grupo_cupos_max?: number }).grupo_cupos_max, 1)
    : 1;

  const menuOpciones = menuOpcionesParaEvento(evento.menus_especiales);

  return NextResponse.json({
    id: evento.id,
    invitadoId,
    invitadoPrecargado,
    grupoCuposMax,
    nombre: evento.nombre,
    tipo: evento.tipo,
    anfitriones,
    fecha: fechaFormateada,
    horario: evento.horario,
    salon: evento.salon,
    direccion: evento.direccion,
    dressCode: evento.dress_code,
    menuOpciones,
  });
}
