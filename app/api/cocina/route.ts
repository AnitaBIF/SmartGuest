import { NextRequest, NextResponse } from "next/server";
import { requireSalonCocinaAccess } from "@/lib/adminSalonAuth";
import {
  bucketsToMenusPayload,
  emptyMenuBuckets,
  mergeMenuBuckets,
  menuBucketsFromInvitado,
} from "@/lib/cocinaConteos";

export async function GET(req: NextRequest) {
  const auth = await requireSalonCocinaAccess(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db: supabase, salonNombre, salonDireccion } = auth.ctx;

  if (!salonNombre || !salonDireccion) {
    return NextResponse.json([]);
  }

  const { data: eventos, error: evError } = await supabase
    .from("eventos")
    .select("id, nombre, tipo, fecha, horario, anfitrion1_nombre, anfitrion2_nombre, cant_invitados, cant_mesas")
    .eq("salon", salonNombre)
    .eq("direccion", salonDireccion)
    .order("fecha", { ascending: true });

  if (evError || !eventos) {
    return NextResponse.json({ error: evError?.message ?? "Error" }, { status: 500 });
  }

  const result = [];

  for (const ev of eventos) {
    // Mesas de este evento
    const { data: mesas } = await supabase
      .from("mesas")
      .select("id, numero, estado")
      .eq("evento_id", ev.id)
      .order("numero", { ascending: true });

    if (!mesas || mesas.length === 0) continue;

    const { data: invitados } = await supabase
      .from("invitados")
      .select("mesa_id, restriccion_alimentaria, restriccion_otro, grupo_menus_json, asistencia")
      .eq("evento_id", ev.id);

    const confirmados = (invitados ?? []).filter((i) => i.asistencia === "confirmado");

    const mesasConMenus = mesas.map((mesa) => {
      const invMesa = confirmados.filter((i) => i.mesa_id === mesa.id);
      let acc = emptyMenuBuckets();
      for (const inv of invMesa) {
        acc = mergeMenuBuckets(acc, menuBucketsFromInvitado(inv));
      }
      return {
        id: mesa.id,
        numero: mesa.numero,
        estado: mesa.estado,
        menus: bucketsToMenusPayload(acc),
      };
    });

    const sinMesa = confirmados.filter((i) => i.mesa_id == null);
    if (sinMesa.length > 0) {
      let acc = emptyMenuBuckets();
      for (const inv of sinMesa) {
        acc = mergeMenuBuckets(acc, menuBucketsFromInvitado(inv));
      }
      mesasConMenus.push({
        id: `sin-mesa-${ev.id}`,
        numero: 0,
        estado: "pendiente",
        menus: bucketsToMenusPayload(acc),
      });
    }

    const anfitriones = [ev.anfitrion1_nombre, ev.anfitrion2_nombre].filter(Boolean).join(" y ");
    const d = new Date(ev.fecha + "T12:00:00");

    result.push({
      id: ev.id,
      titulo: ev.nombre || ev.tipo || "Evento",
      fecha: d.toLocaleDateString("es-AR", { day: "numeric", month: "numeric", year: "2-digit" }),
      anfitriones,
      mesas: mesasConMenus,
    });
  }

  return NextResponse.json(result);
}
