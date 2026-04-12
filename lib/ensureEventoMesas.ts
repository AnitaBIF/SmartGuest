import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Admin = SupabaseClient<Database>;

/**
 * Garantiza que existan filas en `mesas` para cada número 1..cantMesas (como al crear el evento).
 * Si el admin subió `cant_mesas` sin insertar mesas, SmartSeat y el resumen quedaban desconectados.
 */
export async function ensureMesasForEvento(
  supabase: Admin,
  eventoId: string,
  cantMesas: number
): Promise<{ id: string; numero: number }[]> {
  const { data: existing, error: selErr } = await supabase
    .from("mesas")
    .select("id, numero")
    .eq("evento_id", eventoId)
    .order("numero", { ascending: true });

  if (selErr) throw selErr;

  const rows = existing ?? [];
  if (cantMesas <= 0) {
    return rows.map((r) => ({ id: r.id, numero: r.numero }));
  }

  const have = new Set(rows.map((r) => r.numero));
  const missing: { evento_id: string; numero: number; estado: "pendiente" }[] = [];
  for (let n = 1; n <= cantMesas; n++) {
    if (!have.has(n)) missing.push({ evento_id: eventoId, numero: n, estado: "pendiente" });
  }

  if (missing.length === 0) {
    return rows.map((r) => ({ id: r.id, numero: r.numero }));
  }

  const { error: insErr } = await supabase.from("mesas").insert(missing);
  if (insErr) throw insErr;

  const { data: again, error: againErr } = await supabase
    .from("mesas")
    .select("id, numero")
    .eq("evento_id", eventoId)
    .order("numero", { ascending: true });

  if (againErr) throw againErr;
  return (again ?? rows).map((r) => ({ id: r.id, numero: r.numero }));
}
