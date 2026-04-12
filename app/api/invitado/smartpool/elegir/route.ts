import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { clampCuposMax, plazasPersonasPasajeroPool, plazasSmartpoolPasajeros } from "@/lib/grupoFamiliar";
import { fetchInvitacionPriorizada } from "@/lib/invitacionUsuarioPriorizada";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function createAuthClient(req: NextRequest) {
  const response = NextResponse.next();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );
}

/**
 * Conductor elige un pasajero de la lista sugerida: queda propuesta pendiente hasta que el pasajero acepte.
 */
export async function POST(req: NextRequest) {
  const supabaseAuth = createAuthClient(req);
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  const userId = user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: {
    pasajeroInvitadoId?: string;
    pasajero_invitado_id?: string;
    invitadoId?: string;
    eventoId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const eventoIdCtx = body.eventoId?.trim() || null;

  const pasajeroInvIdRaw =
    (typeof body.pasajeroInvitadoId === "string" && body.pasajeroInvitadoId) ||
    (typeof body.pasajero_invitado_id === "string" && body.pasajero_invitado_id) ||
    (typeof body.invitadoId === "string" && body.invitadoId) ||
    "";
  const pasajeroInvId = pasajeroInvIdRaw.trim();
  if (!pasajeroInvId) {
    return NextResponse.json({ error: "Falta el id del invitado (pasajero)." }, { status: 400 });
  }

  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(pasajeroInvId)) {
    return NextResponse.json({ error: "Identificador de invitado inválido." }, { status: 400 });
  }

  const supabase = adminClient();

  const { row: me, error: meErr } = await fetchInvitacionPriorizada(supabase, userId, {
    eventoId: eventoIdCtx,
  });

  if (meErr || !me) {
    return NextResponse.json({ error: "No se encontró invitación." }, { status: 404 });
  }

  if (me.rol_smartpool !== "conductor") {
    return NextResponse.json({ error: "Solo los conductores pueden proponer un pasajero." }, { status: 403 });
  }

  const nInv = clampCuposMax(me.grupo_cupos_max, 1);
  const cuposMax = plazasSmartpoolPasajeros(nInv);
  const { data: ocupRows, error: cntErr } = await supabase
    .from("invitados")
    .select("id, asistencia, grupo_cupos_max, grupo_personas_confirmadas")
    .eq("smartpool_pareja_invitado_id", me.id);

  if (cntErr) {
    return NextResponse.json({ error: cntErr.message }, { status: 500 });
  }
  const plazasOcupadas =
    (ocupRows ?? []).reduce(
      (acc, row) =>
        acc +
        plazasPersonasPasajeroPool({
          asistencia: String((row as { asistencia?: string }).asistencia ?? ""),
          grupo_cupos_max: (row as { grupo_cupos_max?: number | null }).grupo_cupos_max,
          grupo_personas_confirmadas: (row as { grupo_personas_confirmadas?: number | null })
            .grupo_personas_confirmadas,
        }),
      0
    );
  if (plazasOcupadas >= cuposMax) {
    return NextResponse.json(
      {
        error: `Ya no te quedan plazas libres en el pool para este viaje (${plazasOcupadas}/${cuposMax} ocupadas). Retirá una propuesta o salí del pool para reorganizar.`,
      },
      { status: 409 }
    );
  }

  if (!me.telefono?.trim()) {
    return NextResponse.json(
      {
        error:
          "Cargá tu celular en Configuración para poder proponer un viaje compartido.",
      },
      { status: 400 }
    );
  }

  const pasajeroInvUuid = pasajeroInvId.toLowerCase();

  const { data: pasRows, error: pErr } = await supabase
    .from("invitados")
    .select("*")
    .eq("id", pasajeroInvUuid)
    .limit(1);

  if (pErr) {
    console.warn("[smartpool/elegir] select invitado:", pErr.code, pErr.message);
    return NextResponse.json(
      {
        error:
          "No se pudo cargar el invitado en la base de datos. Si el problema sigue, avisá al organizador.",
      },
      { status: 500 }
    );
  }

  const pas = pasRows?.[0] as
    | {
        id: string;
        evento_id: string;
        rol_smartpool: string | null;
        smartpool_pareja_invitado_id: string | null;
        asistencia?: string;
        grupo_cupos_max?: number | null;
        grupo_personas_confirmadas?: number | null;
      }
    | undefined;

  if (!pas) {
    return NextResponse.json(
      {
        error:
          "No encontramos ese invitado. Actualizá la lista (salí y volvé a entrar a SmartPool) y reintentá.",
      },
      { status: 404 }
    );
  }

  if (pas.asistencia !== "confirmado") {
    return NextResponse.json(
      { error: "Solo podés proponer viaje a invitados que confirmaron asistencia al evento." },
      { status: 400 }
    );
  }

  if (pas.evento_id !== me.evento_id) {
    return NextResponse.json({ error: "Ese invitado no es de tu evento." }, { status: 400 });
  }

  if (pas.rol_smartpool === "conductor" || pas.rol_smartpool === "no") {
    return NextResponse.json(
      { error: "Ese invitado no puede ser pasajero (ya eligió conductor o no participa)." },
      { status: 400 }
    );
  }

  if (pas.rol_smartpool == null) {
    const { error: setRolErr } = await supabase
      .from("invitados")
      .update({ rol_smartpool: "pasajero" })
      .eq("id", pas.id)
      .is("rol_smartpool", null);
    if (setRolErr) {
      return NextResponse.json({ error: setRolErr.message }, { status: 500 });
    }
  }

  if (pas.smartpool_pareja_invitado_id) {
    return NextResponse.json(
      { error: "Ese pasajero ya fue elegido por otro conductor. Actualizá la lista de sugerencias." },
      { status: 409 }
    );
  }

  const plazasPax = plazasPersonasPasajeroPool({
    asistencia: String(pas.asistencia ?? ""),
    grupo_cupos_max: pas.grupo_cupos_max,
    grupo_personas_confirmadas: pas.grupo_personas_confirmadas,
  });
  const plazasLibres = cuposMax - plazasOcupadas;
  if (plazasPax > plazasLibres) {
    return NextResponse.json(
      {
        error: `Esa invitación suma ${plazasPax} persona${plazasPax === 1 ? "" : "s"} en el auto y solo te quedan ${plazasLibres} plaza${plazasLibres === 1 ? "" : "s"} libre(s) en el pool. Liberá lugar quitando una propuesta o elegí otro invitado.`,
      },
      { status: 409 }
    );
  }

  const { data: upP, error: eP } = await supabase
    .from("invitados")
    .update({
      smartpool_pareja_invitado_id: me.id,
      smartpool_acepto: false,
    })
    .eq("id", pas.id)
    .is("smartpool_pareja_invitado_id", null)
    .select("id")
    .maybeSingle();

  if (eP) {
    return NextResponse.json({ error: eP.message }, { status: 500 });
  }

  if (!upP) {
    return NextResponse.json(
      { error: "Ese pasajero ya no está disponible. Elegí otro de la lista." },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
