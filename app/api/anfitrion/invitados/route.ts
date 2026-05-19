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
  collapseGuestsByGrupoForImport,
  sumCuposDesdeFilasInvitados,
} from "@/lib/invitadosImportGrupo";
import {
  generateImportDni,
  generateSyntheticEmail,
  nombreDisplayInvitado,
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
    "id, usuario_id, asistencia, restriccion_alimentaria, restriccion_otro, grupo, rango_etario, telefono, rol_smartpool, grupo_cupos_max, grupo_personas_confirmadas, pending_import_nombre, pending_import_email, pending_import_dni" as const;
  const selectNoPhone =
    "id, usuario_id, asistencia, restriccion_alimentaria, restriccion_otro, grupo, rango_etario, rol_smartpool, grupo_cupos_max, grupo_personas_confirmadas, pending_import_nombre, pending_import_email, pending_import_dni" as const;

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

  const cuposTotalesReservados = sumCuposDesdeFilasInvitados(rows);

  const userIds = [...new Set(rows.map((i) => i.usuario_id).filter(Boolean) as string[])];
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
    const ext = inv as typeof inv & {
      pending_import_nombre?: string | null;
      pending_import_email?: string | null;
      pending_import_dni?: string | null;
    };
    const u = inv.usuario_id ? userMap[inv.usuario_id] : undefined;
    const nombre = nombreDisplayInvitado({
      nombreUsuario: u ? `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() : null,
      pendingImportNombre: ext.pending_import_nombre,
    });
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

    const dniPend = ext.pending_import_dni?.trim() ?? "";
    const dniShow = u?.dni?.trim() ? u.dni : dniPend || "—";
    const emailShow = u?.email?.trim() ? u.email : ext.pending_import_email?.trim() ?? "";

    return {
      id: inv.id,
      usuarioId: inv.usuario_id,
      nombre,
      dni: dniShow,
      email: emailShow,
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
    {
      invitados,
      menuOpciones,
      cuposTotalesReservados,
      cupoEventoMax: evento.cantInvitados > 0 ? evento.cantInvitados : null,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

/**
 * Alta de invitados (manual o por lote / Excel).
 *
 * Cuerpo típico: `{ guests: GuestInput[], bulkImport?: boolean }`.
 *
 * **`bulkImport: true`** (usado por la importación Excel): no crea usuarios de Auth
 * por fila. Inserta `invitados` con `usuario_id` null y datos en
 * `pending_import_*`; la cuenta se crea cuando el invitado completa
 * `POST /api/invitado/register` desde su enlace personal.
 *
 * **Sin `bulkImport` o `false`** (alta manual desde el panel): comportamiento
 * anterior — se crean cuentas Auth en paralelo según corresponda; suele ser lo
 * más lento de la operación (~300–800 ms por alta nueva).
 *
 * En ambos modos se agrupan lookups (usuarios por email/DNI, duplicados en el
 * evento) y el insert de invitados en bulk donde aplica.
 *
 * **Capacidad:** se compara la suma de `grupo_cupos_max` (cupos/personas por invitación),
 * no la cantidad de filas. Varias filas con el mismo «Grupo» se fusionan en una sola
 * invitación antes de insertar y antes de validar cupos.
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

    let dni = normalizeDniInput(String(g.dni ?? ""));
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

  /** Misma familia = mismo texto en columna «Grupo» del Excel (varias filas → una invitación). */
  const { collapsed: validasMerged } = collapseGuestsByGrupoForImport(validas);

  /* ────────────────── 2. Validación de capacidad del evento (cupos = personas, no filas) ────────────────── */

  const limite = evento.cantInvitados;
  if (limite > 0) {
    const { data: cuposRows, error: cuposErr } = await supabase
      .from("invitados")
      .select("grupo_cupos_max")
      .eq("evento_id", eventoId);
    if (cuposErr) {
      return NextResponse.json({ error: cuposErr.message }, { status: 500 });
    }
    const cuposActuales = sumCuposDesdeFilasInvitados(cuposRows ?? []);
    const cuposNuevaCarga = validasMerged.reduce(
      (acc, r) => acc + clampCuposMax(r.grupoCuposMax, 1),
      0,
    );
    if (cuposActuales + cuposNuevaCarga > limite) {
      return NextResponse.json(
        {
          error: `Capacidad del evento: ${limite} personas (cupos). Ya hay ${cuposActuales} cupos reservados en invitaciones; esta carga sumaría ${cuposNuevaCarga} (${cuposActuales + cuposNuevaCarga} en total). Las filas del Excel con el mismo «Grupo» cuentan como una sola familia. Revisá cupos y grupos o pedí aumentar la capacidad.`,
        },
        { status: 400 },
      );
    }
  }

  /* ────────────────── 3. Bulk lookup: usuarios existentes por email/dni ────────────────── */

  const emailsProvidos = Array.from(
    new Set(validasMerged.filter((v) => v.emailProvided).map((v) => v.emailFinal)),
  );
  const dnisTodos = Array.from(new Set(validasMerged.map((v) => v.dniFinal)));

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
  const resolved: Resolved[] = validasMerged.map((v) => {
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

  const bulkImport = (body as { bulkImport?: boolean }).bulkImport === true;

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
      pending_import_nombre: null,
      pending_import_email: null,
      pending_import_dni: null,
    } as InvitadoInsert;
  };

  /** Fila sin cuenta Auth: se completa cuando el invitado abre `/invitacion/:id`. */
  const buildInvitadoRowDeferred = (r: Resolved): InvitadoInsert => {
    const n = clampCuposMax(r.grupoCuposMax, INV_ROW_BASE.grupo_cupos_max);
    return {
      ...INV_ROW_BASE,
      usuario_id: null,
      evento_id: eventoId,
      grupo: r.grupo,
      rango_etario: r.rangoEtario,
      telefono: r.celular,
      grupo_cupos_max: n,
      smartpool_cupos_max: plazasSmartpoolPasajeros(n),
      pending_import_nombre: r.nombreCompleto,
      pending_import_email: r.emailFinal,
      pending_import_dni: r.dniFinal,
    } as InvitadoInsert;
  };

  type InsertableRow = { row: InvitadoInsert; meta: Resolved; usuarioId: string | null };
  let aInsertar: InsertableRow[] = [];
  /** Solo en import no masivo: UIDs creados en esta request (para rollback si falla el INSERT). */
  let usuarioIdsParaRollback = new Set<string>();

  if (bulkImport) {
    aInsertar = [
      ...conUsuarioExistente.map((r) => ({
        row: buildInvitadoRow(r, r.usuarioId!),
        meta: r,
        usuarioId: r.usuarioId!,
      })),
      ...aCrearCuenta.map((r) => ({
        row: buildInvitadoRowDeferred(r),
        meta: r,
        usuarioId: null,
      })),
    ];
  } else {
    /* ────────────────── 7b. Crear cuentas auth (carga manual / 1 fila) ────────────────── */
    const AUTH_CONCURRENCY = 15;

    const isTransientAuthError = (msg: string | undefined): boolean => {
      if (!msg) return false;
      const m = msg.toLowerCase();
      return (
        m.includes("rate") ||
        m.includes("429") ||
        m.includes("timeout") ||
        m.includes("temporar") ||
        m.includes("transient") ||
        m.includes("retry") ||
        m.includes("unexpected_failure") ||
        m.includes("internal") ||
        m.includes("upstream") ||
        m.includes("connection")
      );
    };

    const crearCuentaConRetry = async (
      r: Resolved,
    ): Promise<{ ok: true; usuarioId: string } | { ok: false; message: string }> => {
      const { nombre, apellido } = splitNombreCompleto(r.nombreCompleto);
      const MAX_INTENTOS = 3;
      let lastError = "No se pudo crear el usuario.";
      for (let intento = 0; intento < MAX_INTENTOS; intento++) {
        const password = randomBytes(18).toString("base64url");
        const { data, error } = await supabase.auth.admin.createUser({
          email: r.emailFinal,
          password,
          email_confirm: true,
          user_metadata: { nombre, apellido, dni: r.dniFinal, tipo: "invitado" },
        });
        if (!error && data.user) return { ok: true, usuarioId: data.user.id };
        lastError = error?.message ?? lastError;
        if (!isTransientAuthError(lastError)) break;
        const delayMs = 250 * Math.pow(3, intento);
        await new Promise((res) => setTimeout(res, delayMs));
      }
      return { ok: false, message: lastError };
    };

    const cuentasCreadas: { resolved: Resolved; usuarioId: string }[] = [];
    for (let i = 0; i < aCrearCuenta.length; i += AUTH_CONCURRENCY) {
      const chunk = aCrearCuenta.slice(i, i + AUTH_CONCURRENCY);
      const outcomes = await Promise.all(
        chunk.map(async (r) => {
          const res = await crearCuentaConRetry(r);
          if (res.ok) return { ok: true as const, resolved: r, usuarioId: res.usuarioId };
          return { ok: false as const, resolved: r, message: res.message };
        }),
      );
      for (const o of outcomes) {
        if (o.ok) cuentasCreadas.push({ resolved: o.resolved, usuarioId: o.usuarioId });
        else errors.push({ row: o.resolved.rowNumber, message: o.message });
      }
    }

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

    aInsertar = [
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
    usuarioIdsParaRollback = new Set(cuentasCreadas.map((c) => c.usuarioId));
  }

  /* ────────────────── 8. Bulk insert en `invitados` ────────────────── */

  let created = 0;

  if (aInsertar.length > 0) {
    const filas = aInsertar.map((x) => x.row);
    let insertErr: { message: string } | null = null;
    {
      const resp = await supabase.from("invitados").insert(filas);
      insertErr = resp.error;
    }

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
          if (!bulkImport && x.usuarioId && usuarioIdsParaRollback.has(x.usuarioId)) {
            try {
              await supabase.auth.admin.deleteUser(x.usuarioId);
            } catch {
              /* ignoramos */
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
