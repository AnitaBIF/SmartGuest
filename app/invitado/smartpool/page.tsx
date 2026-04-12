"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";

type Rol = "conductor" | "pasajero" | "no" | null;

type ParejaInfo = {
  id: string;
  nombre: string;
  rol: string | null;
  yoAcepte: boolean;
  elAcepto: boolean;
  mutuo: boolean;
  telefono: string | null;
};

type SugerenciaPasajero = {
  invitadoId: string;
  nombre: string;
  localidad: string | null;
  direccion: string | null;
};

type SmartpoolEstado = {
  rol: Rol;
  tieneTelefono: boolean;
  pareja: ParejaInfo | null;
  /** Solo conductor: pasajeros con `smartpool_pareja_invitado_id` = mi id. */
  pasajeros: ParejaInfo[];
  cuposMax: number | null;
  cuposOcupados: number | null;
  sugerencias: SugerenciaPasajero[];
  /** Invitación > 5 personas: sin EcoGuest / SmartPool. */
  ecoInvitacionSinCarpooling: boolean;
  grupoCuposInvitacion: number | null;
};

function CheckTile({ checked }: { checked: boolean }) {
  return (
    <span
      className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded border-2 transition-colors"
      style={{ borderColor: "#2d5a41", backgroundColor: checked ? "#2d5a41" : "#e8f5ed" }}
      aria-hidden
    >
      {checked && (
        <svg viewBox="0 0 12 10" className="h-3 w-3" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="1 5 4.5 9 11 1" />
        </svg>
      )}
    </span>
  );
}

