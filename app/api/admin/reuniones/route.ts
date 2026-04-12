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
    .from("reuniones")
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

  const { data, error } = await supabase
    .from("reuniones")
    .insert({
      titulo: body.titulo,
      fecha: body.fecha,
      hora: body.hora ?? "",
      participantes: body.participantes ?? null,
      notas: body.notas ?? null,
      creado_por: body.creado_por,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const supabase = adminClient();

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const { error } = await supabase
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
  const body = await req.json();
  const supabase = adminClient();

  if (!body.id) {
    return NextResponse.json({ error: "ID requerido." }, { status: 400 });
  }

  const { error } = await supabase
    .from("reuniones")
    .delete()
    .eq("id", body.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
