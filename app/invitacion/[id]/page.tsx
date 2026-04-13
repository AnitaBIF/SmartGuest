"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { LeyendaObligatorios, Req } from "@/components/FormRequired";
import { dniValido } from "@/lib/registroSalon";
import {
  ECOGUEST_MAX_PERSONAS_INVITACION,
  MENU_FORM_OPTIONS,
  ecoGuestPermitidoPorCuposInvitacion,
  plazasSmartpoolPasajeros,
} from "@/lib/grupoFamiliar";

function Logo() {
  return (
    <span className="text-xl font-extrabold tracking-tight text-[#2d5a41]">
      SMART
      <span className="ml-1 font-normal" style={{ fontFamily: "var(--font-poppins)", color: "#2d5a41" }}>
        GUEST
      </span>
    </span>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-0">
      <label className="w-full text-[13px] text-[#374151] sm:w-44 sm:text-right sm:pr-4">
        {label}
        {required ? <Req /> : null}
      </label>
      {children}
    </div>
  );
}

const inp = "flex-1 rounded-full border border-[#c5dece] bg-white px-4 py-2 text-[13px] text-foreground outline-none focus:border-[#2d5a41] focus:ring-2 focus:ring-[#2d5a41]/20";

type Paso = "loading" | "bienvenida" | "formulario" | "confirmado" | "error";

type InvitadoPrecargado = {
  nombreCompleto: string;
  telefono: string | null;
  dniConocido: string | null;
};

type EventoInfo = {
  id: string;
  /** Presente cuando el enlace es por invitado (Excel/manual); el registro actualiza esa fila. */
  invitadoId: string | null;
  invitadoPrecargado: InvitadoPrecargado | null;
  /** Cupos máximos que definió el anfitrión para esta invitación (grupo familiar). */
  grupoCuposMax: number;
  nombre: string;
  anfitriones: string;
  fecha: string;
  horario: string;
  salon: string;
  direccion: string;
  dressCode: string | null;
  /** Ninguna + menús especiales configurados para este evento. */
  menuOpciones: string[];
};

type MenuFila = { restriccion: string; restriccionOtro: string };

