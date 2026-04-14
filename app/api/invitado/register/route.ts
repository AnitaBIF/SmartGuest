import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import {
  clampCuposMax,
  clampPersonasConfirmadas,
  legacyRestriccionFromMenus,
  menuOpcionesParaEvento,
  menusGrupoValidos,
  plazasSmartpoolPasajeros,
} from "@/lib/grupoFamiliar";
import { syncCancionPlaylist } from "@/lib/cancionPlaylistSync";
import { normalizeDniInput } from "@/lib/invitadosImport";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

type InvitadoInsert = Database["public"]["Tables"]["invitados"]["Insert"];
type InvitadoUpdate = Database["public"]["Tables"]["invitados"]["Update"];
type UsuarioUpdate = Database["public"]["Tables"]["usuarios"]["Update"];

async function buildInvitadoUpdatePayload(
  supabase: ReturnType<typeof adminClient>,
  args: {
    asiste: boolean;
    invitado_id: string | null;
    grupoPersonasConfirmadas: unknown;
    menusGrupo: unknown;
    direccion: unknown;
    localidad: unknown;
    cancion: unknown;
    menuOpcionesPermitidas: readonly string[];
  }
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; error: string }> {
  const {
    asiste,
    invitado_id,
    grupoPersonasConfirmadas,
    menusGrupo,
    direccion,
    localidad,
    cancion,
    menuOpcionesPermitidas,
  } = args;
  const base = {
    asistencia: asiste ? ("confirmado" as const) : ("rechazado" as const),
    cancion: (typeof cancion === "string" && cancion.trim()) || null,
    direccion: (typeof direccion === "string" && direccion.trim()) || null,
    localidad: (typeof localidad === "string" && localidad.trim()) || null,
  };
  if (!asiste) {
    return {
      ok: true,
      payload: {
        ...base,
        grupo_personas_confirmadas: null,
        grupo_menus_json: [],
        smartpool_grupo_vehiculo_lleno: false,
        smartpool_cupos_max: 0,
        restriccion_alimentaria: null,
        restriccion_otro: null,
      },
    };
  }
  let cuposMax = 1;
  if (invitado_id) {
    const { data: meta } = await supabase
      .from("invitados")
      .select("grupo_cupos_max")
      .eq("id", invitado_id)
      .maybeSingle();
    cuposMax = clampCuposMax(meta?.grupo_cupos_max, 1);
  }
  const personas = clampPersonasConfirmadas(grupoPersonasConfirmadas, cuposMax);
  const parsed = menusGrupoValidos(menusGrupo, personas, menuOpcionesPermitidas);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const poolSlots = plazasSmartpoolPasajeros(cuposMax);
  const leg = legacyRestriccionFromMenus(parsed.value);
  return {
    ok: true,
    payload: {
      ...base,
      grupo_personas_confirmadas: personas,
      grupo_menus_json: parsed.value,
      smartpool_grupo_vehiculo_lleno: false,
      smartpool_cupos_max: poolSlots,
      restriccion_alimentaria: leg.restriccion_alimentaria,
      restriccion_otro: leg.restriccion_otro,
    },
  };
}

/** true si otro usuario (fuera de exceptIds) ya tiene este DNI exacto en usuarios.dni */
async function dniTomadoPorOtro(
  supabase: ReturnType<typeof adminClient>,
  dniVal: string,
  exceptIds: string[]
): Promise<boolean> {
  if (!dniVal) return false;
  const { data: row } = await supabase.from("usuarios").select("id").eq("dni", dniVal).maybeSingle();
  if (!row) return false;
  return !exceptIds.includes(row.id);
}

