import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

export function adminServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export type SalonAdminContext = {
  userId: string;
  db: ReturnType<typeof adminServiceClient>;
  salonNombre: string;
  salonDireccion: string;
};

/**
 * Sesión Supabase + perfil de administrador del salón (nombre y dirección del local).
 * Sirve para filtrar eventos y aislar datos entre distintos salones en la misma base.
 */
export async function requireSalonAdmin(
  req: NextRequest
): Promise<{ ok: true; ctx: SalonAdminContext } | { ok: false; status: number; error: string }> {
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
  if (!user) {
    return { ok: false, status: 401, error: "No autenticado." };
  }

  const db = adminServiceClient();
  const { data: profile, error } = await db
    .from("usuarios")
    .select("tipo, salon_nombre, salon_direccion")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || profile.tipo !== "administrador") {
    return { ok: false, status: 403, error: "Solo administradores del salón." };
  }

  const salonNombre = (profile.salon_nombre ?? "").trim();
  const salonDireccion = (profile.salon_direccion ?? "").trim();

  return {
    ok: true,
    ctx: { userId: user.id, db, salonNombre, salonDireccion },
  };
}

export function eventoPerteneceAlSalon(
  ev: { salon: string | null; direccion: string | null },
  salonNombre: string,
  salonDireccion: string
): boolean {
  if (!salonNombre || !salonDireccion) return false;
  return (ev.salon ?? "").trim() === salonNombre && (ev.direccion ?? "").trim() === salonDireccion;
}
