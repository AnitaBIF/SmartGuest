import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  const supabase = adminClient();

  const { data, error } = await supabase
    .from("eventos")
    .select("*")
    .order("fecha", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const supabase = adminClient();

  const salon = String(body.salon ?? "").trim();
  const direccion = String(body.direccion ?? "").trim();
  if (!salon || !direccion) {
    return NextResponse.json(
      { error: "El nombre del salón y la dirección completa son obligatorios (para el mapa y las invitaciones)." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("eventos")
    .insert({
      nombre: body.nombre ?? "",
      tipo: body.tipo ?? null,
      fecha: body.fecha,
      horario: body.horario ?? "",
      salon,
      direccion,
      anfitrion1_nombre: body.anfitrion1_nombre ?? "",
      anfitrion2_nombre: body.anfitrion2_nombre ?? null,
      cant_invitados: body.cant_invitados ?? 0,
      cant_mesas: body.cant_mesas ?? 0,
      menu_standard: body.menu_standard ?? null,
      monto_total: body.monto_total ?? 0,
      sena: body.sena ?? 0,
      dress_code: body.dress_code ?? null,
      menus_especiales: body.menus_especiales ?? [],
      menus_especiales_otro: body.menus_especiales_otro ?? null,
      anfitrion_id: body.anfitrion_id ?? null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Crear las mesas automáticamente
  const cantMesas = body.cant_mesas ?? 0;
  if (cantMesas > 0 && data) {
    const mesasInsert = Array.from({ length: cantMesas }, (_, i) => ({
      evento_id: data.id,
      numero: i + 1,
      estado: "pendiente" as const,
    }));
    await supabase.from("mesas").insert(mesasInsert);
  }

  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const supabase = adminClient();

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (body.nombre !== undefined)              update.nombre = body.nombre;
  if (body.tipo !== undefined)                update.tipo = body.tipo;
  if (body.fecha !== undefined)               update.fecha = body.fecha;
  if (body.horario !== undefined)             update.horario = body.horario;
  if (body.anfitrion1_nombre !== undefined)   update.anfitrion1_nombre = body.anfitrion1_nombre;
  if (body.anfitrion2_nombre !== undefined)   update.anfitrion2_nombre = body.anfitrion2_nombre;
  if (body.cant_invitados !== undefined)      update.cant_invitados = body.cant_invitados;
  if (body.cant_mesas !== undefined)          update.cant_mesas = body.cant_mesas;
  if (body.menu_standard !== undefined)       update.menu_standard = body.menu_standard;
  if (body.monto_total !== undefined)         update.monto_total = body.monto_total;
  if (body.sena !== undefined)                update.sena = body.sena;
  if (body.dress_code !== undefined)          update.dress_code = body.dress_code;
  if (body.menus_especiales !== undefined)    update.menus_especiales = body.menus_especiales;
  if (body.menus_especiales_otro !== undefined) update.menus_especiales_otro = body.menus_especiales_otro;
  if (body.salon !== undefined) {
    const s = String(body.salon).trim();
    if (!s) {
      return NextResponse.json({ error: "El nombre del salón no puede quedar vacío." }, { status: 400 });
    }
    update.salon = s;
  }
  if (body.direccion !== undefined) {
    const d = String(body.direccion).trim();
    if (!d) {
      return NextResponse.json({ error: "La dirección del salón no puede quedar vacía." }, { status: 400 });
    }
    update.direccion = d;
  }

  const { error } = await supabase
    .from("eventos")
    .update(update as Database["public"]["Tables"]["eventos"]["Update"])
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const supabase = adminClient();
  const { error } = await supabase.from("eventos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
