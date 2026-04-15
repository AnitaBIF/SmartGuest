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

type AuthedSalonProfile =
  | {
      ok: true;
      userId: string;
      db: ReturnType<typeof adminServiceClient>;
      tipo: string;
      salonNombre: string;
      salonDireccion: string;
    }
  | { ok: false; status: number; error: string };

async function authenticateSalonUsuarioProfile(req: NextRequest): Promise<AuthedSalonProfile> {
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

  if (error || !profile) {
    return { ok: false, status: 403, error: "Perfil no encontrado." };
  }

  const tipo = profile.tipo ?? "";
  const salonNombre = (profile.salon_nombre ?? "").trim();
  const salonDireccion = (profile.salon_direccion ?? "").trim();

  return {
    ok: true,
    userId: user.id,
    db,
    tipo,
    salonNombre,
    salonDireccion,
  };
}

/**
 * Sesión Supabase + perfil de administrador del salón (nombre y dirección del local).
 * Sirve para filtrar eventos y aislar datos entre distintos salones en la misma base.
 */
export async function requireSalonAdmin(
  req: NextRequest
): Promise<{ ok: true; ctx: SalonAdminContext } | { ok: false; status: number; error: string }> {
  const r = await authenticateSalonUsuarioProfile(req);
  if (!r.ok) return r;
  if (r.tipo !== "administrador") {
    return { ok: false, status: 403, error: "Solo administradores del salón." };
  }
  return {
    ok: true,
    ctx: { userId: r.userId, db: r.db, salonNombre: r.salonNombre, salonDireccion: r.salonDireccion },
  };
}

/** Administrador del salón o jefe de cocina del mismo salón (reporte / semáforo de mesas). */
export async function requireSalonCocinaAccess(
  req: NextRequest
): Promise<{ ok: true; ctx: SalonAdminContext } | { ok: false; status: number; error: string }> {
  const r = await authenticateSalonUsuarioProfile(req);
  if (!r.ok) return r;
  if (r.tipo !== "administrador" && r.tipo !== "jefe_cocina") {
    return { ok: false, status: 403, error: "Solo personal del salón autorizado para cocina." };
  }
  return {
    ok: true,
    ctx: { userId: r.userId, db: r.db, salonNombre: r.salonNombre, salonDireccion: r.salonDireccion },
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

/**
 * Si el perfil tiene salón configurado, el evento debe ser de ese salón.
 * Si el perfil aún no tiene salón (datos viejos), no se bloquea — salvo rutas que exijan salón explícitamente.
 */
export function eventoCoincideConSalonPerfil(
  ev: { salon: string | null; direccion: string | null },
  perfilSalonNombre: string,
  perfilSalonDireccion: string
): boolean {
  const n = perfilSalonNombre.trim();
  const d = perfilSalonDireccion.trim();
  if (!n || !d) return true;
  return eventoPerteneceAlSalon(ev, n, d);
}

/** Seguridad del salón: exige nombre y dirección del local en el perfil. */
export async function requireSalonSeguridad(
  req: NextRequest
): Promise<{ ok: true; ctx: SalonAdminContext } | { ok: false; status: number; error: string }> {
  const r = await authenticateSalonUsuarioProfile(req);
  if (!r.ok) return r;
  if (r.tipo !== "seguridad") {
    return { ok: false, status: 403, error: "Solo personal de seguridad puede validar códigos." };
  }
  if (!r.salonNombre || !r.salonDireccion) {
    return {
      ok: false,
      status: 403,
      error:
        "Tu cuenta no tiene el salón asignado. Pedí al administrador que configure nombre y dirección del local en tu usuario.",
    };
  }
  return {
    ok: true,
    ctx: { userId: r.userId, db: r.db, salonNombre: r.salonNombre, salonDireccion: r.salonDireccion },
  };
}