async function deleteAuthUserIfOrphaned(
  supabase: ReturnType<typeof adminClient>,
  userId: string
) {
  const { count, error } = await supabase
    .from("invitados")
    .select("*", { count: "exact", head: true })
    .eq("usuario_id", userId);
  if (error) return;
  if ((count ?? 0) > 0) return;
  await supabase.auth.admin.deleteUser(userId);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    evento_id,
    invitado_id: invitadoIdRaw,
    nombre,
    dni,
    email,
    password,
    direccion,
    localidad,
    cancion,
    asiste,
    grupoPersonasConfirmadas,
    menusGrupo,
  } = body;

  const invitado_id = typeof invitadoIdRaw === "string" && invitadoIdRaw.length > 0 ? invitadoIdRaw : null;

  const supabase = adminClient();

  /** Declinación RSVP: solo `evento_id` + `invitado_id`, sin cuenta ni DNI. */
  if (asiste === false) {
    if (!evento_id || !invitado_id) {
      return NextResponse.json(
        {
          error:
            "Para avisar que no asistís necesitás el enlace personal de tu invitación. Si abriste un link genérico al evento, pedile al anfitrión tu invitación individual.",
        },
        { status: 400 }
      );
    }

    const { data: ev, error: evErr } = await supabase.from("eventos").select("id").eq("id", evento_id).maybeSingle();
    if (evErr || !ev) {
      return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
    }

    const { data: invDecl, error: invDeclErr } = await supabase
      .from("invitados")
      .select("id, usuario_id, evento_id, asistencia")
      .eq("id", invitado_id)
      .maybeSingle();

    if (invDeclErr || !invDecl) {
      return NextResponse.json({ error: "Invitación no válida." }, { status: 404 });
    }
    if (invDecl.evento_id !== evento_id) {
      return NextResponse.json({ error: "El enlace no corresponde a este evento." }, { status: 400 });
    }
    if (invDecl.asistencia !== "pendiente") {
      return NextResponse.json({ error: "Esta invitación ya fue respondida." }, { status: 409 });
    }
    if (!invDecl.usuario_id) {
      return NextResponse.json({ error: "Invitación no válida." }, { status: 404 });
    }

    const builtDecline = await buildInvitadoUpdatePayload(supabase, {
      asiste: false,
      invitado_id,
      grupoPersonasConfirmadas: null,
      menusGrupo: null,
      direccion: null,
      localidad: null,
      cancion: null,
      menuOpcionesPermitidas: [],
    });
    if (!builtDecline.ok) {
      return NextResponse.json({ error: builtDecline.error }, { status: 400 });
    }

    const declinePayload = { ...builtDecline.payload, cancion: null } as InvitadoUpdate;

    const { error: declineUpErr } = await supabase
      .from("invitados")
      .update(declinePayload)
      .eq("id", invitado_id);

    if (declineUpErr) {
      return NextResponse.json({ error: declineUpErr.message }, { status: 500 });
    }

    await syncCancionPlaylist(supabase, evento_id, invDecl.usuario_id, null);
    return NextResponse.json({ ok: true });
  }

  if (!evento_id || !email || !password || !nombre) {
    return NextResponse.json({ error: "Faltan campos obligatorios." }, { status: 400 });
  }

  if (Boolean(asiste)) {
    const dir = typeof direccion === "string" ? direccion.trim() : "";
    const loc = typeof localidad === "string" ? localidad.trim() : "";
    if (!dir || !loc) {
      return NextResponse.json(
        { error: "La dirección y la localidad son obligatorias al confirmar asistencia." },
        { status: 400 },
      );
    }
  }

  const { data: evento, error: evError } = await supabase
    .from("eventos")
    .select("id, menus_especiales")
    .eq("id", evento_id)
    .single();

  if (evError || !evento) {
    return NextResponse.json({ error: "Evento no encontrado." }, { status: 404 });
  }

  const menuOpcionesPermitidas = menuOpcionesParaEvento(evento.menus_especiales);

  let invitadoUsuarioId: string | null = null;
  if (invitado_id) {
    const { data: invRow, error: invErr } = await supabase
      .from("invitados")
      .select("id, usuario_id, evento_id, asistencia")
      .eq("id", invitado_id)
      .maybeSingle();

    if (invErr || !invRow) {
      return NextResponse.json({ error: "Invitación no válida." }, { status: 404 });
    }
    if (invRow.evento_id !== evento_id) {
      return NextResponse.json({ error: "El enlace no corresponde a este evento." }, { status: 400 });
    }
    if (invRow.asistencia !== "pendiente") {
      return NextResponse.json({ error: "Esta invitación ya fue respondida." }, { status: 409 });
    }
    invitadoUsuarioId = invRow.usuario_id;
  }

  const parts = nombre.trim().split(/\s+/);
  const firstName = parts.slice(0, -1).join(" ") || parts[0];
  const lastName = parts.length > 1 ? parts[parts.length - 1] : "";

  const builtPayload = await buildInvitadoUpdatePayload(supabase, {
    asiste: Boolean(asiste),
    invitado_id,
    grupoPersonasConfirmadas,
    menusGrupo,
    direccion,
    localidad,
    cancion,
    menuOpcionesPermitidas,
  });
  if (!builtPayload.ok) {
    return NextResponse.json({ error: builtPayload.error }, { status: 400 });
  }
  const invPayload = builtPayload.payload;

  const dniStored = normalizeDniInput(dni) || String(dni ?? "").trim();

  const { data: existingUsers } = await supabase.from("usuarios").select("id").eq("email", String(email).trim()).limit(1);

  if (existingUsers && existingUsers.length > 0) {
    const userId = existingUsers[0].id;

    const { data: existingInv } = await supabase
      .from("invitados")
      .select("id")
      .eq("usuario_id", userId)
      .eq("evento_id", evento_id)
      .maybeSingle();

    if (existingInv && (!invitado_id || existingInv.id !== invitado_id)) {
      return NextResponse.json(
        { error: "Este email ya tiene una invitación registrada en este evento." },
        { status: 409 }
      );
    }

    if (invitado_id) {
      if (!dniStored) {
        return NextResponse.json({ error: "El DNI es obligatorio para confirmar." }, { status: 400 });
      }

      const { data: invBefore } = await supabase
        .from("invitados")
        .select("usuario_id")
        .eq("id", invitado_id)
        .single();

      const oldUid = invBefore?.usuario_id;
      if (!oldUid) {
        return NextResponse.json({ error: "Invitación no válida." }, { status: 404 });
      }

      if (oldUid !== userId) {
        const { data: dupe } = await supabase
          .from("invitados")
          .select("id")
          .eq("evento_id", evento_id)
          .eq("usuario_id", userId)
          .neq("id", invitado_id)
          .maybeSingle();
        if (dupe) {
          return NextResponse.json(
            { error: "Este email ya tiene una invitación registrada en este evento." },
            { status: 409 }
          );
        }
      }

      if (dniStored && (await dniTomadoPorOtro(supabase, dniStored, [userId]))) {
        return NextResponse.json(
          {
            error:
              "Este DNI ya está registrado en otra cuenta. Iniciá sesión con el email de esa cuenta o consultá al organizador.",
          },
          { status: 409 }
        );
      }

      const { error: upErr } = await supabase
        .from("invitados")
        .update({
          ...invPayload,
          usuario_id: userId,
        } as InvitadoUpdate)
        .eq("id", invitado_id);

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }

      await supabase
        .from("usuarios")
        .update({ nombre: firstName, apellido: lastName, dni: dniStored } as UsuarioUpdate)
        .eq("id", userId);

      if (oldUid !== userId) {
        await deleteAuthUserIfOrphaned(supabase, oldUid);
      }

      if (invPayload.asistencia === "confirmado") {
        await syncCancionPlaylist(
          supabase,
          evento_id,
          userId,
          typeof invPayload.cancion === "string" ? invPayload.cancion : null
        );
      } else {
        await syncCancionPlaylist(supabase, evento_id, userId, null);
      }

      return NextResponse.json({ id: userId, existing: true });
    }

    const { error: invError } = await supabase.from("invitados").insert({
      usuario_id: userId,
      evento_id,
      ...invPayload,
    } as InvitadoInsert);

    if (invError) {
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }

    return NextResponse.json({ id: userId, existing: true });
  }

  if (!dniStored) {
    return NextResponse.json({ error: "El DNI es obligatorio para confirmar." }, { status: 400 });
  }

  const exceptDniIds = invitadoUsuarioId ? [invitadoUsuarioId] : [];
  if (await dniTomadoPorOtro(supabase, dniStored, exceptDniIds)) {
    return NextResponse.json(
      {
        error:
          "Ya existe una cuenta con este DNI. Si ya te registraste antes, iniciá sesión con ese email; si no, pedí ayuda al organizador.",
      },
      { status: 409 }
    );
  }

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: String(email).trim(),
    password,
    email_confirm: true,
    user_metadata: {
      nombre: firstName,
      apellido: lastName,
      dni: dniStored,
      tipo: "invitado",
    },
  });

  if (authError || !authData.user) {
    let msg = authError?.message ?? "Error al crear cuenta.";
    if (/database error/i.test(msg)) {
      msg =
        "No se pudo crear la cuenta (suele ocurrir si el DNI o el email ya existen en el sistema). Si ya tenés usuario, iniciá sesión con ese email; si el problema sigue, contactá al organizador.";
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const userId = authData.user.id;

  await supabase
    .from("usuarios")
    .update({ nombre: firstName, apellido: lastName, dni: dniStored } as UsuarioUpdate)
    .eq("id", userId);

  if (invitado_id) {
    const { data: invBefore } = await supabase
      .from("invitados")
      .select("usuario_id")
      .eq("id", invitado_id)
      .single();

    const oldUid = invBefore?.usuario_id;
    if (!oldUid) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: "Invitación no válida." }, { status: 404 });
    }

    const { data: dupe } = await supabase
      .from("invitados")
      .select("id")
      .eq("evento_id", evento_id)
      .eq("usuario_id", userId)
      .neq("id", invitado_id)
      .maybeSingle();
    if (dupe) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { error: "Ya existe una invitación con esta cuenta en el evento." },
        { status: 409 }
      );
    }

    const { error: upErr } = await supabase
      .from("invitados")
      .update({
        ...invPayload,
        usuario_id: userId,
      } as InvitadoUpdate)
      .eq("id", invitado_id);

    if (upErr) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    if (oldUid !== userId) {
      await deleteAuthUserIfOrphaned(supabase, oldUid);
    }
  } else {
    const { error: invError } = await supabase.from("invitados").insert({
      usuario_id: userId,
      evento_id,
      ...invPayload,
    } as InvitadoInsert);

    if (invError) {
      await supabase.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: invError.message }, { status: 500 });
    }
  }

  if (invPayload.asistencia === "confirmado") {
    await syncCancionPlaylist(
      supabase,
      evento_id,
      userId,
      typeof invPayload.cancion === "string" ? invPayload.cancion : null
    );
  } else {
    await syncCancionPlaylist(supabase, evento_id, userId, null);
  }

  return NextResponse.json({ id: userId }, { status: 201 });
}
