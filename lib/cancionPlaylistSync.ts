import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { parseCancionTituloArtista } from "@/lib/parseCancionTituloArtista";

type AdminClient = SupabaseClient<Database>;

/**
 * Mantiene una fila en `canciones` por (evento, usuario pedidor), alineada al texto en `invitados.cancion`.
 */
export async function syncCancionPlaylist(
  supabase: AdminClient,
  eventoId: string,
  userId: string,
  cancionCol: string | null | undefined
) {
  await supabase.from("canciones").delete().eq("evento_id", eventoId).eq("pedido_por", userId);
  const cancion = typeof cancionCol === "string" ? cancionCol.trim() : "";
  if (!cancion) return;
  const { titulo, artista } = parseCancionTituloArtista(cancion);
  await supabase.from("canciones").insert({
    evento_id: eventoId,
    titulo,
    artista,
    pedido_por: userId,
  });
}