export default function InvitacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [paso,    setPaso]    = useState<Paso>("loading");
  const [evento,  setEvento]  = useState<EventoInfo | null>(null);
  const [asiste,  setAsiste]  = useState<boolean | null>(null);
  const [error,   setError]   = useState("");
  const [saving,  setSaving]  = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    dni: "",
    direccion: "",
    localidad: "",
    cancion: "",
    email: "",
    contrasena: "",
  });
  const [grupoPersonas, setGrupoPersonas] = useState(1);
  const [menusGrupo, setMenusGrupo] = useState<MenuFila[]>([
    { restriccion: "Ninguna", restriccionOtro: "" },
  ]);

  useEffect(() => {
    fetch(`/api/invitacion/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        const invitadoPrecargado: InvitadoPrecargado | null = data.invitadoPrecargado ?? null;
        const grupoCuposMax =
          typeof data.grupoCuposMax === "number" && Number.isFinite(data.grupoCuposMax)
            ? Math.min(20, Math.max(1, Math.floor(data.grupoCuposMax)))
            : 1;
        const menuOpciones =
          Array.isArray(data.menuOpciones) && data.menuOpciones.length > 0
            ? (data.menuOpciones as string[])
            : [...MENU_FORM_OPTIONS];
        setEvento({
          ...data,
          invitadoId: data.invitadoId ?? null,
          invitadoPrecargado,
          grupoCuposMax,
          menuOpciones,
        });
        if (invitadoPrecargado?.nombreCompleto) {
          setForm((f) => ({
            ...f,
            nombre: invitadoPrecargado.nombreCompleto,
            dni: invitadoPrecargado.dniConocido ?? "",
          }));
        } else if (invitadoPrecargado?.dniConocido) {
          setForm((f) => ({ ...f, dni: invitadoPrecargado.dniConocido! }));
        }
        setGrupoPersonas(1);
        setMenusGrupo([{ restriccion: "Ninguna", restriccionOtro: "" }]);
        setPaso("bienvenida");
      })
      .catch(() => setPaso("error"));
  }, [id]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    setMenusGrupo((prev) => {
      const next = prev.slice(0, grupoPersonas);
      while (next.length < grupoPersonas) {
        next.push({ restriccion: "Ninguna", restriccionOtro: "" });
      }
      return next;
    });
  }, [grupoPersonas]);

  const handleContinuar = () => {
    if (asiste === null) return;
    if (asiste) setPaso("formulario");
    else handleRegistrarNoAsiste();
  };

  const handleRegistrarNoAsiste = async () => {
    setPaso("confirmado");
  };

  const handleConfirmar = async () => {
    const precarga = evento?.invitadoPrecargado;
    const nombreOk = precarga?.nombreCompleto ? precarga.nombreCompleto.trim() : form.nombre.trim();
    const dniFuente = form.dni.trim() || precarga?.dniConocido?.trim() || "";
    if (!nombreOk || !form.email || !form.contrasena) {
      setError("Completá nombre, email y contraseña.");
      return;
    }
    if (!dniValido(dniFuente)) {
      setError("Completá un DNI válido (7 u 8 dígitos, sin puntos).");
      return;
    }
    if (!form.direccion.trim() || !form.localidad.trim()) {
      setError("Completá dirección y localidad.");
      return;
    }
    const cuposMax = evento?.grupoCuposMax ?? 4;
    if (grupoPersonas < 1 || grupoPersonas > cuposMax) {
      setError("La cantidad de personas no es válida para esta invitación.");
      return;
    }
    if (menusGrupo.length !== grupoPersonas) {
      setError("Actualizá el formulario de menús e intentá de nuevo.");
      return;
    }
    for (let i = 0; i < menusGrupo.length; i++) {
      const row = menusGrupo[i];
      if (row.restriccion === "Otro" && !row.restriccionOtro.trim()) {
        setError(`Completá la restricción “Otro” para la persona ${i + 1}.`);
        return;
      }
    }
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/invitado/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evento_id: evento?.id ?? id,
          ...(evento?.invitadoId ? { invitado_id: evento.invitadoId } : {}),
          nombre: nombreOk,
          dni: dniFuente,
          email: form.email,
          password: form.contrasena,
          direccion: form.direccion,
          localidad: form.localidad,
          grupoPersonasConfirmadas: grupoPersonas,
          menusGrupo: menusGrupo.map((m) => ({
            restriccion: m.restriccion,
            restriccionOtro: m.restriccion === "Otro" ? m.restriccionOtro.trim() || null : null,
          })),
          cancion: form.cancion,
          asiste: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error al registrar. Intentá de nuevo.");
        setSaving(false);
        return;
      }

      setPaso("confirmado");
    } catch {
      setError("Error de conexión. Intentá de nuevo.");
    } finally {
      setSaving(false);
    }
  };

  /* ─── Loading ─── */
  if (paso === "loading") {
    return (
      <Page>
        <Card>
          <p className="text-center text-[#9ca3af]">Cargando invitación...</p>
        </Card>
      </Page>
    );
  }

  /* ─── Error (evento no encontrado) ─── */
  if (paso === "error" || !evento) {
    return (
      <Page>
        <Card>
          <div className="flex flex-col items-center py-4 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-bold text-[#374151]">Invitación no válida</h1>
            <p className="text-[13px] text-[#6b7280]">El link de invitación no es válido o el evento ya no existe.</p>
          </div>
        </Card>
      </Page>
    );
  }

  /* ─── Paso 1: Bienvenida ─── */
  if (paso === "bienvenida") {
    return (
      <Page>
        <Card wide>
          <h1 className="mb-6 text-center text-3xl font-extrabold text-[#2d5a41] sm:text-4xl">
            Bienvenido/a!
          </h1>

          <p className="mb-4 text-center text-[14px] leading-relaxed text-[#374151]">
            Estás invitado al evento de <strong>{evento.anfitriones}</strong> el día{" "}
            <strong>{evento.fecha}</strong> a las <strong>{evento.horario} hs</strong>
          </p>

          {evento.nombre && (
            <p className="mb-6 text-center text-[13px] font-semibold text-[#2d5a41]">{evento.nombre}</p>
          )}

          <div className="mb-6 rounded-2xl border border-[#b8d4c4] bg-[#e8f5ed] px-4 py-3 text-center shadow-sm">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-[#2d5a41]">
              Cupos de esta invitación
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-[#1e4629]">
              {evento.grupoCuposMax <= 1 ? (
                <>
                  Esta invitación es para <strong className="text-[#14532d]">1 persona</strong>. Al confirmar vas a
                  completar los datos de quien asiste.
                </>
              ) : (
                <>
                  El anfitrión definió esta invitación para hasta{" "}
                  <strong className="text-[#14532d]">
                    {evento.grupoCuposMax} personas
                  </strong>
                  . En el siguiente paso vas a indicar cuántas confirman (vos incluido/a) y el menú de cada una.
                </>
              )}
            </p>
          </div>

          <p className="mb-4 text-center text-[14px] font-medium text-[#374151]">
            ¿Asistirá al evento?
          </p>

          <div className="mb-8 flex items-center justify-center gap-10">
            {([true, false] as const).map((val) => (
              <label key={String(val)} className="flex cursor-pointer items-center gap-2 text-[14px] font-semibold text-[#2d5a41]">
                <span>{val ? "SÍ" : "NO"}</span>
                <span
                  onClick={() => setAsiste(val)}
                  className="flex h-6 w-6 items-center justify-center rounded border-2 transition-colors"
                  style={{
                    borderColor: "#2d5a41",
                    backgroundColor: asiste === val ? "#2d5a41" : "#e8f5ed",
                  }}
                >
                  {asiste === val && (
                    <svg viewBox="0 0 12 10" className="h-3 w-3" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="1 5 4.5 9 11 1" />
                    </svg>
                  )}
                </span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={handleContinuar}
            disabled={asiste === null}
            className="w-full rounded-xl py-3 text-base font-bold text-white transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#2d5a41" }}
          >
            Continuar
          </button>
        </Card>
      </Page>
    );
  }

  /* ─── Paso 2: Formulario ─── */
  if (paso === "formulario") {
    const precarga = evento.invitadoPrecargado;
    const ocultarNombre = Boolean(precarga?.nombreCompleto);
    /** Enlace por fila de invitado: siempre pedimos DNI para poder corregirlo o evitar bloqueos si el de BD era inválido/duplicado. */
    const esInvitacionPersonal = Boolean(evento.invitadoId);
    const ocultarDni = Boolean(precarga?.dniConocido) && !esInvitacionPersonal;

    return (
      <Page>
        <Card wide>
          <h1 className="mb-4 text-center text-2xl font-extrabold leading-tight text-[#2d5a41] sm:text-3xl">
            Para confirmar<br />complete lo siguiente
          </h1>
          <LeyendaObligatorios className="mb-6 text-center text-[12px] text-[#6b7280]" />

          {error && (
            <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-center text-[13px] text-red-600 ring-1 ring-red-200">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {ocultarNombre ? (
              <div className="rounded-2xl border border-[#c5dece] bg-white/90 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2d5a41]">
                  Tus datos (listado del anfitrión)
                </p>
                <p className="mt-1 text-[14px] font-medium text-foreground">{precarga!.nombreCompleto}</p>
                {precarga?.telefono ? (
                  <p className="mt-1 text-[12px] text-[#4b5563]">
                    Celular: <span className="font-medium text-[#374151]">{precarga.telefono}</span>
                  </p>
                ) : null}
              </div>
            ) : (
              <Field label="Nombre y Apellido" required>
                <input className={inp} type="text" value={form.nombre} onChange={set("nombre")} />
              </Field>
            )}
            {!ocultarDni ? (
              <Field label="DNI" required>
                <input className={inp} type="text" value={form.dni} onChange={set("dni")} placeholder="Sin puntos ni espacios" />
              </Field>
            ) : null}
            <Field label="Dirección" required>
              <input className={inp} type="text" value={form.direccion} onChange={set("direccion")} autoComplete="street-address" />
            </Field>
            <Field label="Localidad" required>
              <input className={inp} type="text" value={form.localidad} onChange={set("localidad")} autoComplete="address-level2" />
            </Field>

            <Field label="Personas que confirman (vos incluido/a)" required>
              <div className="relative flex-1">
                <select
                  value={grupoPersonas}
                  onChange={(e) => setGrupoPersonas(Number(e.target.value))}
                  className={`${inp} w-full appearance-none pr-8`}
                >
                  {Array.from({ length: evento.grupoCuposMax }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-xs">
                  ⌄
                </span>
              </div>
            </Field>
            <p className="text-[11px] leading-relaxed text-[#6b7280] sm:pl-[calc(11rem+1rem)]">
              El anfitrión reservó hasta <strong className="text-[#374151]">{evento.grupoCuposMax}</strong> cupos para tu
              invitación. Indicá cuántas personas van en total (incluyéndote).
            </p>

            {ecoGuestPermitidoPorCuposInvitacion(evento.grupoCuposMax) && (
              <div className="rounded-2xl border border-[#b8d4c4] bg-[#e8f5ed] px-4 py-3 text-[12px] leading-relaxed text-[#1e4629] sm:ml-[calc(11rem+1rem)]">
                <strong>EcoGuest:</strong> tu invitación contempla hasta <strong>{evento.grupoCuposMax}</strong>{" "}
                persona(s). Si elegís ser conductor, podés ofrecer hasta{" "}
                <strong>{plazasSmartpoolPasajeros(evento.grupoCuposMax)}</strong> plaza(s) a otros invitados del pool (hasta{" "}
                <strong>5</strong> personas en total entre tu grupo y el carpooling).
              </div>
            )}
            {!ecoGuestPermitidoPorCuposInvitacion(evento.grupoCuposMax) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-950 sm:ml-[calc(11rem+1rem)]">
                Esta invitación supera las <strong>{ECOGUEST_MAX_PERSONAS_INVITACION}</strong> personas permitidas para
                EcoGuest: <strong>no vas a poder usar la insignia ni el SmartPool</strong>. El catering y la confirmación
                siguen igual.
              </div>
            )}

            <div className="pt-1">
              <p className="mb-2 text-[12px] font-semibold text-[#2d5a41] sm:pl-[calc(11rem+1rem)]">
                Menú / restricción por persona
              </p>
              <AnimatePresence initial={false} mode="popLayout">
                {menusGrupo.map((m, i) => (
                  <motion.div
                    key={`menu-${i}`}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className="space-y-2"
                  >
                    <Field label={`Persona ${i + 1}`} required>
                      <div className="relative flex-1">
                        <select
                          value={m.restriccion}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMenusGrupo((prev) =>
                              prev.map((row, j) =>
                                j === i
                                  ? {
                                      ...row,
                                      restriccion: v,
                                      restriccionOtro: v === "Otro" ? row.restriccionOtro : "",
                                    }
                                  : row,
                              ),
                            );
                          }}
                          className={`${inp} w-full appearance-none pr-8`}
                        >
                          {evento.menuOpciones.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-xs">
                          ⌄
                        </span>
                      </div>
                    </Field>
                    {m.restriccion === "Otro" && (
                      <Field label="">
                        <input
                          className={inp}
                          type="text"
                          placeholder="Especificá la restricción"
                          value={m.restriccionOtro}
                          onChange={(e) =>
                            setMenusGrupo((prev) =>
                              prev.map((row, j) => (j === i ? { ...row, restriccionOtro: e.target.value } : row)),
                            )
                          }
                        />
                      </Field>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <Field label="¿Qué canción no puede faltar?">
              <input className={inp} type="text" value={form.cancion} onChange={set("cancion")} />
            </Field>
            <Field label="Email" required>
              <input className={inp} type="email" value={form.email} onChange={set("email")} />
            </Field>
            <Field label="Contraseña" required>
              <input className={inp} type="password" value={form.contrasena} onChange={set("contrasena")} />
            </Field>
          </div>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={saving}
            className="mt-8 w-full rounded-xl py-3 text-base font-bold text-white transition-colors disabled:opacity-60"
            style={{ backgroundColor: "#2d5a41" }}
          >
            {saving ? "Registrando..." : "Confirmo"}
          </button>
        </Card>
      </Page>
    );
  }

  /* ─── Paso 3: Confirmado ─── */
  return (
    <Page>
      <Card>
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: "#dcfce7" }}>
            <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none"
              stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="mb-3 text-3xl font-extrabold text-[#2d5a41]">
            {asiste ? "¡Confirmado!" : "Respuesta registrada"}
          </h1>
          <p className="text-[14px] leading-relaxed text-[#4b5563]">
            {asiste
              ? <>Nos vemos el <strong>{evento.fecha}</strong> a las <strong>{evento.horario} hs</strong>. ¡Te esperamos!</>
              : "Lamentamos que no puedas asistir. ¡Gracias por avisarnos!"}
          </p>
          {asiste && (
            <p className="mt-4 text-[13px] text-[#6b7280]">
              Ya podés{" "}
              <Link
                href="/login?desde=invitacion"
                className="font-semibold text-[#2d5a41] underline underline-offset-2"
              >
                iniciar sesión
              </Link>{" "}
              con tu email y contraseña para ver los detalles del evento.
            </p>
          )}
          {!asiste && (
            <div className="mt-6 w-full max-w-xs">
              <p className="mb-3 text-[12px] leading-relaxed text-[#6b7280]">
                ¿Cambiaste de idea? Volvé a elegir si podés venir o no.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPaso("bienvenida");
                  setAsiste(null);
                }}
                className="w-full rounded-xl border-2 border-[#2d5a41] bg-white py-3 text-[14px] font-semibold text-[#2d5a41] transition hover:bg-[#e8f5ed]"
              >
                Cambiar mi respuesta
              </button>
            </div>
          )}
        </div>
      </Card>
    </Page>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] text-foreground">
      <header className="flex justify-end px-5 pt-5 sm:px-8 sm:pt-6">
        <Logo />
      </header>
      <main className="flex min-h-[calc(100dvh-60px)] flex-col items-center justify-center px-4 py-8">
        {children}
      </main>
    </div>
  );
}

function Card({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div
      className={`w-full rounded-3xl p-8 sm:p-10 ${wide ? "max-w-xl" : "max-w-sm"}`}
      style={{
        backgroundColor: "#f0f7f2",
        boxShadow: "0 0 0 1px #c5dece, 0 20px 60px -10px rgba(45,90,65,0.15)",
      }}
    >
      {children}
    </div>
  );
}
