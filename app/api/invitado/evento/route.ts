import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { fetchInvitacionPriorizada } from "@/lib/invitacionUsuarioPriorizada";
import { menuOpcionesParaEvento } from "@/lib/grupoFamiliar";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  // Obtener sesión del usuario desde cookies
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

  const { row: prior, error: priorErr } = await fetchInvitacionPriorizada(supabase, user.id);
  if (priorErr || !prior) {
    return NextResponse.json({ error: "No tienes invitaciones" }, { status: 404 });
  }

  const { data: invitacion, error: invErr } = await supabase
    .from("invitados")
    .select(
      "id, evento_id, mesa_id, asistencia, restriccion_alimentaria, restriccion_otro, cancion, direccion, localidad, telefono, rol_smartpool, qr_token, qr_expires_at"
    )
    .eq("id", prior.id)
    .single();

  if (invErr || !invitacion) {
    return NextResponse.json({ error: "No tienes invitaciones" }, { status: 404 });
  }

  // Obtener datos del evento
  const { data: evento } = await supabase
    .from("eventos")
    .select(
      "id, nombre, tipo, fecha, horario, salon, direccion, dress_code, anfitrion1_nombre, anfitrion2_nombre, menus_especiales"
    )
    .eq("id", invitacion.evento_id)
    .single();

  if (!evento) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  // Obtener número de mesa si tiene asignada
  let mesaNumero: number | null = null;
  if (invitacion.mesa_id) {
    const { data: mesa } = await supabase
      .from("mesas")
      .select("numero")
      .eq("id", invitacion.mesa_id)
      .single();
    mesaNumero = mesa?.numero ?? null;
  }

  // Obtener datos del usuario
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, apellido")
    .eq("id", user.id)
    .single();

  const d = new Date(evento.fecha + "T12:00:00");
  const fechaFormateada = d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const anfitriones = [evento.anfitrion1_nombre, evento.anfitrion2_nombre]
    .filter(Boolean)
    .join(" y ");

  const menuOpciones = menuOpcionesParaEvento(evento.menus_especiales);

  return NextResponse.json({
    usuario: {
      nombre: `${usuario?.nombre ?? ""} ${usuario?.apellido ?? ""}`.trim(),
    },
    menuOpciones,
    invitacion: {
      id: invitacion.id,
      asistencia: invitacion.asistencia,
      restriccion_alimentaria: invitacion.restriccion_alimentaria,
      restriccion_otro: invitacion.restriccion_otro,
      cancion: invitacion.cancion,
      direccion: invitacion.direccion,
      localidad: invitacion.localidad,
      telefono: invitacion.telefono,
      rol_smartpool: invitacion.rol_smartpool,
      mesa: mesaNumero,
    },
    evento: {
      id: evento.id,
      nombre: evento.nombre,
      tipo: evento.tipo,
      anfitriones,
      fecha: fechaFormateada,
      horario: evento.horario,
      salon: evento.salon,
      direccion: evento.direccion,
      dressCode: evento.dress_code,
      menus_especiales: evento.menus_especiales,
    },
  });
}
