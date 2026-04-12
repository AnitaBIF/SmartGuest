import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
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
 * Aceptar o retirar aceptación del match SmartPool (mutuo = ambos en true).
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

  let body: { aceptar?: boolean; eventoId?: string; pasajeroInvitadoId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const aceptar = body.aceptar === true;
  const eventoIdCtx = body.eventoId?.trim() || null;
  const pasajeroInvIdRaw = typeof body.pasajeroInvitadoId === "string" ? body.pasajeroInvitadoId.trim().toLowerCase() : "";

  const supabase = adminClient();
  const { row: me, error: loadErr } = await fetchInvitacionPriorizada(supabase, userId, {
    eventoId: eventoIdCtx,
  });

  if (loadErr || !me) {
    return NextResponse.json({ error: loadErr ?? "No se encontró invitación." }, { status: 404 });
  }

  if (me.rol_smartpool !== "conductor" && me.rol_smartpool !== "pasajero") {
    return NextResponse.json({ error: "No participás como conductor o pasajero." }, { status: 400 });
  }

  /** Conductor: varios pasajeros; cancelar propuesta o match por `pasajeroInvitadoId`. */
  if (me.rol_smartpool === "conductor") {
    if (aceptar) {
      return NextResponse.json(
        {
          error:
            "Como conductor ya enviaste la propuesta al elegir pasajeros; el pasajero es quien confirma para compartir el teléfono.",
        },
        { status: 400 }
      );
    }
    if (!pasajeroInvIdRaw) {
      return NextResponse.json(
        { error: "Indicá qué pasajero querés quitar de tu viaje (invitado)." },
        { status: 400 }
      );
    }
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRe.test(pasajeroInvIdRaw)) {
      return NextResponse.json({ error: "Identificador de invitado inválido." }, { status: 400 });
    }
    const { data: pax, error: paxErr } = await supabase
      .from("invitados")
      .select("id, smartpool_pareja_invitado_id")
      .eq("id", pasajeroInvIdRaw)
      .maybeSingle();
    if (paxErr || !pax || pax.smartpool_pareja_invitado_id !== me.id) {
      return NextResponse.json(
        { error: "Ese pasajero no está vinculado a tu viaje o ya no existe." },
        { status: 400 }
      );
    }
    const { error: eDel } = await supabase
      .from("invitados")
      .update({ smartpool_pareja_invitado_id: null, smartpool_acepto: false })
      .eq("id", pax.id);
    if (eDel) {
      return NextResponse.json({ error: eDel.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!me.smartpool_pareja_invitado_id) {
    return NextResponse.json({ error: "No tenés una pareja SmartPool asignada." }, { status: 400 });
  }

  if (aceptar) {
    if (!me.telefono?.trim()) {
      return NextResponse.json(
        {
          error:
            "Agregá tu número de celular en Configuración para poder aceptar el match. Así tu pareja puede contactarte.",
        },
        { status: 400 }
      );
    }
    const { error: e1 } = await supabase
      .from("invitados")
      .update({ smartpool_acepto: true })
      .eq("id", me.id);
    if (e1) {
      return NextResponse.json({ error: e1.message }, { status: 500 });
    }
  } else {
    const { error: e2 } = await supabase
      .from("invitados")
      .update({ smartpool_acepto: false })
      .eq("id", me.id);
    if (e2) {
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