export default function SmartpoolPage() {
  const [rolElegido, setRolElegido] = useState<Rol>(null);
  const [enrolled, setEnrolled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salirLoading, setSalirLoading] = useState(false);
  const [aceptarLoading, setAceptarLoading] = useState(false);
  const [verMatch, setVerMatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<SmartpoolEstado | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  /** Tras guardar "No me interesa", mostramos una pantalla amable; true = volver al formulario de opciones. */
  const [mostrarFormEleccion, setMostrarFormEleccion] = useState(true);
  const [elegirLoading, setElegirLoading] = useState<string | null>(null);
  const [quitarPasajeroLoading, setQuitarPasajeroLoading] = useState<string | null>(null);
  /** Mismo `evento.id` que “Datos del Evento”; alinea SmartPool con ese evento si hay varias invitaciones. */
  const [eventoContextId, setEventoContextId] = useState<string | null>(null);
  const [contextReady, setContextReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/invitado/evento", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { evento?: { id?: string } } | null) => {
        if (cancelled) return;
        const id = typeof data?.evento?.id === "string" ? data.evento.id : null;
        setEventoContextId(id);
        setContextReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setEventoContextId(null);
        setContextReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cargar = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    const qs = eventoContextId ? `?eventoId=${encodeURIComponent(eventoContextId)}` : "";
    const r = await fetch(`/api/invitado/smartpool${qs}`, { cache: "no-store" });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      setEstado(null);
      setEnrolled(false);
      return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "No se pudo cargar el estado.",
      };
    }
    const sugRaw = data.sugerencias;
    const sugerencias: SugerenciaPasajero[] = Array.isArray(sugRaw)
      ? (sugRaw as unknown[])
          .filter((x): x is Record<string, unknown> => {
            if (typeof x !== "object" || x === null) return false;
            const o = x as Record<string, unknown>;
            return typeof o.invitadoId === "string" && typeof o.nombre === "string";
          })
          .map((x) => ({
            invitadoId: x.invitadoId as string,
            nombre: x.nombre as string,
            localidad: typeof x.localidad === "string" || x.localidad === null ? (x.localidad as string | null) : null,
            direccion:
              typeof x.direccion === "string" || x.direccion === null ? (x.direccion as string | null) : null,
          }))
      : [];
    const pasRaw = data.pasajeros;
    const pasajeros: ParejaInfo[] = Array.isArray(pasRaw)
      ? (pasRaw as unknown[])
          .filter((x): x is Record<string, unknown> => {
            if (typeof x !== "object" || x === null) return false;
            const o = x as Record<string, unknown>;
            return typeof o.id === "string" && typeof o.nombre === "string";
          })
          .map((x) => ({
            id: x.id as string,
            nombre: x.nombre as string,
            rol: typeof x.rol === "string" || x.rol === null ? (x.rol as string | null) : null,
            yoAcepte: x.yoAcepte === true,
            elAcepto: x.elAcepto === true,
            mutuo: x.mutuo === true,
            telefono: typeof x.telefono === "string" || x.telefono === null ? (x.telefono as string | null) : null,
          }))
      : [];

    const cuposMax =
      typeof data.cuposMax === "number" && Number.isFinite(data.cuposMax) ? Math.floor(data.cuposMax) : null;
    const cuposOcupados =
      typeof data.cuposOcupados === "number" && Number.isFinite(data.cuposOcupados)
        ? Math.floor(data.cuposOcupados)
        : null;

    const ecoInvitacionSinCarpooling = data.ecoInvitacionSinCarpooling === true;
    const grupoCuposInvitacion =
      typeof data.grupoCuposInvitacion === "number" && Number.isFinite(data.grupoCuposInvitacion)
        ? Math.floor(data.grupoCuposInvitacion)
        : null;

    setEstado({
      rol: data.rol as Rol,
      tieneTelefono: !!data.tieneTelefono,
      pareja: data.pareja ?? null,
      pasajeros,
      cuposMax,
      cuposOcupados,
      sugerencias,
      ecoInvitacionSinCarpooling,
      grupoCuposInvitacion,
    });
    setMsg(null);
    const srv = data.rol as "conductor" | "pasajero" | "no" | null | undefined;
    if (ecoInvitacionSinCarpooling) {
      setRolElegido(null);
      setEnrolled(false);
      setMostrarFormEleccion(false);
    } else if (srv === "conductor" || srv === "pasajero" || srv === "no") {
      setRolElegido(srv);
      const rActivo = srv === "conductor" || srv === "pasajero";
      setEnrolled(rActivo);
      if (srv === "no") setMostrarFormEleccion(false);
      else setMostrarFormEleccion(true);
    } else {
      setRolElegido(null);
      setEnrolled(false);
      setMostrarFormEleccion(true);
    }
    return { ok: true };
  }, [eventoContextId]);

  useEffect(() => {
    if (!contextReady) return;
    void cargar().then((res) => {
      if (!res.ok && res.error) setBootError(res.error);
      setLoading(false);
    });
  }, [contextReady, cargar]);

  useEffect(() => {
    if (!enrolled) return;
    if (estado?.rol === "pasajero" && estado?.pareja?.mutuo) return;
    const id = setInterval(() => void cargar(), 12_000);
    return () => clearInterval(id);
  }, [enrolled, estado?.rol, estado?.pareja?.mutuo, cargar]);

  const handleGuardar = async () => {
    if (rolElegido == null) return;
    setSaving(true);
    setMsg(null);
    setBootError(null);
    try {
      const res = await fetch("/api/invitado/smartpool", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rol: rolElegido,
          ...(eventoContextId ? { eventoId: eventoContextId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "No se pudo guardar. Reintentá.");
      } else {
        if (rolElegido === "no") setMostrarFormEleccion(false);
        const r = await cargar();
        if (!r.ok && r.error) setMsg(r.error);
      }
    } catch {
      setMsg("Error de conexión.");
    }
    setSaving(false);
  };

  const handleSalir = async () => {
    if (
      !confirm(
        "¿Dejar de participar en EcoGuest / SmartPool? Si sos conductor, se liberan los pasajeros de tu viaje; si sos pasajero, se cancela tu vínculo actual.",
      )
    )
      return;
    setSalirLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/invitado/smartpool", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rol: "no",
          ...(eventoContextId ? { eventoId: eventoContextId } : {}),
        }),
      });
      if (res.ok) {
        setEnrolled(false);
        setVerMatch(false);
        await cargar();
      }
    } catch {
      /* ignore */
    }
    setSalirLoading(false);
  };

  const handleElegirPasajero = async (invitadoId: string) => {
    setElegirLoading(invitadoId);
    setMsg(null);
    try {
      const res = await fetch("/api/invitado/smartpool/elegir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          pasajeroInvitadoId: invitadoId,
          ...(eventoContextId ? { eventoId: eventoContextId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "No se pudo enviar la propuesta.");
        setElegirLoading(null);
        return;
      }
      await cargar();
    } catch {
      setMsg("Error de conexión.");
    }
    setElegirLoading(null);
  };

  const handleAceptar = async (aceptar: boolean, pasajeroInvitadoId?: string) => {
    if (pasajeroInvitadoId) setQuitarPasajeroLoading(pasajeroInvitadoId);
    else setAceptarLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/invitado/smartpool/aceptar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aceptar,
          ...(eventoContextId ? { eventoId: eventoContextId } : {}),
          ...(pasajeroInvitadoId ? { pasajeroInvitadoId } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "No se pudo actualizar.");
        return;
      }
      await cargar();
    } catch {
      setMsg("Error de conexión.");
    }
    setAceptarLoading(false);
    setQuitarPasajeroLoading(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
          <Sidebar />
          <main className="flex flex-1 items-center justify-center">
            <p className="text-[#9ca3af]">Cargando...</p>
          </main>
        </div>
      </div>
    );
  }

  if (estado?.ecoInvitacionSinCarpooling) {
    const n = estado.grupoCuposInvitacion;
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
          <Sidebar />
          <main className="flex flex-1 items-start justify-center pb-8 pt-4">
            <div className="w-full max-w-md rounded-3xl border border-amber-200 bg-amber-50/90 p-8 text-center shadow ring-1 ring-amber-100">
              <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100 text-4xl">
                🚌
              </div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-amber-900/80">EcoGuest</p>
              <h2 className="mb-3 text-xl font-extrabold text-amber-950">No disponible para tu invitación</h2>
              <p className="text-left text-[13px] leading-relaxed text-amber-950/90">
                Tu invitación está cargada con{" "}
                <strong>
                  {typeof n === "number" && n > 0
                    ? `${n} persona${n === 1 ? "" : "s"}`
                    : "más de 5 personas"}
                </strong>
                . Las invitaciones de <strong>más de 5 personas</strong> no tienen acceso a la insignia EcoGuest ni al
                SmartPool (límite del carpooling en la app).
              </p>
              <p className="mt-4 text-left text-[12px] leading-relaxed text-amber-900/85">
                Si el número no es correcto, pedile al anfitrión que ajuste la columna <strong>Cupos</strong> en tu fila
                (máximo 5 para poder usar EcoGuest).
              </p>
              <Link
                href="/invitado"
                className="mt-8 inline-flex w-full items-center justify-center rounded-xl py-3 text-[14px] font-bold text-white transition hover:brightness-105"
                style={{ backgroundColor: "#2d5a41" }}
              >
                Volver al panel
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (enrolled && estado?.rol && estado.rol !== "no") {
    const { rol } = estado;
    const p = estado.pareja;
    const pasajeros = estado.pasajeros ?? [];
    const cuposMax = estado.cuposMax ?? 0;
    const cuposOcupados = estado.cuposOcupados ?? pasajeros.length;
    const hayCuposLibres = rol === "conductor" && cuposMax > 0 && cuposOcupados < cuposMax;
    const otroRolLabel = rol === "conductor" ? "pasajero" : "conductor";

    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
          <Sidebar />
          <main className="flex flex-1 items-start justify-center pb-8 pt-4">
            <div className="w-full max-w-md rounded-3xl bg-[#f0f7f2] p-8 text-center shadow ring-1 ring-[#c5dece]">
              {!verMatch ? (
                <>
                  <div className="relative mx-auto mb-4 h-36 w-36">
                    <Image src="/ecoguest-badge.png" alt="EcoGuest" fill className="object-contain" />
                  </div>
                  <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                    {rol === "conductor" ? "Conductor" : "Pasajero"}
                  </p>
                  <h2 className="mb-4 text-xl font-bold text-[#2d5a41]">¡Tu insignia EcoGuest!</h2>
                  <p className="mb-6 text-[13px] leading-relaxed text-[#4b5563]">
                    {rol === "conductor" ? (
                      cuposMax === 0 ? (
                        <>
                          Tu invitación contempla <strong>5 personas</strong>: no quedan plazas para sumar pasajeros del
                          pool, pero <strong>seguís siendo EcoGuest</strong> como conductor. El teléfono se comparte con
                          quienes ya vinculaste.
                        </>
                      ) : (
                        <>
                          Podés proponer viaje a <strong>hasta {cuposMax} pasajero{cuposMax === 1 ? "" : "s"}</strong> del
                          pool (según los cupos de tu invitación; hasta 5 personas en total entre tu grupo y el
                          carpooling). El teléfono se comparte cuando cada pasajero acepta en la app.
                        </>
                      )
                    ) : (
                      <>
                        Podés coordinar viaje compartido con un conductor del evento. El contacto completo se muestra
                        cuando <strong>aceptás la propuesta</strong> (el conductor ya te eligió).
                      </>
                    )}
                  </p>
                  {rol === "conductor" && (
                    <p className="mb-4 rounded-xl bg-white/90 px-3 py-2 text-left text-[12px] leading-snug text-[#374151] ring-1 ring-[#c5dece]">
                      <strong className="text-[#2d5a41]">Lugares en el pool:</strong>{" "}
                      {cuposMax === 0
                        ? "ninguno (tu invitación ya usa las 5 plazas del modelo de auto)."
                        : `${cuposOcupados} de ${cuposMax} ocupados.`}
                      {cuposMax > 0 &&
                        (hayCuposLibres
                          ? " Elegí pasajeros de la lista: ves nombre y dirección que cargaron al confirmar; solo quienes ya confirmaron asistencia."
                          : cuposOcupados > 0
                            ? " Llenaste el cupo. Podés quitar un pasajero desde “Ver estado del viaje” para liberar un lugar."
                            : " Elegí pasajeros desde “Ver estado del viaje”.")}
                    </p>
                  )}
                  {rol === "pasajero" && !p && (
                    <p className="mb-4 rounded-xl bg-white/90 px-3 py-2 text-left text-[12px] leading-snug text-[#374151] ring-1 ring-[#c5dece]">
                      Cuando un conductor te proponga viaje, lo vas a ver en el siguiente paso y podrás aceptar.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => setVerMatch(true)}
                    className="text-[13px] font-semibold underline underline-offset-2"
                    style={{ color: "#2d5a41" }}
                  >
                    {rol === "conductor" ? "Ver estado del viaje y pasajeros" : `Ver estado del match y mi ${otroRolLabel}`}
                  </button>

                  <div className="mt-8 border-t border-[#d1e7d9] pt-6">
                    <button
                      type="button"
                      disabled={salirLoading}
                      onClick={() => void handleSalir()}
                      className="w-full rounded-xl border-2 border-[#b91c1c] py-3 text-[13px] font-semibold text-[#b91c1c] transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      {salirLoading ? "Procesando…" : "Dejar de ser conductor / pasajero"}
                    </button>
                    <p className="mt-2 text-[11px] text-[#6b7280]">
                      {rol === "conductor"
                        ? "Volvés a “no participo” y se liberan los pasajeros vinculados a tu viaje."
                        : "Volvés al estado “no participo” y quedás libre para otro match."}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="mb-2 text-xl font-bold text-[#2d5a41]">
                    {rol === "conductor" ? "SmartPool · tu viaje" : `SmartPool · tu ${otroRolLabel}`}
                  </h2>
                  <p className="mb-6 text-[12px] text-[#6b7280]">
                    Sos <strong>{rol}</strong>.{" "}
                    {rol === "conductor"
                      ? cuposMax === 0
                        ? "Tu invitación no deja plazas extra en el pool: no vas a ver sugerencias nuevas. Si ya tenés pasajeros vinculados, los ves abajo."
                        : `Podés llevar hasta ${cuposMax} pasajero${cuposMax === 1 ? "" : "s"} del pool. La lista sugerida va por cercanía aproximada; cada uno acepta en la app para compartir teléfono.`
                      : "Un conductor puede proponerte viaje; cuando lo haga, verás su nombre acá y podrás aceptar. Mantené cargado tu celular."}
                  </p>

                  {msg && (
                    <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-left text-[12px] text-amber-900 ring-1 ring-amber-200">
                      {msg}
                    </div>
                  )}
                  {rol === "conductor" ? (
                    <div className="mb-6 space-y-4">
                      {pasajeros.length > 0 ? (
                        <div className="rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-[#c5dece]">
                          <p className="text-[13px] font-semibold text-[#374151]">
                            Pasajeros ({cuposOcupados}/{cuposMax === 0 ? "—" : cuposMax})
                          </p>
                          <ul className="mt-3 space-y-4">
                            {pasajeros.map((px) => {
                              const prim = px.nombre.split(" ")[0] ?? px.nombre;
                              return (
                                <li
                                  key={px.id}
                                  className="rounded-xl border border-[#d1e7d9] bg-[#f7faf8] px-3 py-3"
                                >
                                  <p className="text-[13px] font-semibold text-[#111827]">{px.nombre}</p>
                                  {!px.mutuo ? (
                                    <>
                                      <p className="mt-1 text-[12px] text-[#1e40af]">
                                        Esperando que {prim} acepte en su cuenta para compartir teléfonos.
                                      </p>
                                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                        <span className="rounded-full bg-[#dcfce7] px-2 py-0.5 font-medium text-[#166534]">
                                          Vos: propuesta enviada
                                        </span>
                                        <span
                                          className={`rounded-full px-2 py-0.5 font-medium ${
                                            px.elAcepto ? "bg-[#dcfce7] text-[#166534]" : "bg-[#f3f4f6] text-[#6b7280]"
                                          }`}
                                        >
                                          {prim}: {px.elAcepto ? "aceptó" : "pendiente"}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={quitarPasajeroLoading !== null || salirLoading || elegirLoading !== null}
                                        onClick={() => void handleAceptar(false, px.id)}
                                        className="mt-3 w-full rounded-lg border border-[#d1d5db] py-2 text-[12px] font-semibold text-[#374151] hover:bg-white disabled:opacity-40"
                                      >
                                        {quitarPasajeroLoading === px.id ? "…" : "Cancelar propuesta"}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[#166534]">
                                        Match confirmado
                                      </p>
                                      <p className="mt-1 text-[13px] text-[#4b5563]">
                                        Celular:{" "}
                                        {px.telefono ? (
                                          <a
                                            href={`tel:${px.telefono.replace(/\s+/g, "")}`}
                                            className="font-semibold text-[#2d5a41] underline"
                                          >
                                            {px.telefono}
                                          </a>
                                        ) : (
                                          <span className="text-[#9ca3af]">(aún no cargó número)</span>
                                        )}
                                      </p>
                                      <button
                                        type="button"
                                        disabled={quitarPasajeroLoading !== null || salirLoading || elegirLoading !== null}
                                        onClick={() => void handleAceptar(false, px.id)}
                                        className="mt-3 w-full rounded-lg border border-[#b91c1c]/40 py-2 text-[12px] font-semibold text-[#b91c1c] hover:bg-red-50 disabled:opacity-40"
                                      >
                                        {quitarPasajeroLoading === px.id ? "…" : "Quitar de mi viaje"}
                                      </button>
                                    </>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ) : null}

                      {hayCuposLibres ? (
                        <div className="space-y-4 rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-[#c5dece]">
                          <p className="text-[13px] font-medium text-[#374151]">Sugerencias de pasajeros</p>
                          <p className="text-[12px] text-[#6b7280]">
                            Solo invitados con <strong>asistencia confirmada</strong>. Debajo ves la dirección que cargaron
                            al confirmar.
                          </p>
                          {!estado.tieneTelefono && (
                            <p className="text-[12px] text-[#b45309]">
                              Para proponer un pasajero necesitás tu celular en{" "}
                              <Link href="/invitado/configuracion" className="font-semibold underline">
                                Configuración
                              </Link>
                              .
                            </p>
                          )}
                          {estado.sugerencias.length === 0 ? (
                            <div className="space-y-2 text-[13px] text-[#4b5563]">
                              <p>
                                No hay más pasajeros disponibles por ahora: tienen que haber{" "}
                                <strong>confirmado asistencia</strong>, estar libres en el pool y no ser vos.
                              </p>
                              <p className="text-[12px] text-[#6b7280]">
                                Quienes no abrieron SmartPool pueden aparecer igual; si los elegís, quedan como pasajero.
                              </p>
                            </div>
                          ) : (
                            <ul className="space-y-3">
                              {estado.sugerencias.map((s) => (
                                <li
                                  key={s.invitadoId}
                                  className="rounded-xl border border-[#d1e7d9] bg-[#f7faf8] px-3 py-3"
                                >
                                  <p className="text-[13px] font-semibold text-[#111827]">{s.nombre}</p>
                                  <p className="mt-1 text-[12px] leading-snug text-[#374151]">
                                    {s.direccion?.trim() ? s.direccion.trim() : "Sin dirección cargada"}
                                  </p>
                                  {s.localidad?.trim() ? (
                                    <p className="text-[11px] text-[#6b7280]">{s.localidad.trim()}</p>
                                  ) : null}
                                  <button
                                    type="button"
                                    disabled={
                                      !estado.tieneTelefono ||
                                      elegirLoading !== null ||
                                      aceptarLoading ||
                                      quitarPasajeroLoading !== null ||
                                      salirLoading
                                    }
                                    onClick={() => void handleElegirPasajero(s.invitadoId)}
                                    className="mt-2 w-full rounded-lg py-2 text-[12px] font-bold text-white disabled:opacity-40"
                                    style={{ backgroundColor: "#2d5a41" }}
                                  >
                                    {elegirLoading === s.invitadoId
                                      ? "Enviando…"
                                      : "Proponer viaje a esta persona"}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ) : pasajeros.length > 0 ? (
                        <div className="rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-[#c5dece]">
                          <p className="text-[13px] text-[#4b5563]">
                            {cuposMax === 0
                              ? "Tu invitación no permite sumar pasajeros del pool; los que figuran arriba son los que ya vinculaste."
                              : `Tenés el cupo completo (${cuposMax} pasajero${cuposMax === 1 ? "" : "s"}). Quitá a alguien de la lista de arriba para liberar un lugar y ver sugerencias otra vez.`}
                          </p>
                        </div>
                      ) : cuposMax === 0 ? (
                        <div className="rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-[#c5dece]">
                          <p className="text-[13px] text-[#4b5563]">
                            No hay plazas en el pool para tu invitación (5 personas en total). Seguís como EcoGuest
                            conductor; no se muestran sugerencias nuevas.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : !p ? (
                    <div className="mb-6 space-y-4 rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-[#c5dece]">
                      <div className="space-y-3">
                        <p className="text-[13px] text-[#4b5563]">
                          Todavía ningún conductor te eligió. Esta pantalla se actualiza sola cada pocos segundos. Cuando
                          alguien te proponga viaje, vas a ver su nombre y el botón para aceptar.
                        </p>
                        <p className="text-[12px] text-[#6b7280]">
                          Los conductores te ordenan con la dirección y localidad que cargaste al confirmar la invitación.
                        </p>
                      </div>
                    </div>
                  ) : !p.mutuo ? (
                    <div className="mb-6 space-y-4 rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-[#c5dece]">
                      <p className="text-[13px] font-semibold text-[#111827]">{p.nombre}</p>
                      <p className="text-[12px] text-[#6b7280]">
                        Rol en el pool: <strong>{p.rol === "conductor" ? "Conductor" : "Pasajero"}</strong>
                      </p>
                      <p className="text-[12px] text-[#4b5563]">
                        El teléfono del conductor se muestra cuando <strong>aceptás</strong> y tenés celular cargado en
                        Configuración.
                      </p>
                      {rol === "pasajero" && !p.yoAcepte && p.elAcepto && (
                        <p className="text-[12px] text-[#1e40af]">
                          Un conductor te propuso compartir viaje. Si aceptás, podrán verse los teléfonos al confirmar
                          ambos.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 text-[11px]">
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            p.yoAcepte ? "bg-[#dcfce7] text-[#166534]" : "bg-[#f3f4f6] text-[#6b7280]"
                          }`}
                        >
                          Vos: {p.yoAcepte ? "aceptaste" : "pendiente"}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-medium ${
                            p.elAcepto ? "bg-[#dcfce7] text-[#166534]" : "bg-[#f3f4f6] text-[#6b7280]"
                          }`}
                        >
                          {p.nombre.split(" ")[0]}: {p.elAcepto ? "aceptó" : "pendiente"}
                        </span>
                      </div>

                      {!estado.tieneTelefono && (
                        <p className="text-[12px] text-[#b45309]">
                          Para aceptar necesitás cargar tu celular en{" "}
                          <Link href="/invitado/configuracion" className="font-semibold underline">
                            Configuración
                          </Link>
                          .
                        </p>
                      )}

                      <div className="flex flex-col gap-2 pt-2">
                        {!p.yoAcepte ? (
                          <button
                            type="button"
                            disabled={aceptarLoading || !estado.tieneTelefono}
                            onClick={() => void handleAceptar(true)}
                            className="rounded-xl py-3 text-[13px] font-bold text-white disabled:opacity-40"
                            style={{ backgroundColor: "#2d5a41" }}
                          >
                            {aceptarLoading ? "…" : `Aceptar a ${p.rol === "conductor" ? "este conductor" : "este pasajero"}`}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={aceptarLoading}
                            onClick={() => void handleAceptar(false)}
                            className="rounded-xl border border-[#d1d5db] py-2.5 text-[12px] font-semibold text-[#374151] hover:bg-white"
                          >
                            Retirar mi aceptación
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mb-6 space-y-4 rounded-2xl bg-white px-5 py-4 text-left ring-1 ring-[#c5dece]">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[#166534]">Match confirmado</p>
                      <p className="text-[15px] font-bold text-[#111827]">{p.nombre}</p>
                      <p className="text-[13px] text-[#4b5563]">
                        Celular:{" "}
                        {p.telefono ? (
                          <a href={`tel:${p.telefono.replace(/\s+/g, "")}`} className="font-semibold text-[#2d5a41] underline">
                            {p.telefono}
                          </a>
                        ) : (
                          <span className="text-[#9ca3af]">(tu pareja aún no cargó número)</span>
                        )}
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setVerMatch(false)}
                    className="mb-4 text-[13px] font-semibold underline underline-offset-2"
                    style={{ color: "#2d5a41" }}
                  >
                    ← Volver a mi insignia
                  </button>

                  <button
                    type="button"
                    disabled={salirLoading}
                    onClick={() => void handleSalir()}
                    className="w-full rounded-xl border-2 border-[#b91c1c] py-2.5 text-[12px] font-semibold text-[#b91c1c] hover:bg-red-50 disabled:opacity-50"
                  >
                    {salirLoading ? "…" : "Dejar de participar en SmartPool"}
                  </button>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (estado?.rol === "no" && !mostrarFormEleccion) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
          <Sidebar />
          <main className="flex flex-1 flex-col items-center pb-8 pt-4">
            <h1 className="mb-6 self-end text-2xl font-bold text-brand">SmartPool</h1>

            <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-[#c5dece]">
              <div
                className="relative px-8 pb-10 pt-12 text-center text-white"
                style={{
                  background: "linear-gradient(155deg, #1e4d36 0%, #2d5a41 45%, #3d7a58 100%)",
                }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-[0.12]"
                  style={{
                    backgroundImage: "radial-gradient(circle at 20% 20%, #fff 0%, transparent 45%), radial-gradient(circle at 80% 80%, #a7f3d0 0%, transparent 40%)",
                  }}
                />
                <div className="relative">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-3xl shadow-inner ring-1 ring-white/20 backdrop-blur-sm">
                    🌿
                  </div>
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-100/90">EcoGuest</p>
                  <h2 className="text-xl font-extrabold leading-snug">Listo, respetamos tu decisión</h2>
                  <p className="mx-auto mt-3 max-w-[280px] text-[13px] leading-relaxed text-emerald-50/95">
                    Si cambiás de idea, podés sumarte cuando quieras: compartir viaje ahorra, conecta con otros invitados y
                    suma al cuidado del entorno.
                  </p>
                </div>
              </div>

              <div className="space-y-5 bg-[#f7faf8] px-8 py-8">
                <p className="text-center text-[13px] leading-relaxed text-[#4b5563]">
                  <span className="font-semibold text-[#374151]">Todavía podés cambiar de opinión.</span> No hay compromiso
                  fijo: elegí de nuevo cuando te pinte.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMostrarFormEleccion(true);
                    setMsg(null);
                  }}
                  className="group w-full rounded-2xl py-3.5 text-[14px] font-bold text-white shadow-md transition hover:brightness-110 active:scale-[0.99]"
                  style={{ backgroundColor: "#2d5a41" }}
                >
                  <span className="block">Tocá acá para volver a elegir</span>
                  <span className="mt-0.5 block text-[11px] font-semibold text-emerald-100/90 group-hover:text-white">
                    Conductor · Pasajero · No me interesa
                  </span>
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
        <Sidebar />
        <main className="flex flex-1 flex-col items-center pb-8 pt-4">
          <h1 className="mb-6 self-end text-2xl font-bold text-brand">SmartPool</h1>

          <div className="w-full max-w-md rounded-3xl bg-[#f0f7f2] px-8 py-8 shadow ring-1 ring-[#c5dece]">
            <div className="relative mx-auto mb-4 h-28 w-28">
              <Image src="/ecoguest-badge.png" alt="EcoGuest" fill className="object-contain" />
            </div>

            <h2 className="mb-2 text-center text-lg font-extrabold text-[#2d5a41]">
              ¡Convertite en un EcoGuest y viajá inteligente!
            </h2>
            <p className="mb-6 text-center text-[13px] leading-relaxed text-[#4b5563]">
              Ahorrá, conocé gente y cuidá el planeta.
              <br />
              Los conductores eligen pasajeros sugeridos según dirección y localidad (Gran Tucumán); el pasajero acepta
              en la app. El contacto se muestra solo con match mutuo.
            </p>

            <div className="mb-6 rounded-2xl border border-[#c5dece] bg-white/90 px-4 py-3.5 text-center shadow-sm ring-1 ring-[#2d5a41]/10">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#2d5a41]">EcoGuest y tu evento</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#374151]">
                Si te sumás a <strong>EcoGuest</strong> como <strong>conductor</strong> o <strong>pasajero</strong>, podés
                obtener un <strong>premio</strong> elegido por los <strong>organizadores del evento</strong> (según las
                bases que definan ellos).
              </p>
            </div>

            <p className="mb-4 text-center text-[13px] font-semibold text-[#374151]">¿Te gustaría ser parte de EcoGuest?</p>

            {bootError && (
              <div className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] text-red-700 ring-1 ring-red-200">
                {bootError}
              </div>
            )}

            <div className="mb-6 space-y-2">
              {(
                [
                  { value: "conductor" as const, label: "Como conductor" },
                  { value: "pasajero" as const, label: "Como pasajero" },
                  { value: "no" as const, label: "No me interesa" },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setRolElegido(value);
                    setMsg(null);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    rolElegido === value ? "bg-white ring-2 ring-[#2d5a41] ring-offset-1 ring-offset-[#f0f7f2]" : "hover:bg-white/60"
                  }`}
                >
                  <CheckTile checked={rolElegido === value} />
                  <span className="text-[13px] text-[#374151]">{label}</span>
                </button>
              ))}
            </div>

            {msg && (
              <div className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-[12px] text-amber-900 ring-1 ring-amber-200">
                {msg}
              </div>
            )}

            <button
              type="button"
              disabled={rolElegido == null || saving}
              onClick={() => void handleGuardar()}
              className="w-full rounded-xl py-3 text-base font-bold text-white transition-colors disabled:opacity-40"
              style={{ backgroundColor: "#2d5a41" }}
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
