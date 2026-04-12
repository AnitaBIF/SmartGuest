import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { clampCuposMax, menuOpcionesParaEvento, plazasSmartpoolPasajeros } from "@/lib/grupoFamiliar";
import {
  generateImportDni,
  generateSyntheticEmail,
  normalizeDniInput,
  splitNombreCompleto,
} from "@/lib/invitadosImport";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getSessionUser(req: NextRequest) {
  const response = NextResponse.next();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(c) {
          c.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  return user;
}

export type GuestInput = {
  nombreCompleto: string;
  celular: string;
  grupo: string;
  rangoEtario: string;
  dni?: string | null;
  email?: string | null;
  /** Cupos del grupo familiar para la invitación (1–20). Por defecto 4. */
  grupoCuposMax?: number;
  rowNumber?: number;
};

const INV_ROW_BASE = {
  asistencia: "pendiente" as const,
  grupo_cupos_max: 1,
};

const SYNTHETIC_EMAIL_SUFFIX = "@import.smartguest.app";

type InvitadoInsert = Database["public"]["Tables"]["invitados"]["Insert"];

async function insertInvitadoPendiente(
  supabase: ReturnType<typeof adminClient>,
  row: {
    usuario_id: string;
    evento_id: string;
    grupo: string;
    rango_etario: string;
    telefono: string;
    grupo_cupos_max?: number;
  }
) {
  const n = clampCuposMax(row.grupo_cupos_max, INV_ROW_BASE.grupo_cupos_max);
  const full = {
    ...INV_ROW_BASE,
    ...row,
    grupo_cupos_max: n,
    smartpool_cupos_max: plazasSmartpoolPasajeros(n),
  };
  let { error } = await supabase.from("invitados").insert(full as InvitadoInsert);
  if (error && error.message.toLowerCase().includes("telefono")) {
    const { telefono: _t, ...rest } = full;
    const second = await supabase.from("invitados").insert(rest as InvitadoInsert);
    error = second.error;
  }
  return error;
}

async function getAnfitrionEvento(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data: me } = await supabase
    .from("usuarios")
    .select("tipo")
    .eq("id", userId)
    .single();
  if (me?.tipo !== "anfitrion") return null;

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, cant_invitados, menus_especiales")
    .eq("anfitrion_id", userId)
    .order("fecha", { ascending: false })
    .limit(1)
    .single();

  if (!evento?.id) return null;
  return {
    id: evento.id,
    cantInvitados: evento.cant_invitados ?? 0,
    menus_especiales: evento.menus_especiales ?? [],
  };
}

