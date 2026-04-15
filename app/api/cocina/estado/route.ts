import { NextRequest, NextResponse } from "next/server";
import { eventoPerteneceAlSalon, requireSalonCocinaAccess } from "@/lib/adminSalonAuth";

export async function PUT(req: NextRequest) {
  const auth = await requireSalonCocinaAccess(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, salonNombre, salonDireccion } = auth.ctx;
  if (!salonNombre || !salonDireccion) {
    return NextResponse.json({ error: "Cuenta sin salón configurado." }, { status: 403 });
  }

  const { mesa_id, estado } = await req.json();

  if (!mesa_id || !estado) {
    return NextResponse.json({ error: "mesa_id y estado requeridos" }, { status: 400 });
  }

  const { data: mesa, error: mErr } = await db
    .from("mesas")
    .select("id, evento_id")
    .eq("id", mesa_id)
    .maybeSingle();

  if (mErr || !mesa) {
    return NextResponse.json({ error: "Mesa no encontrada." }, { status: 404 });
  }

  const { data: evento, error: evErr } = await db
    .from("eventos")
    .select("salon, direccion")
    .eq("id", mesa.evento_id)
    .maybeSingle();

  if (evErr || !evento || !eventoPerteneceAlSalon(evento, salonNombre, salonDireccion)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { error } = await db.from("mesas").update({ estado }).eq("id", mesa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
