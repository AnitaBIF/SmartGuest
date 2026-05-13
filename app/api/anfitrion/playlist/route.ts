import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import { eventoCoincideConSalonPerfil } from "@/lib/adminSalonAuth";
import { syncCancionesPlaylistFaltantes } from "@/lib/cancionPlaylistSync";
import { mergePlaylistRows, youtubeSearchUrlForSong } from "@/lib/playlistSongKey";

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

async function eventoDelAnfitrion(supabase: ReturnType<typeof adminClient>, userId: string) {
  const { data: me } = await supabase
    .from("usuarios")
    .select("tipo, salon_nombre, salon_direccion")
    .eq("id", userId)
    .single();
  if (me?.tipo !== "anfitrion") return null;

  const { data: evento } = await supabase
    .from("eventos")
    .select("id, salon, direccion")
    .eq("anfitrion_id", userId)
    .order("fecha", { ascending: false })
    .limit(1)
    .single();

  if (!evento?.id) return null;
  if (!eventoCoincideConSalonPerfil(evento, me.salon_nombre ?? "", me.salon_direccion ?? "")) return null;
  return evento.id;
}

/**
 * Lista la playlist del evento: pedidos de invitados (`pedido_por`) + filas del anfitrión.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const supabase = adminClient();
  const eventoId = await eventoDelAnfitrion(supabase, user.id);
  if (!eventoId) return NextResponse.json({ error: "No tenés un evento asignado" }, { status: 404 });

  /* Listo canciones + invitados con canción en paralelo, son independientes. */
  const [cancionesRes, invitadosRes] = await Promise.all([
    supabase
      .from("canciones")
      .select("id, titulo, artista, pedido_por, created_at")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: true }),
    supabase
      .from("invitados")
      .select("usuario_id, cancion")
      .eq("evento_id", eventoId)
      .eq("asistencia", "confirmado")
      .not("cancion", "is", null),
  ]);

  if (cancionesRes.error) {
    return NextResponse.json({ error: cancionesRes.error.message }, { status: 500 });
  }

  let list = cancionesRes.data ?? [];
  const pedidosEnPlaylist = new Set(
    list.map((r) => r.pedido_por).filter((x): x is string => typeof x === "string" && x.length > 0),
  );

  const inserto = await syncCancionesPlaylistFaltantes(
    supabase,
    eventoId,
    invitadosRes.data ?? [],
    pedidosEnPlaylist,
  );

  if (inserto) {
    const second = await supabase
      .from("canciones")
      .select("id, titulo, artista, pedido_por, created_at")
      .eq("evento_id", eventoId)
      .order("created_at", { ascending: true });
    if (!second.error && second.data) list = second.data;
  }

  const merged = mergePlaylistRows(
    (list ?? []).map((r) => ({
      id: r.id,
      titulo: r.titulo,
      artista: r.artista,
      created_at: r.created_at,
    })),
  );

  const canciones = merged.map((m) => ({
    ids: m.ids,
    titulo: m.titulo,
    artista: m.artista || "—",
    youtubeUrl: youtubeSearchUrlForSong(m.titulo, m.artista),
  }));

  return NextResponse.json(
    { canciones },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  );
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  const artista = typeof body.artista === "string" ? body.artista.trim() : "";
  if (!titulo || !artista) {
    return NextResponse.json({ error: "Completá canción y artista." }, { status: 400 });
  }

  const supabase = adminClient();
  const eventoId = await eventoDelAnfitrion(supabase, user.id);
  if (!eventoId) return NextResponse.json({ error: "No tenés un evento asignado" }, { status: 404 });

  const { data: inserted, error } = await supabase
    .from("canciones")
    .insert({
      evento_id: eventoId,
      titulo,
      artista,
      pedido_por: user.id,
    })
    .select("id, titulo, artista, pedido_por, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    cancion: {
      ids: [inserted.id],
      titulo: inserted.titulo,
      artista: inserted.artista || "—",
      youtubeUrl: youtubeSearchUrlForSong(inserted.titulo, inserted.artista),
    },
  });
}
