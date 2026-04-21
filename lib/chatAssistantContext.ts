import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { eventoCoincideConSalonPerfil } from "@/lib/adminSalonAuth";
import { buildAdminSalonChatEnrichment } from "@/lib/adminSalonChatData";
import { syncCancionPlaylist } from "@/lib/cancionPlaylistSync";
import { fetchInvitacionPriorizada } from "@/lib/invitacionUsuarioPriorizada";
import { emptyMenuBuckets, mergeMenuBuckets, menuBucketsFromInvitado, type MenuBuckets } from "@/lib/cocinaConteos";
import { menuOpcionesParaEvento } from "@/lib/grupoFamiliar";
import { mergePlaylistRows } from "@/lib/playlistSongKey";

type Db = SupabaseClient<Database>;

/** Lista para el asistente (alineada con `/api/anfitrion/playlist`, muestra acotada). */
async function playlistResumenParaEventoAnfitrion(
  db: Db,
  eventoId: string
): Promise<{ total: number; muestra: { titulo: string; artista: string }[] }> {
  const { data: firstRows, error } = await db
    .from("canciones")
    .select("id, titulo, artista, pedido_por, created_at")
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: true });

  if (error) {
    return { total: 0, muestra: [] };
  }

  let list = firstRows ?? [];
  const pedidosEnPlaylist = new Set(
    list.map((r) => r.pedido_por).filter((x): x is string => typeof x === "string" && x.length > 0)
  );

  const { data: invConCancion } = await db
    .from("invitados")
    .select("usuario_id, cancion")
    .eq("evento_id", eventoId)
    .eq("asistencia", "confirmado")
    .not("cancion", "is", null);

  let refetch = false;
  for (const inv of invConCancion ?? []) {
    const uid = inv.usuario_id;
    const txt = typeof inv.cancion === "string" ? inv.cancion.trim() : "";
    if (!uid || !txt || pedidosEnPlaylist.has(uid)) continue;
    await syncCancionPlaylist(db, eventoId, uid, inv.cancion);
    pedidosEnPlaylist.add(uid);
    refetch = true;
  }

  if (refetch) {
    const second = await db
      .from("canciones")
      .select("id, titulo, artista, pedido_por, created_at")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: true });
    if (!second.error && second.data) list = second.data;
  }

  const merged = mergePlaylistRows(
    list.map((r) => ({
      id: r.id,
      titulo: r.titulo ?? "",
      artista: r.artista ?? "",
      created_at: r.created_at,
    }))
  );

  const maxMuestra = 40;
  const muestra = merged.slice(0, maxMuestra).map((m) => ({
    titulo: m.titulo,
    artista: m.artista && m.artista !== "—" ? m.artista : "—",
  }));

  return { total: merged.length, muestra };
}

function resumenCubiertosNoEstandar(b: MenuBuckets): string {
  const p: string[] = [];
  if (b.celiaco) p.push(`${b.celiaco} celíaco/TACC`);
  if (b.vegVeg) p.push(`${b.vegVeg} vegetariano/vegano`);
  if (b.otros) p.push(`${b.otros} otra(s)`);
  return p.join(", ") || "restricción no estándar";
}

function systemBase(tipo: string): string {
  return [
    "Respondés en español rioplatense: pocas frases, directo; sin marketing ni intros largas.",
    "No inventes datos: si algo no está en el contexto JSON ni en la guía de producto del mismo system, decilo y ofrecé la pantalla adecuada.",
    "El system incluye una guía de cómo funciona la app y un bloque JSON con datos en vivo. Prioridad: si preguntan cantidades, confirmados o estado del evento, respondé con datos del JSON; las rutas /anfitrion/… solo si piden explícitamente cómo/dónde hacer algo en la plataforma.",
    `El usuario tiene rol en la plataforma: "${tipo}".`,
  ].join("\n");
}

