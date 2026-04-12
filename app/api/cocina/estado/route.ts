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

export async function PUT(req: NextRequest) {
  const { mesa_id, estado } = await req.json();

  if (!mesa_id || !estado) {
    return NextResponse.json({ error: "mesa_id y estado requeridos" }, { status: 400 });
  }

  const supabase = adminClient();
  const { error } = await supabase
    .from("mesas")
    .update({ estado })
    .eq("id", mesa_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
