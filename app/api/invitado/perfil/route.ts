import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { syncCancionPlaylist } from "@/lib/cancionPlaylistSync";
import { mapUiMenuToInvitadoColumns, menuOpcionesParaEvento } from "@/lib/grupoFamiliar";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUserId(req: NextRequest) {
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
  return user?.id ?? null;
}

export async function PUT(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { nombre, direccion, localidad, telefono, restriccion, restriccionOtro, cancion } = await req.json();
  const supabase = adminClient();

  // Actualizar nombre en usuarios
  if (nombre) {
    const parts = nombre.trim().split(/\s+/);
    const firstName = parts.slice(0, -1).join(" ") || parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    await supabase
      .from("usuarios")
      .update({ nombre: firstName, apellido: lastName })
      .eq("id", userId);
  }

  const { data: inv } = await supabase
    .from("invitados")
    .select("id, evento_id")
    .eq("usuario_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (inv) {
    const { data: ev } = await supabase
      .from("eventos")
      .select("menus_especiales")
      .eq("id", inv.evento_id)
      .maybeSingle();

    const permitidas = new Set(menuOpcionesParaEvento(ev?.menus_especiales));
    const rUi = typeof restriccion === "string" ? restriccion.trim() : "Ninguna";
    if (!permitidas.has(rUi)) {
      return NextResponse.json({ error: "Esa opción de menú no está disponible en tu evento." }, { status: 400 });
    }
    if (rUi === "Otro" && !(typeof restriccionOtro === "string" && restriccionOtro.trim())) {
      return NextResponse.json({ error: "Completá el detalle de «Otro»." }, { status: 400 });
    }

    const leg = mapUiMenuToInvitadoColumns(rUi, restriccionOtro);

    const cancionVal =
      typeof cancion === "string" && cancion.trim() ? cancion.trim() : null;

    await supabase
      .from("invitados")
      .update({
        direccion: direccion || null,
        localidad: localidad || null,
        telefono: typeof telefono === "string" && telefono.trim() ? telefono.trim() : null,
        restriccion_alimentaria: leg.restriccion_alimentaria,
        restriccion_otro: leg.restriccion_otro,
        cancion: cancionVal,
      })
      .eq("id", inv.id);

    await syncCancionPlaylist(supabase, inv.evento_id, userId, cancionVal);
  }

  return NextResponse.json({ ok: true });
}
