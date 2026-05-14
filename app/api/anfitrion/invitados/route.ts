import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import {
  clampCuposMax,
  menuOpcionesParaEvento,
  plazasSmartpoolPasajeros,
  plazasSmartseatPorInvitado,
} from "@/lib/grupoFamiliar";
import {
  generateImportDni,
  generateSyntheticEmail,
  normalizeDniInput,
  splitNombreCompleto,
} from "@/lib/invitadosImport";
import { eventoCoincideConSalonPerfil } from "@/lib/adminSalonAuth";

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

async function getAnfitrionEvento(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data: me } = await supabase
    .from("usuarios")
    .select("tipo, salon_nombre, salon_direccion")
    .eq("id", userId)
    .single();
  if (me?.tipo !== "anfitrion") return null;

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, cant_invitados, menus_especiales, salon, direccion")
    .eq("anfitrion_id", userId)
    .order("fecha", { ascending: false })
    .limit(1)
    .single();

  if (!evento?.id) return null;
  if (!eventoCoincideConSalonPerfil(evento, me.salon_nombre ?? "", me.salon_direccion ?? "")) {
    return null;
  }
  return {
    id: evento.id,
    cantInvitados: evento.cant_invitados ?? 0,
    menus_especiales: evento.menus_especiales ?? [],
  };
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
    "id, usuario_id, asistencia, restriccion_alimentaria, restriccion_otro, grupo, rango_etario, telefono, rol_smartpool, grupo_cupos_max, grupo_personas_confirmadas" as const;
  const selectNoPhone =
    "id, usuario_id, asistencia, restriccion_alimentaria, restriccion_otro, grupo, rango_etario, rol_smartpool, grupo_cupos_max, grupo_personas_confirmadas" as const;

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

    const personasGrupo = plazasSmartseatPorInvitado({
      asistencia: inv.asistencia ?? "pendiente",
      grupo_cupos_max: (inv as { grupo_cupos_max?: number | null }).grupo_cupos_max,
      grupo_personas_confirmadas: (inv as { grupo_personas_confirmadas?: number | null })
        .grupo_personas_confirmadas,
    });
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
      personasGrupo,
    };
  });

  const menuOpciones = menuOpcionesParaEvento(evento.menus_especiales);

  return NextResponse.json(
    { invitados, menuOpciones },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

/**
 * Importación masiva de invitados optimizada.
 *
 * En lugar de procesar fila por fila (que hacía 4 queries secuenciales por
 * invitado + crear cuenta auth + insert), agrupamos las operaciones:
 *
 *  1. Validamos y normalizamos en memoria (sin tocar la DB).
 *  2. Bulk lookup: una query a `usuarios` por email y otra por DNI para
 *     todos los invitados a la vez.
 *  3. Bulk lookup: una query a `invitados` para detectar duplicados en el
 *     evento.
 *  4. Para los que necesitan cuenta nueva (la mayoría en imports masivos),
 *     creamos cuentas auth en paralelo con concurrencia alta. Esa es la
 *     parte más lenta de Supabase (≈ 300–800 ms cada una) y nada se puede
 *     hacer en bulk a nivel API.
 *  5. Bulk update de `usuarios` para asentar dni/nombre/apellido.
 *  6. Bulk insert en `invitados` (con fallback sin columna `telefono` para
 *     compatibilidad con bases que aún no la tengan).
 *
 * Resultado típico: 100 invitados pasan de ~3 min a ~15–25 s.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido. Envía JSON válido." }, { status: 400 });
  }
  const guests = (body as { guests?: GuestInput[] }).guests;
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

  const eventoId = evento.id;
  const errors: { row?: number; message: string }[] = [];

  /* ────────────────── 1. Validación y normalización en memoria ────────────────── */

  type Pending = {
    rowNumber?: number;
    nombreCompleto: string;
    celular: string;
    grupo: string;
    rangoEtario: string;
    grupoCuposMax: number;
    emailFinal: string;
    dniFinal: string;
    emailProvided: boolean;
  };

  const validas: Pending[] = [];
  for (const g of guests) {
    const nombreCompleto = (g.nombreCompleto ?? "").trim();
    const celular = (g.celular ?? "").trim();
    const grupo = (g.grupo ?? "").trim();
    const rangoEtario = (g.rangoEtario ?? "").trim();
    if (!nombreCompleto || !celular || !grupo || !rangoEtario) {
      errors.push({ row: g.rowNumber, message: "Faltan datos obligatorios." });
      continue;
    }

    let dni = normalizeDniInput(g.dni);
    if (!dni) dni = generateImportDni();

    const emailInput = g.email?.trim();
    const emailLower = emailInput ? emailInput.toLowerCase() : null;

    validas.push({
      rowNumber: g.rowNumber,
      nombreCompleto,
      celular,
      grupo,
      rangoEtario,
      grupoCuposMax: clampCuposMax(g.grupoCuposMax, 1),
      emailFinal: emailLower ?? generateSyntheticEmail(),
      dniFinal: dni,
      emailProvided: emailLower !== null,
    });
  }

  if (validas.length === 0) {
    return NextResponse.json({ created: 0, errors, total: guests.length });
  }

  /* ────────────────── 2. Validación de capacidad del evento ────────────────── */

  const limite = evento.cantInvitados;
  if (limite > 0) {
    const { count, error: countErr } = await supabase
      .from("invitados")
      .select("*", { count: "exact", head: true })
      .eq("evento_id", eventoId);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }
    const actuales = count ?? 0;
    if (actuales + validas.length > limite) {
      return NextResponse.json(
        {
          error: `El evento admite hasta ${limite} invitados. Ya hay ${actuales} en la lista; esta carga suma ${validas.length} (${actuales + validas.length} en total). Reducí filas o pedí aumentar la capacidad.`,
        },
        { status: 400 },
      );
    }
  }

  /* ────────────────── 3. Bulk lookup: usuarios existentes por email/dni ────────────────── */

  const emailsProvidos = Array.from(
    new Set(validas.filter((v) => v.emailProvided).map((v) => v.emailFinal)),
  );
  const dnisTodos = Array.from(new Set(validas.map((v) => v.dniFinal)));

  const [byEmailRes, byDniRes] = await Promise.all([
    emailsProvidos.length > 0
      ? supabase.from("usuarios").select("id, email").in("email", emailsProvidos)
      : Promise.resolve({ data: [] as { id: string; email: string }[], error: null as null | { message: string } }),
    dnisTodos.length > 0
      ? supabase.from("usuarios").select("id, dni").in("dni", dnisTodos)
      : Promise.resolve({ data: [] as { id: string; dni: string }[], error: null as null | { message: string } }),
  ]);
  if (byEmailRes.error) return NextResponse.json({ error: byEmailRes.error.message }, { status: 500 });
  if (byDniRes.error) return NextResponse.json({ error: byDniRes.error.message }, { status: 500 });

  const emailToUserId = new Map<string, string>();
  for (const u of byEmailRes.data ?? []) {
    if (u.email) emailToUserId.set(u.email.toLowerCase(), u.id);
  }
  const dniToUserId = new Map<string, string>();
  for (const u of byDniRes.data ?? []) {
    if (u.dni) dniToUserId.set(u.dni, u.id);
  }

  /* ────────────────── 4. Resolver usuario_id por cada invitado ────────────────── */

  type Resolved = Pending & { usuarioId: string | null };
  const resolved: Resolved[] = validas.map((v) => {
    let usuarioId: string | null = null;
    if (v.emailProvided) usuarioId = emailToUserId.get(v.emailFinal) ?? null;
    if (!usuarioId) usuarioId = dniToUserId.get(v.dniFinal) ?? null;
    return { ...v, usuarioId };
  });

  /* ────────────────── 5. Bulk lookup duplicados en el evento ────────────────── */

  const idsResueltos = resolved
    .map((r) => r.usuarioId)
    .filter((x): x is string => typeof x === "string");
  let yaInvitados = new Set<string>();
  if (idsResueltos.length > 0) {
    const { data: dupRes, error: dupErr } = await supabase
      .from("invitados")
      .select("usuario_id")
      .eq("evento_id", eventoId)
      .in("usuario_id", idsResueltos);
    if (dupErr) return NextResponse.json({ error: dupErr.message }, { status: 500 });
    yaInvitados = new Set(
      (dupRes ?? [])
        .map((d) => (d as { usuario_id?: string | null }).usuario_id)
        .filter((x): x is string => typeof x === "string"),
    );
  }

  /* ────────────────── 6. Separar duplicados, existentes y nuevos ────────────────── */

  const conUsuarioExistente: Resolved[] = [];
  const aCrearCuenta: Resolved[] = [];
  for (const r of resolved) {
    if (r.usuarioId && yaInvitados.has(r.usuarioId)) {
      errors.push({
        row: r.rowNumber,
        message: r.emailProvided
          ? "Este email ya está en el evento."
          : "Ya está agregado a este evento (DNI duplicado).",
      });
      continue;
    }
    if (r.usuarioId) conUsuarioExistente.push(r);
    else aCrearCuenta.push(r);
  }

  /* ────────────────── 7. Crear cuentas auth en paralelo ────────────────── */
  /*
   * `auth.admin.createUser` no soporta bulk. Lo más rápido es paralelizar.
   * Concurrencia 10 es un buen balance: más rápido que antes (5) sin disparar
   * rate-limit en proyectos Supabase típicos.
   */
  const AUTH_CONCURRENCY = 10;
  const cuentasCreadas: { resolved: Resolved; usuarioId: string }[] = [];
  for (let i = 0; i < aCrearCuenta.length; i += AUTH_CONCURRENCY) {
    const chunk = aCrearCuenta.slice(i, i + AUTH_CONCURRENCY);
    const outcomes = await Promise.all(
      chunk.map(async (r) => {
        const { nombre, apellido } = splitNombreCompleto(r.nombreCompleto);
        const password = randomBytes(18).toString("base64url");
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: r.emailFinal,
          password,
          email_confirm: true,
          user_metadata: { nombre, apellido, dni: r.dniFinal, tipo: "invitado" },
        });
        if (authError || !authData.user) {
          return {
            ok: false as const,
            resolved: r,
            message: authError?.message ?? "No se pudo crear el usuario.",
          };
        }
        return { ok: true as const, resolved: r, usuarioId: authData.user.id };
      }),
    );
    for (const o of outcomes) {
      if (o.ok) cuentasCreadas.push({ resolved: o.resolved, usuarioId: o.usuarioId });
      else errors.push({ row: o.resolved.rowNumber, message: o.message });
    }
  }

  /* ────────────────── 8. Bulk update de usuarios recién creados ────────────────── */
  /*
   * El trigger de la DB puede no copiar dni/nombre/apellido desde
   * user_metadata, así que aseguramos los valores con un update por usuario.
   * Lo hacemos en paralelo con concurrencia 20.
   */
  const UPDATE_CONCURRENCY = 20;
  for (let i = 0; i < cuentasCreadas.length; i += UPDATE_CONCURRENCY) {
    const chunk = cuentasCreadas.slice(i, i + UPDATE_CONCURRENCY);
    await Promise.all(
      chunk.map(({ resolved: r, usuarioId }) => {
        const { nombre, apellido } = splitNombreCompleto(r.nombreCompleto);
        return supabase
          .from("usuarios")
          .update({ dni: r.dniFinal, nombre, apellido })
          .eq("id", usuarioId);
      }),
    );
  }

  /* ────────────────── 9. Bulk insert en `invitados` ────────────────── */

  const buildInvitadoRow = (r: Resolved, usuarioId: string): InvitadoInsert => {
    const n = clampCuposMax(r.grupoCuposMax, INV_ROW_BASE.grupo_cupos_max);
    return {
      ...INV_ROW_BASE,
      usuario_id: usuarioId,
      evento_id: eventoId,
      grupo: r.grupo,
      rango_etario: r.rangoEtario,
      telefono: r.celular,
      grupo_cupos_max: n,
      smartpool_cupos_max: plazasSmartpoolPasajeros(n),
    } as InvitadoInsert;
  };

  type InsertableRow = { row: InvitadoInsert; meta: Resolved; usuarioId: string };
  const aInsertar: InsertableRow[] = [
    ...conUsuarioExistente.map((r) => ({
      row: buildInvitadoRow(r, r.usuarioId!),
      meta: r,
      usuarioId: r.usuarioId!,
    })),
    ...cuentasCreadas.map(({ resolved: r, usuarioId }) => ({
      row: buildInvitadoRow(r, usuarioId),
      meta: r,
      usuarioId,
    })),
  ];

  let created = 0;
  if (aInsertar.length > 0) {
    // Intentamos insertar todo de un solo viaje.
    const filas = aInsertar.map((x) => x.row);
    let insertErr: { message: string } | null = null;
    {
      const resp = await supabase.from("invitados").insert(filas);
      insertErr = resp.error;
    }

    // Compat: bases viejas sin columna `telefono`. Reintentamos sin esa columna.
    if (insertErr?.message?.toLowerCase().includes("telefono")) {
      const filasSinTel = filas.map((row) => {
        const copy = { ...(row as Record<string, unknown>) };
        delete copy.telefono;
        return copy as unknown as InvitadoInsert;
      });
      const resp = await supabase.from("invitados").insert(filasSinTel);
      insertErr = resp.error;
    }

    if (insertErr) {
      // El bulk falló completo: hacemos fallback fila por fila para identificar
      // cuáles entraron y cuáles no, y reportar errores por fila.
      for (const x of aInsertar) {
        let rowErr: { message: string } | null = null;
        {
          const r = await supabase.from("invitados").insert(x.row);
          rowErr = r.error;
        }
        if (rowErr?.message?.toLowerCase().includes("telefono")) {
          const sinTel = { ...(x.row as Record<string, unknown>) };
          delete sinTel.telefono;
          const r = await supabase.from("invitados").insert(sinTel as unknown as InvitadoInsert);
          rowErr = r.error;
        }
        if (rowErr) {
          errors.push({ row: x.meta.rowNumber, message: rowErr.message });
          // Si esta fila había creado una cuenta nueva, mejor limpiarla para no
          // dejar usuarios huérfanos en auth.
          const eraCuentaNueva = cuentasCreadas.find((c) => c.usuarioId === x.usuarioId);
          if (eraCuentaNueva) {
            try {
              await supabase.auth.admin.deleteUser(x.usuarioId);
            } catch {
              /* ignoramos: queda como huérfano */
            }
          }
        } else {
          created++;
        }
      }
    } else {
      created = aInsertar.length;
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

  const usuarioIds = [...new Set(list.map((r) => r.usuario_id).filter(Boolean) as string[])];

  const { error: delErr } = await supabase.from("invitados").delete().eq("evento_id", evento.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  /*
   * Limpieza de cuentas auth "sintéticas" sin invitaciones restantes:
   * 1) De una sola query: usuarios sintéticos del set inicial.
   * 2) De una sola query: cuáles de esos aún tienen otras invitaciones (anti-join en JS).
   * 3) Borramos en auth los que quedaron huérfanos (limite de concurrencia para no saturar).
   */
  if (usuarioIds.length > 0) {
    const [{ data: sinteticos }, { data: restantes }] = await Promise.all([
      supabase
        .from("usuarios")
        .select("id, email")
        .in("id", usuarioIds)
        .like("email", `%${SYNTHETIC_EMAIL_SUFFIX}`),
      supabase
        .from("invitados")
        .select("usuario_id")
        .in("usuario_id", usuarioIds),
    ]);

    const conInvitacionesVivas = new Set(
      (restantes ?? []).map((r) => r.usuario_id).filter(Boolean) as string[],
    );
    const aBorrar = (sinteticos ?? [])
      .map((u) => u.id)
      .filter((id) => !conInvitacionesVivas.has(id));

    if (aBorrar.length > 0) {
      const CONCURRENCY = 5;
      for (let i = 0; i < aBorrar.length; i += CONCURRENCY) {
        const chunk = aBorrar.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map((id) => supabase.auth.admin.deleteUser(id)));
      }
    }
  }

  return NextResponse.json({ deleted: list.length });
}
