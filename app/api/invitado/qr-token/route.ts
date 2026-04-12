import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/database.types";
import {
  currentWindowIndex,
  mintRollingQrToken,
  msUntilNextWindow,
  QR_WINDOW_MS,
} from "@/lib/secure-qr-token";

function adminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Emite el contenido del QR actual: HMAC rotativo firmado en servidor (ventana 30 s).
 * Solo invitados con asistencia confirmada reciben token.
 */
export async function GET(req: NextRequest) {
  const response = NextResponse.next();
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(c) {
          c.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const supabase = adminClient();
  const { data: invitacion } = await supabase
    .from("invitados")
    .select("id, evento_id, asistencia")
    .eq("usuario_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!invitacion) {
    return NextResponse.json({ error: "No tenés invitación activa." }, { status: 404 });
  }

  if (invitacion.asistencia !== "confirmado") {
    return NextResponse.json(
      { error: "Solo se emite QR con asistencia confirmada." },
      { status: 403 }
    );
  }

  const now = Date.now();
  const window = currentWindowIndex(now);
  const token = mintRollingQrToken(invitacion.id, invitacion.evento_id, window);

  return NextResponse.json({
    token,
    scheme: "SmartGuest-Rolling-HMAC",
    windowSeconds: QR_WINDOW_MS / 1000,
    expiresInMs: msUntilNextWindow(now),
    serverNow: now,
    windowIndex: window,
  });
}
