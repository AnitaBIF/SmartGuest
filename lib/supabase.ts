import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (typeof window !== "undefined" && (!supabaseUrl || !supabaseAnonKey)) {
  console.error(
    "[SmartGuest] Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY. Creá .env.local en la raíz del proyecto, pegá las variables del dashboard de Supabase (Settings → API) y reiniciá npm run dev."
  );
}

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

export async function logout() {
  await supabase.auth.signOut();
  // Forzar limpieza de cookies de sesión antes de redirigir
  document.cookie.split(";").forEach((c) => {
    const name = c.split("=")[0].trim();
    if (name.startsWith("sb-")) {
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  });
  window.location.href = "/";
}
