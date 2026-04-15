import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { eventoCoincideConSalonPerfil } from "@/lib/adminSalonAuth";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getSessionUser(req: NextRequest) {
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  return user;
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { id: cancionId } = await context.params;
  if (!cancionId) return NextResponse.json({ error: "Falta id." }, { status: 400 });

  const supabase = adminClient();

  const { data: me } = await supabase
    .from("usuarios")
    .select("tipo, salon_nombre, salon_direccion")
    .eq("id", user.id)
    .single();
  if (me?.tipo !== "anfitrion") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, salon, direccion")
    .eq("anfitrion_id", user.id)
    .order("fecha", { ascending: false })
    .limit(1)
    .single();

  if (!evento?.id) return NextResponse.json({ error: "No tenés un evento asignado" }, { status: 404 });
  if (!eventoCoincideConSalonPerfil(evento, me.salon_nombre ?? "", me.salon_direccion ?? "")) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { data: row } = await supabase
    .from("canciones")
    .select("id")
    .eq("id", cancionId)
    .eq("evento_id", evento.id)
    .maybeSingle();

  if (!row) return NextResponse.json({ error: "Canción no encontrada." }, { status: 404 });

  const { error: delErr } = await supabase.from("canciones").delete().eq("id", cancionId);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