async function addInvitedGuest(
  supabase: ReturnType<typeof adminClient>,
  eventoId: string,
  input: GuestInput
): Promise<{ ok: true } | { ok: false; message: string }> {
  const nombreCompleto = input.nombreCompleto.trim();
  const celular = input.celular.trim();
  const grupo = input.grupo.trim();
  const rangoEtario = input.rangoEtario.trim();
  const grupoCuposMax = clampCuposMax(input.grupoCuposMax, 1);
  if (!nombreCompleto || !celular || !grupo || !rangoEtario) {
    return { ok: false, message: "Faltan datos obligatorios." };
  }

  let dni = normalizeDniInput(input.dni);
  if (!dni) dni = generateImportDni();

  const emailInput = input.email?.trim();
  const emailLower = emailInput ? emailInput.toLowerCase() : null;

  if (emailLower) {
    const { data: byEmail } = await supabase
      .from("usuarios")
      .select("id")
      .eq("email", emailLower)
      .maybeSingle();
    if (byEmail) {
      const { data: dupeInv } = await supabase
        .from("invitados")
        .select("id")
        .eq("usuario_id", byEmail.id)
        .eq("evento_id", eventoId)
        .maybeSingle();
      if (dupeInv) return { ok: false, message: "Este email ya está en el evento." };
      const insErr = await insertInvitadoPendiente(supabase, {
        usuario_id: byEmail.id,
        evento_id: eventoId,
        grupo,
        rango_etario: rangoEtario,
        telefono: celular,
        grupo_cupos_max: grupoCuposMax,
      });
      if (insErr) return { ok: false, message: insErr.message };
      return { ok: true };
    }
  }

  const { data: byDni } = await supabase.from("usuarios").select("id").eq("dni", dni).maybeSingle();
  if (byDni) {
    const { data: dupeInv } = await supabase
      .from("invitados")
      .select("id")
      .eq("usuario_id", byDni.id)
      .eq("evento_id", eventoId)
      .maybeSingle();
    if (dupeInv) return { ok: false, message: "Ya está agregado a este evento (DNI duplicado)." };
    const insErr = await insertInvitadoPendiente(supabase, {
      usuario_id: byDni.id,
      evento_id: eventoId,
      grupo,
      rango_etario: rangoEtario,
      telefono: celular,
      grupo_cupos_max: grupoCuposMax,
    });
    if (insErr) return { ok: false, message: insErr.message };
    return { ok: true };
  }

  const email = emailLower ?? generateSyntheticEmail();
  const { nombre, apellido } = splitNombreCompleto(nombreCompleto);
  const password = randomBytes(18).toString("base64url");

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre,
      apellido,
      dni,
      tipo: "invitado",
    },
  });

  if (authError || !authData.user) {
    return { ok: false, message: authError?.message ?? "No se pudo crear el usuario." };
  }

  const userId = authData.user.id;

  await supabase.from("usuarios").update({ dni, nombre, apellido }).eq("id", userId);

  const invErr = await insertInvitadoPendiente(supabase, {
    usuario_id: userId,
    evento_id: eventoId,
    grupo,
    rango_etario: rangoEtario,
    telefono: celular,
    grupo_cupos_max: grupoCuposMax,
  });

  if (invErr) {
    await supabase.auth.admin.deleteUser(userId);
    return { ok: false, message: invErr.message };
  }

  return { ok: true };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = adminClient();
  const evento = await getAnfitrionEvento(supabase, user.id);
  if (!evento) {
    return NextResponse.json({ error: "No tenés un evento asignado" }, { status: 404 });
  }
  const eventoId = evento.id;

  const selectWithPhone =
    "id, usuario_id, asistencia, restriccion_alimentaria, restriccion_otro, grupo, rango_etario, telefono, rol_smartpool, grupo_cupos_max" as const;
  const selectNoPhone =
    "id, usuario_id, asistencia, restriccion_alimentaria, restriccion_otro, grupo, rango_etario, rol_smartpool, grupo_cupos_max" as const;

  let first = await supabase
    .from("invitados")
    .select(selectWithPhone)
    .eq("evento_id", eventoId)
    .order("created_at", { ascending: true });

  let invsList = first.data;
  let invErr = first.error;

  if (invErr?.message?.toLowerCase().includes("telefono")) {
    const retry = await supabase
      .from("invitados")
      .select(selectNoPhone)
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: true });
    invsList = retry.data as typeof invsList;
    invErr = retry.error;
  }

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });

  const rows = invsList ?? [];

  const userIds = [...new Set(rows.map((i) => i.usuario_id))];
  let userMap: Record<
    string,
    { nombre: string; apellido: string; dni: string; email: string }
  > = {};

  if (userIds.length > 0) {
    const { data: usrs } = await supabase
      .from("usuarios")
      .select("id, nombre, apellido, dni, email")
      .in("id", userIds);
    if (usrs) {
      userMap = Object.fromEntries(
        usrs.map((u) => [
          u.id,
          { nombre: u.nombre, apellido: u.apellido, dni: u.dni, email: u.email },
        ])
      );
    }
  }

  const invitados = rows.map((inv) => {
    const u = userMap[inv.usuario_id];
    const nombre = `${u?.nombre ?? ""} ${u?.apellido ?? ""}`.trim() || "—";
    let asistencia: "Pendiente" | "Asiste" | "No asiste" = "Pendiente";
    if (inv.asistencia === "confirmado") asistencia = "Asiste";
    else if (inv.asistencia === "rechazado") asistencia = "No asiste";

    const eco =
      inv.rol_smartpool && inv.rol_smartpool !== "no" ? ("Sí" as const) : ("No" as const);
    let restriccion = "-";
    let restriccionSelect = "Ninguna";
    let restriccionOtro = "";
    if (inv.restriccion_alimentaria) {
      if (inv.restriccion_alimentaria === "otro") {
        restriccionSelect = "Otro";
        restriccionOtro = inv.restriccion_otro?.trim() ?? "";
        restriccion = restriccionOtro || "Otro";
      } else {
        restriccionSelect = inv.restriccion_alimentaria;
        restriccion = inv.restriccion_alimentaria;
      }
    }

    return {
      id: inv.id,
      usuarioId: inv.usuario_id,
      nombre,
      dni: u?.dni ?? "—",
      email: u?.email ?? "",
      telefono: inv.telefono ?? "",
      asistencia,
      grupo: inv.grupo ?? "—",
      rango: inv.rango_etario ?? "—",
      restriccion,
      restriccionSelect,
      restriccionOtro,
      eco,
      rolSmartpool: inv.rol_smartpool ?? null,
      grupoCuposMax: clampCuposMax((inv as { grupo_cupos_max?: number }).grupo_cupos_max, 1),
    };
  });

  const menuOpciones = menuOpcionesParaEvento(evento.menus_especiales);

  return NextResponse.json({ invitados, menuOpciones });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json();
  const guests = body.guests as GuestInput[] | undefined;
  if (!Array.isArray(guests) || guests.length === 0) {
    return NextResponse.json({ error: "Enviá al menos un invitado en «guests»." }, { status: 400 });
  }
  if (guests.length > 200) {
    return NextResponse.json({ error: "Máximo 200 filas por importación." }, { status: 400 });
  }

  const supabase = adminClient();
  const evento = await getAnfitrionEvento(supabase, user.id);
  if (!evento) {
    return NextResponse.json({ error: "No tenés un evento asignado" }, { status: 404 });
  }

  const limite = evento.cantInvitados;
  if (limite > 0) {
    const { count, error: countErr } = await supabase
      .from("invitados")
      .select("*", { count: "exact", head: true })
      .eq("evento_id", evento.id);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    const actuales = count ?? 0;
    if (actuales + guests.length > limite) {
      return NextResponse.json(
        {
          error: `El evento admite hasta ${limite} invitados. Ya hay ${actuales} en la lista; esta carga suma ${guests.length} (${actuales + guests.length} en total). Reducí filas o pedí aumentar la capacidad.`,
        },
        { status: 400 }
      );
    }
  }

  const eventoId = evento.id;
  const errors: { row?: number; message: string }[] = [];
  let created = 0;

  const CONCURRENCY = 5;
  for (let i = 0; i < guests.length; i += CONCURRENCY) {
    const chunk = guests.slice(i, i + CONCURRENCY);
    const outcomes = await Promise.all(
      chunk.map((g) => addInvitedGuest(supabase, eventoId, g))
    );
    for (let j = 0; j < outcomes.length; j++) {
      const res = outcomes[j]!;
      const g = chunk[j]!;
      if (res.ok) created++;
      else errors.push({ row: g.rowNumber, message: res.message });
    }
  }

  return NextResponse.json({ created, errors, total: guests.length });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = adminClient();
  const evento = await getAnfitrionEvento(supabase, user.id);
  if (!evento) {
    return NextResponse.json({ error: "No tenés un evento asignado" }, { status: 404 });
  }

  const { data: rows, error: selErr } = await supabase
    .from("invitados")
    .select("id, usuario_id")
    .eq("evento_id", evento.id);

  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 500 });

  const list = rows ?? [];
  if (list.length === 0) {
    return NextResponse.json({ deleted: 0 });
  }

  const usuarioIds = [...new Set(list.map((r) => r.usuario_id))];

  const { error: delErr } = await supabase.from("invitados").delete().eq("evento_id", evento.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  for (const usuarioId of usuarioIds) {
    const { data: rest } = await supabase
      .from("invitados")
      .select("id")
      .eq("usuario_id", usuarioId)
      .limit(1);

    if (rest && rest.length > 0) continue;

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("email")
      .eq("id", usuarioId)
      .maybeSingle();

    const email = usuario?.email ?? "";
    if (email.endsWith(SYNTHETIC_EMAIL_SUFFIX)) {
      await supabase.auth.admin.deleteUser(usuarioId);
    }
  }

  return NextResponse.json({ deleted: list.length });
}
