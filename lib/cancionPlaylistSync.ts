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

type PedidoInvitado = { usuario_id: string | null; cancion: string | null };

/**
 * Sincroniza en batch las filas faltantes en `canciones` para un evento, en base a `invitados.cancion`
 * de los confirmados que aún no figuran en la playlist (`pedido_por` ausente).
 * Mucho más rápido que llamar `syncCancionPlaylist` por usuario en un loop.
 * Devuelve true si insertó algo (para que el caller refetchee la lista si la necesita).
 */
export async function syncCancionesPlaylistFaltantes(
  supabase: AdminClient,
  eventoId: string,
  invitadosConCancion: ReadonlyArray<PedidoInvitado>,
  yaPedidoPor: ReadonlySet<string>,
): Promise<boolean> {
  const aInsertar: { evento_id: string; titulo: string; artista: string; pedido_por: string }[] = [];
  const seen = new Set<string>();

  for (const inv of invitadosConCancion) {
    const uid = inv.usuario_id;
    const txt = typeof inv.cancion === "string" ? inv.cancion.trim() : "";
    if (!uid || !txt) continue;
    if (yaPedidoPor.has(uid) || seen.has(uid)) continue;
    const { titulo, artista } = parseCancionTituloArtista(txt);
    aInsertar.push({ evento_id: eventoId, titulo, artista, pedido_por: uid });
    seen.add(uid);
  }

  if (aInsertar.length === 0) return false;
  const { error } = await supabase.from("canciones").insert(aInsertar);
  return !error;
}
