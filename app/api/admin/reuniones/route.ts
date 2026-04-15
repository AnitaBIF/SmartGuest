import { NextRequest, NextResponse } from "next/server";
import { requireSalonAdmin } from "@/lib/adminSalonAuth";

export async function GET(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, userId } = auth.ctx;

  const { data, error } = await db
    .from("reuniones")
    .select("*")
    .eq("creado_por", userId)
    .order("fecha", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, userId } = auth.ctx;

  const body = await req.json();

  const { data, error } = await db
    .from("reuniones")
    .insert({
      titulo: body.titulo,
      fecha: body.fecha,
      hora: body.hora ?? "",
      participantes: body.participantes ?? null,
      notas: body.notas ?? null,
      creado_por: userId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, userId } = auth.ctx;

  const body = await req.json();

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const { data: row, error: rErr } = await db
    .from("reuniones")
    .select("id, creado_por")
    .eq("id", body.id)
    .maybeSingle();

  if (rErr || !row) {
    return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });
  }
  if (row.creado_por !== userId) {
    return NextResponse.json({ error: "No autorizado a modificar esta reunión." }, { status: 403 });
  }

  const { error } = await db
    .from("reuniones")
    .update({
      titulo: body.titulo,
      fecha: body.fecha,
      hora: body.hora,
      participantes: body.participantes ?? null,
      notas: body.notas ?? null,
    })
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireSalonAdmin(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { db, userId } = auth.ctx;

  const body = await req.json();

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const { data: row, error: rErr } = await db
    .from("reuniones")
    .select("id, creado_por")
    .eq("id", body.id)
    .maybeSingle();

  if (rErr || !row) {
    return NextResponse.json({ error: "Reunión no encontrada." }, { status: 404 });
  }
  if (row.creado_por !== userId) {
    return NextResponse.json({ error: "No autorizado a eliminar esta reunión." }, { status: 403 });
  }

  const { error } = await db.from("reuniones").delete().eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