export async function buildChatRoleContext(
  db: Db,
  userId: string,
  tipo: string
): Promise<{ error: string } | { ok: true; system: string; contextJson: string }> {
  const { data: perfil } = await db
    .from("usuarios")
    .select("nombre, apellido, tipo, salon_nombre, salon_direccion")
    .eq("id", userId)
    .maybeSingle();

  const nombre = [perfil?.nombre, perfil?.apellido].filter(Boolean).join(" ").trim() || "Usuario";
  const salonNombre = (perfil?.salon_nombre ?? "").trim();
  const salonDireccion = (perfil?.salon_direccion ?? "").trim();

  if (tipo === "invitado") {
    const { row: prior, error: priorErr } = await fetchInvitacionPriorizada(db, userId);
    if (priorErr || !prior) {
      return { error: "No tenés una invitación activa para usar el asistente." };
    }

    const { data: inv } = await db
      .from("invitados")
      .select(
        "id, evento_id, mesa_id, asistencia, restriccion_alimentaria, restriccion_otro, rol_smartpool, telefono, smartpool_pareja_invitado_id, smartpool_acepto, smartpool_cupos_max, smartpool_grupo_vehiculo_lleno"
      )
      .eq("id", prior.id)
      .maybeSingle();

    if (!inv) {
      return { error: "No se encontró tu invitación." };
    }

    const { data: evento } = await db
      .from("eventos")
      .select(
        "nombre, tipo, fecha, horario, salon, direccion, dress_code, anfitrion1_nombre, anfitrion2_nombre, menus_especiales"
      )
      .eq("id", inv.evento_id)
      .maybeSingle();

    if (!evento) {
      return { error: "Evento no encontrado." };
    }

    let mesaNumero: number | null = null;
    if (inv.mesa_id) {
      const { data: mesa } = await db.from("mesas").select("numero").eq("id", inv.mesa_id).maybeSingle();
      mesaNumero = mesa?.numero ?? null;
    }

    const fechaLegible = (() => {
      const d = new Date(evento.fecha + "T12:00:00");
      return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    })();

    const menuOpciones = menuOpcionesParaEvento(evento.menus_especiales ?? []);

    const { count: confirmadosEnEvento } = await db
      .from("invitados")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", inv.evento_id)
      .eq("asistencia", "confirmado");

    const smartpoolMatch: Record<string, unknown> = {
      acepto: inv.smartpool_acepto,
      grupo_vehiculo_lleno: inv.smartpool_grupo_vehiculo_lleno ?? false,
      cupos_max: inv.smartpool_cupos_max ?? null,
    };

    /** Pasajero: el vínculo va en su fila (`smartpool_pareja_invitado_id` → conductor). */
    if (inv.smartpool_pareja_invitado_id) {
      const { data: parejaInv } = await db
        .from("invitados")
        .select("usuario_id, rol_smartpool")
        .eq("id", inv.smartpool_pareja_invitado_id)
        .maybeSingle();
      if (parejaInv?.usuario_id) {
        const { data: pu } = await db
          .from("usuarios")
          .select("nombre, apellido")
          .eq("id", parejaInv.usuario_id)
          .maybeSingle();
        const pn = [pu?.nombre, pu?.apellido].filter(Boolean).join(" ").trim();
        if (pn) smartpoolMatch.pareja_nombre = pn;
        if (parejaInv.rol_smartpool) smartpoolMatch.pareja_rol = parejaInv.rol_smartpool;
      }
    }

    /** Conductor: los pasajeros vinculados son filas con `smartpool_pareja_invitado_id` = mi invitación. */
    if (inv.rol_smartpool === "conductor") {
      const { data: paxRows } = await db
        .from("invitados")
        .select("usuario_id, smartpool_acepto")
        .eq("smartpool_pareja_invitado_id", inv.id)
        .order("created_at", { ascending: true });
      const uids = [...new Set((paxRows ?? []).map((r) => r.usuario_id))];
      const { data: usPax } =
        uids.length > 0
          ? await db.from("usuarios").select("id, nombre, apellido").in("id", uids)
          : { data: [] as { id: string; nombre: string | null; apellido: string | null }[] };
      const byUid = Object.fromEntries(
        (usPax ?? []).map((u) => [
          u.id,
          [u.nombre, u.apellido].filter(Boolean).join(" ").trim() || "Invitado/a",
        ])
      );
      smartpoolMatch.pasajeros_vinculados = (paxRows ?? []).map((r) => ({
        nombre: byUid[r.usuario_id] ?? "Invitado/a",
        acepto: !!r.smartpool_acepto,
      }));
    }

    const payload = {
      rolAsistente: "conserje_del_evento",
      invitado: {
        nombre,
        asistencia: inv.asistencia,
        mesa_numero: mesaNumero,
        rol_smartpool: inv.rol_smartpool,
        restriccion_alimentaria: inv.restriccion_alimentaria,
        restriccion_otro: inv.restriccion_otro,
        smartpool_match: smartpoolMatch,
      },
      evento: {
        nombre: evento.nombre,
        tipo: evento.tipo,
        fecha_iso: evento.fecha,
        fecha_legible: fechaLegible,
        horario: evento.horario,
        salon: evento.salon,
        direccion: evento.direccion,
        dress_code: evento.dress_code,
        anfitriones: [evento.anfitrion1_nombre, evento.anfitrion2_nombre].filter(Boolean).join(" y "),
        menus_especiales_evento: evento.menus_especiales ?? [],
        opciones_menu_ui: menuOpciones,
        invitaciones_confirmadas_en_evento_total: confirmadosEnEvento ?? 0,
      },
    };

    const system = [
      systemBase(tipo),
      "Sos el conserje digital del evento: ayudás con horario, ubicación del salón, dress code, opciones de menú según lo permitido, SmartPool/EcoGuest solo como orientación (no garantías operativas).",
      "No des de alta ni modifiques datos en sistemas externos; solo informás según el contexto.",
      "Respondé en tono de chat: breve, natural, en español; no inventes datos fuera del JSON.",
    ].join("\n");

    return { ok: true, system, contextJson: JSON.stringify(payload, null, 0) };
  }

  if (tipo === "anfitrion") {
    const { data: evento } = await db
      .from("eventos")
      .select(
        "id, nombre, tipo, fecha, horario, salon, direccion, cant_invitados, cant_mesas, menus_especiales, dress_code, anfitrion1_nombre, anfitrion2_nombre"
      )
      .eq("anfitrion_id", userId)
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!evento?.id) {
      return { error: "No tenés un evento asignado." };
    }

    if (!eventoCoincideConSalonPerfil(evento, salonNombre, salonDireccion)) {
      return { error: "Tu evento no coincide con el salón de tu perfil. Contactá al administrador." };
    }

    const { data: rows } = await db
      .from("invitados")
      .select("asistencia, usuario_id, restriccion_alimentaria, restriccion_otro, grupo_menus_json")
      .eq("evento_id", evento.id);

    const conteo = { confirmado: 0, pendiente: 0, rechazado: 0 };
    let mergedRest = emptyMenuBuckets();
    type MuestraRest = { usuario_id: string; detalle: string };
    const muestraRest: MuestraRest[] = [];
    let invitacionesConRestriccion = 0;
    for (const r of rows ?? []) {
      const a = r.asistencia;
      if (a === "confirmado") conteo.confirmado++;
      else if (a === "rechazado") conteo.rechazado++;
      else conteo.pendiente++;

      const b = menuBucketsFromInvitado({
        restriccion_alimentaria: r.restriccion_alimentaria,
        restriccion_otro: r.restriccion_otro,
        grupo_menus_json: r.grupo_menus_json,
      });
      mergedRest = mergeMenuBuckets(mergedRest, b);
      const nonStd = b.celiaco + b.vegVeg + b.otros;
      if (nonStd > 0) {
        invitacionesConRestriccion++;
        if (r.usuario_id && muestraRest.length < 22) {
          muestraRest.push({ usuario_id: r.usuario_id, detalle: resumenCubiertosNoEstandar(b) });
        }
      }
    }

    const uidsRest = [...new Set(muestraRest.map((m) => m.usuario_id))];
    let usrsRest: { id: string; nombre: string | null; apellido: string | null }[] = [];
    if (uidsRest.length > 0) {
      const { data } = await db.from("usuarios").select("id, nombre, apellido").in("id", uidsRest.slice(0, 50));
      usrsRest = data ?? [];
    }
    const nombrePorId = new Map(
      usrsRest.map((u) => [
        u.id,
        `${(u.nombre ?? "").trim()} ${(u.apellido ?? "").trim()}`.trim() || "Invitado",
      ])
    );
    const restricciones_muestra_invitaciones = muestraRest.slice(0, 18).map((m) => ({
      nombre: nombrePorId.get(m.usuario_id) ?? "Invitado",
      detalle: m.detalle,
    }));

    const { data: confInvRows } = await db
      .from("invitados")
      .select("usuario_id")
      .eq("evento_id", evento.id)
      .eq("asistencia", "confirmado")
      .limit(80);

    const uidsOrdered = [...new Set((confInvRows ?? []).map((x) => x.usuario_id))];
    let confirmados_nombres_muestra: string[] = [];
    if (uidsOrdered.length > 0) {
      const { data: usrs } = await db
        .from("usuarios")
        .select("id, nombre, apellido")
        .in("id", uidsOrdered.slice(0, 60));
      const byId = new Map(
        (usrs ?? []).map((u) => [
          u.id,
          `${(u.nombre ?? "").trim()} ${(u.apellido ?? "").trim()}`.trim() || "Invitado",
        ])
      );
      for (const uid of uidsOrdered) {
        const label = byId.get(uid) ?? "Invitado";
        confirmados_nombres_muestra.push(label);
        if (confirmados_nombres_muestra.length >= 22) break;
      }
      confirmados_nombres_muestra = [...new Set(confirmados_nombres_muestra)].slice(0, 20);
    }

    const fechaLegible = new Date(evento.fecha + "T12:00:00").toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const menuOpcionesAnfitrion = menuOpcionesParaEvento(evento.menus_especiales ?? []);

    const playlistResumen = await playlistResumenParaEventoAnfitrion(db, evento.id);

    const payload = {
      rolAsistente: "asistente_anfitrion",
      anfitrion: { nombre },
      evento: {
        id: evento.id,
        nombre: evento.nombre,
        tipo: evento.tipo,
        fecha_iso: evento.fecha,
        fecha_legible: fechaLegible,
        horario: evento.horario,
        salon: evento.salon,
        direccion: evento.direccion,
        cant_invitados_cupo: evento.cant_invitados,
        cant_mesas: evento.cant_mesas,
        dress_code: evento.dress_code,
        anfitriones: [evento.anfitrion1_nombre, evento.anfitrion2_nombre].filter(Boolean).join(" y "),
        menus_especiales: evento.menus_especiales ?? [],
        opciones_menu_ui: menuOpcionesAnfitrion,
        invitaciones_totales: rows?.length ?? 0,
        invitaciones_por_asistencia: conteo,
        confirmados_nombres_muestra,
        restricciones_cubiertos: {
          estandar: mergedRest.standard,
          celiaco: mergedRest.celiaco,
          vegetariano_o_vegano: mergedRest.vegVeg,
          otras: mergedRest.otros,
        },
        restricciones_invitaciones_con_no_estandar: invitacionesConRestriccion,
        restricciones_muestra_invitaciones,
        playlist_resumen: playlistResumen,
      },
      secciones_app: [
        "Resumen: /anfitrion",
        "Invitados e importación: /anfitrion/invitados",
        "Menús / restricciones vista invitado: /anfitrion/restricciones",
        "SmartSeat (mesas): /anfitrion/smartseat",
        "EcoGuests / SmartPool: /anfitrion/ecoguests",
        "Playlist: /anfitrion/playlist",
        "Tu cuenta: /anfitrion/configuracion",
      ],
    };

    const system = [
      systemBase(tipo),
      "Asistente del anfitrión: estado del evento, números de asistencia, restricciones por cubierto y guía breve de SmartGuest (no ejecutás acciones por él).",
      "Las cifras y nombres de muestra vienen del contexto JSON; si no están, decilo con claridad.",
      "Tono chat: mínimas palabras, solo lo pedido.",
    ].join("\n");

    return { ok: true, system, contextJson: JSON.stringify(payload, null, 0) };
  }

  if (tipo === "administrador") {
    if (!salonNombre || !salonDireccion) {
      return {
        error:
          "Completá nombre y dirección del salón en Configuración para usar el asistente con datos del local.",
      };
    }

    const enrichment = await buildAdminSalonChatEnrichment(db, userId, salonNombre, salonDireccion);

    const payload = {
      rolAsistente: "asistente_administrador_salon",
      administrador: { nombre, salon: salonNombre, direccion: salonDireccion },
      eventos_en_salon: enrichment.eventos_en_salon,
      admin_metricas: enrichment.admin_metricas,
      admin_cocina_resumen: enrichment.admin_cocina_resumen,
      admin_reuniones: enrichment.admin_reuniones,
      secciones_app: [
        "Panel y eventos: /admin",
        "Usuarios del salón: /admin/usuarios",
        "Reporte cocina: /admin/cocina",
        "Ingresos: /admin/ingresos",
        "Configuración del salón: /admin/configuracion",
      ],
    };

    const system = [
      systemBase(tipo),
      "Asistente del admin del salón: respuestas cortas; eventos, usuarios, cocina, ingresos — solo datos del local del contexto.",
      "No inventés políticas del negocio del cliente; limitate a la plataforma SmartGuest.",
    ].join("\n");

    return { ok: true, system, contextJson: JSON.stringify(payload, null, 0) };
  }

  const payload = {
    rolAsistente: "asistente_general",
    usuario: { nombre, tipo },
    salon_en_perfil: salonNombre ? { nombre: salonNombre, direccion: salonDireccion } : null,
    orientacion: {
      jefe_cocina: "Reporte y detalle de mesas en /cocina; cuenta en /cocina/configuracion.",
      seguridad: "Validación de ingreso con la app de seguridad y escaneo de QR del invitado.",
      invitado: "Portal en /invitado.",
    },
  };

  const system = [
    systemBase(tipo),
    "Sos asistente SmartGuest: respuestas cortas; guía la sección que toca y que los datos los ve en el panel.",
  ].join("\n");

  return { ok: true, system, contextJson: JSON.stringify(payload, null, 0) };
}
