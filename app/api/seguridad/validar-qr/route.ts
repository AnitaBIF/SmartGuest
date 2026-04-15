import { NextRequest, NextResponse } from "next/server";
import { eventoPerteneceAlSalon, requireSalonSeguridad } from "@/lib/adminSalonAuth";
import { isQrReplay } from "@/lib/qr-replay-guard";
import { verifyRollingQrToken } from "@/lib/secure-qr-token";

type ValidarQrResponse = {
  nombre: string;
  dni: string;
  mesa: number | null;
  evento: string;
  verified: string;
  /** ISO 8601: primer ingreso registrado (no cambia en re-escaneos). */
  ingresoAt: string | null;
  /** True si este escaneo fue el que registró el ingreso por primera vez. */
  primerIngreso: boolean;
};

/**
 * Valida el QR escaneado: firma HMAC, ventana temporal, anti-replay, rol seguridad, mismo salón que el evento.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSalonSeguridad(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const supabase = auth.ctx.db;
  const { salonNombre, salonDireccion } = auth.ctx;

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Falta el código escaneado." }, { status: 400 });
  }

  const verified = verifyRollingQrToken(token);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  if (isQrReplay(token)) {
    return NextResponse.json(
      { error: "Este código ya fue usado hace instantes (anti-copia / anti-replay)." },
      { status: 409 }
    );
  }

  const { data: inv } = await supabase
    .from("invitados")
    .select("id, evento_id, usuario_id, mesa_id, asistencia, ingresado, ingreso_at")
    .eq("id", verified.invitadoId)
    .single();

  if (
    !inv ||
    inv.evento_id.toLowerCase() !== verified.eventoId ||
    inv.id.toLowerCase() !== verified.invitadoId
  ) {
    return NextResponse.json({ error: "Invitación no encontrada o datos incoherentes." }, { status: 404 });
  }

  if (inv.asistencia !== "confirmado") {
    return NextResponse.json({ error: "Asistencia no confirmada para este invitado." }, { status: 403 });
  }

  const { data: eventoRow, error: evErr } = await supabase
    .from("eventos")
    .select("nombre, salon, direccion")
    .eq("id", inv.evento_id)
    .single();

  if (evErr || !eventoRow || !eventoPerteneceAlSalon(eventoRow, salonNombre, salonDireccion)) {
    return NextResponse.json(
      { error: "Este código no corresponde a un evento de tu salón." },
      { status: 403 }
    );
  }

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("nombre, apellido, dni")
    .eq("id", inv.usuario_id)
    .single();

  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  let mesaNumero: number | null = null;
  if (inv.mesa_id) {
    const { data: mesa } = await supabase
      .from("mesas")
      .select("numero")
      .eq("id", inv.mesa_id)
      .single();
    mesaNumero = mesa?.numero ?? null;
  }

  const hadIngresoPrevio = Boolean(inv.ingreso_at?.trim());
  const nowIso = new Date().toISOString();
  const ingresoAtFinal = hadIngresoPrevio ? inv.ingreso_at! : nowIso;

  const { error: upErr } = await supabase
    .from("invitados")
    .update({
      ingresado: true,
      ingreso_at: ingresoAtFinal,
    })
    .eq("id", inv.id);

  if (upErr) {
    console.warn("[validar-qr] no se pudo registrar ingreso:", upErr.message);
    return NextResponse.json(
      { error: "Validación correcta pero no se pudo registrar el ingreso. Reintentá o avisá al administrador." },
      { status: 500 }
    );
  }

  const payload: ValidarQrResponse = {
    nombre: `${usuario.nombre} ${usuario.apellido}`.trim(),
    dni: usuario.dni,
    mesa: mesaNumero,
    evento: eventoRow.nombre ?? "Evento",
    verified: "rolling-hmac",
    ingresoAt: ingresoAtFinal,
    primerIngreso: !hadIngresoPrevio,
  };

  return NextResponse.json(payload);
}
