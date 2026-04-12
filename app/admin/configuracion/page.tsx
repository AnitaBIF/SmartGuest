"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminSidebar } from "../components/AdminSidebar";
import { LeyendaObligatorios, Req } from "@/components/FormRequired";
import { MENUS_ESPECIALES_CATALOGO } from "@/lib/grupoFamiliar";
import {
  SALON_MENU_STANDARD_MAX_OPCIONES,
  formatSalonMenuStandardOpciones,
  parseSalonMenuStandardToOpciones,
  validateSalonMenuStandardOpciones,
} from "@/lib/salonMenuStandardOpciones";

const inp =
  "flex-1 rounded-full border border-[#d1d5db] bg-white px-4 py-2 text-[13px] text-[#111827] outline-none focus:border-[#2d5a41] focus:ring-2 focus:ring-[#2d5a41]/20";

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
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
      <label className="w-full text-[13px] text-[#374151] sm:w-52 sm:text-right sm:pr-5">
        {label}
        {required ? <Req /> : null}
      </label>
      {children}
    </div>
  );
}

export default function AdminConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [emailInicial, setEmailInicial] = useState("");

  const [salonNombre, setSalonNombre] = useState("");
  const [salonDireccion, setSalonDireccion] = useState("");
  const [cuit, setCuit] = useState("");
  const [habilitacionNumero, setHabilitacionNumero] = useState("");
  const [salonMenusEspeciales, setSalonMenusEspeciales] = useState<string[]>([]);
  const [salonMenusOtro, setSalonMenusOtro] = useState("");
  const [nOpcionesMenuStandard, setNOpcionesMenuStandard] = useState(1);
  const [opcionesMenuStandard, setOpcionesMenuStandard] = useState<string[]>([""]);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/admin/cuenta", { cache: "no-store" });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo cargar el perfil.");
        return;
      }
      setNombre(typeof data.nombre === "string" ? data.nombre : "");
      setApellido(typeof data.apellido === "string" ? data.apellido : "");
      setDni(typeof data.dni === "string" ? data.dni : "");
      const em = typeof data.email === "string" ? data.email : "";
      setEmail(em);
      setEmailInicial(em.trim().toLowerCase());
      setSalonNombre(typeof data.salonNombre === "string" ? data.salonNombre : "");
      setSalonDireccion(typeof data.salonDireccion === "string" ? data.salonDireccion : "");
      setCuit(typeof data.cuit === "string" ? data.cuit : "");
      setHabilitacionNumero(typeof data.habilitacionNumero === "string" ? data.habilitacionNumero : "");
      setSalonMenusEspeciales(Array.isArray(data.salonMenusEspeciales) ? data.salonMenusEspeciales : []);
      setSalonMenusOtro(typeof data.salonMenusEspecialesOtro === "string" ? data.salonMenusEspecialesOtro : "");
      const rawMenuStd = typeof data.salonMenuStandard === "string" ? data.salonMenuStandard : "";
      const parsed = parseSalonMenuStandardToOpciones(rawMenuStd);
      setOpcionesMenuStandard(parsed);
      setNOpcionesMenuStandard(Math.max(1, parsed.length));
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const aplicarCantidadOpcionesMenu = (n: number) => {
    const clamped = Math.min(
      SALON_MENU_STANDARD_MAX_OPCIONES,
      Math.max(1, Number.isFinite(n) ? Math.floor(n) : 1)
    );
    setNOpcionesMenuStandard(clamped);
    setOpcionesMenuStandard((prev) => {
      const next = [...prev];
      while (next.length < clamped) next.push("");
      return next.slice(0, clamped);
    });
  };

  const handleGuardar = async () => {
    setSaving(true);
    setError(null);
    setGuardado(false);
    const menuStdErr = validateSalonMenuStandardOpciones(opcionesMenuStandard);
    if (menuStdErr) {
      setError(menuStdErr);
      setSaving(false);
      return;
    }
    const salonMenuStandardFormatted = formatSalonMenuStandardOpciones(opcionesMenuStandard);
    try {
      const r = await fetch("/api/admin/cuenta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          dni: dni.trim(),
          email: email.trim().toLowerCase(),
          salonNombre: salonNombre.trim(),
          salonDireccion: salonDireccion.trim(),
          cuit: cuit.trim(),
          habilitacionNumero: habilitacionNumero.trim(),
          salonMenusEspeciales,
          salonMenusEspecialesOtro: salonMenusOtro.trim(),
          salonMenuStandard: salonMenuStandardFormatted,
          currentPassword,
          newPassword,
          newPasswordConfirm,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudieron guardar los cambios.");
        return;
      }
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3500);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      await load();
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  const toggleSalonMenu = (opcion: string) => {
    setSalonMenusEspeciales((prev) => {
      const next = prev.includes(opcion) ? prev.filter((m) => m !== opcion) : [...prev, opcion];
      if (opcion === "Otro" && prev.includes("Otro")) setSalonMenusOtro("");
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
          <AdminSidebar active="configuracion" />
          <main className="flex flex-1 items-center justify-center">
            <p className="text-[#9ca3af]">Cargando...</p>
          </main>
        </div>
      </div>
    );
  }

  const emailCambio = email.trim().toLowerCase() !== emailInicial;
  const passwordCambio = newPassword.length > 0 || newPasswordConfirm.length > 0;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
        <AdminSidebar active="configuracion" />

        <main className="flex-1 pb-8">
          <h1 className="mb-8 text-right text-2xl font-bold text-brand">Configuración</h1>

          <div className="mb-6 rounded-2xl border border-[#c5dece] bg-[#f0f7f2] px-5 py-4 text-[13px] leading-relaxed text-[#374151]">
            <p className="font-semibold text-[#2d5a41]">Cuenta del salón y del administrador</p>
            <p className="mt-2">
              Los <strong>eventos cargados en el calendario</strong> y las condiciones pactadas con cada cliente se gestionan según tu proceso con el anfitrión; acá actualizás datos de acceso, la ficha del local y{" "}
              <strong>qué menús ofrece el salón por defecto</strong>.
            </p>
            <p className="mt-2">
              Si más adelante cambia la cocina, el presupuesto o la carta, <strong>editá la sección de menús abajo</strong> y guardá: los{" "}
              <strong>eventos nuevos</strong> saldrán con esos valores; cada evento ya creado sigue con lo que tenía guardado (podés corregirlo desde el calendario si hace falta).
            </p>
          </div>

          <div className="rounded-3xl bg-white p-8 shadow ring-1 ring-[#e5efe8]">
            <h2 className="mb-4 text-[18px] font-semibold text-[#111827]">Titular y acceso</h2>
            <LeyendaObligatorios className="mb-6 text-[12px] text-[#6b7280]" />

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
                {error}
              </div>
            )}

            <div className="space-y-5">
              <Field label="Nombre" required>
                <input className={inp} type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="given-name" />
              </Field>
              <Field label="Apellido" required>
                <input className={inp} type="text" value={apellido} onChange={(e) => setApellido(e.target.value)} autoComplete="family-name" />
              </Field>
              <Field label="DNI">
                <input className={inp} type="text" value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" />
              </Field>
              <Field label="Email" required>
                <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>

              <div className="border-t border-[#e5e7eb] pt-6">
                <h3 className="mb-4 text-[15px] font-semibold text-[#111827]">Datos del local</h3>
                <div className="space-y-5">
                  <Field label="Nombre del salón" required>
                    <input className={inp} type="text" value={salonNombre} onChange={(e) => setSalonNombre(e.target.value)} />
                  </Field>
                  <Field label="Dirección del local" required>
                    <input className={inp} type="text" value={salonDireccion} onChange={(e) => setSalonDireccion(e.target.value)} />
                  </Field>
                  <Field label="CUIT">
                    <input className={inp} type="text" value={cuit} onChange={(e) => setCuit(e.target.value)} />
                  </Field>
                  <Field label="Nº habilitación">
                    <input className={inp} type="text" value={habilitacionNumero} onChange={(e) => setHabilitacionNumero(e.target.value)} />
                  </Field>
                </div>
              </div>

              <div className="border-t border-[#e5e7eb] pt-6">
                <h3 className="mb-2 text-[15px] font-semibold text-[#111827]">Carta del salón (menús por defecto)</h3>
                <p className="mb-4 text-[12px] text-[#6b7280]">
                  Podés <strong>modificar esto cuando quieras</strong>. Al crear un <strong>evento nuevo</strong> en el calendario se precargan estos menús; en cada fiesta seguís pudiendo ajustarlos solo para ese evento.
                </p>
                <div className="space-y-4">
                  <div>
                    <p className="mb-2 text-[13px] font-medium text-[#374151]">
                      Menús especiales que ofrecen <span className="font-normal text-[#6b7280]">(opcional)</span>
                    </p>
                    <div className="flex flex-col gap-2 pl-1">
                      {MENUS_ESPECIALES_CATALOGO.map((op) => (
                        <label key={op} className="flex cursor-pointer items-center gap-2 text-[13px] text-[#111827]">
                          <input
                            type="checkbox"
                            checked={salonMenusEspeciales.includes(op)}
                            onChange={() => toggleSalonMenu(op)}
                            className="h-4 w-4 rounded accent-[#2d5a41]"
                          />
                          {op}
                        </label>
                      ))}
                    </div>
                    {salonMenusEspeciales.includes("Otro") && (
                      <div className="mt-3 sm:pl-0">
                        <label className="mb-1 block text-[12px] text-[#374151]">Detalle «Otro»</label>
                        <textarea
                          className="min-h-[4rem] w-full max-w-xl rounded-xl border border-[#d1d5db] bg-white px-3 py-2 text-[13px] text-[#111827] outline-none focus:border-[#2d5a41] focus:ring-2 focus:ring-[#2d5a41]/20"
                          value={salonMenusOtro}
                          onChange={(e) => setSalonMenusOtro(e.target.value)}
                          rows={2}
                          placeholder="Ej.: menú bajo en sodio…"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start">
                    <span className="w-full text-[13px] text-[#374151] sm:w-52 sm:text-right sm:pr-5 sm:pt-2">
                      Menú estándar del salón
                      <Req />
                    </span>
                    <div className="flex max-w-xl flex-1 flex-col gap-3">
                      <div>
                        <label className="mb-1 block text-[12px] text-[#374151]">
                          ¿Cuántas opciones de menú estándar ofrecen?
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={SALON_MENU_STANDARD_MAX_OPCIONES}
                          value={nOpcionesMenuStandard}
                          onChange={(e) => aplicarCantidadOpcionesMenu(parseInt(e.target.value, 10))}
                          className="w-full max-w-[8rem] rounded-full border border-[#d1d5db] bg-white px-4 py-2 text-[13px] text-[#111827] outline-none focus:border-[#2d5a41] focus:ring-2 focus:ring-[#2d5a41]/20"
                        />
                      </div>
                      {opcionesMenuStandard.map((op, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <label className="text-[12px] font-medium text-[#374151]" htmlFor={`cfg_menu_std_${i}`}>
                            Opción {i + 1}
                          </label>
                          <input
                            id={`cfg_menu_std_${i}`}
                            type="text"
                            value={op}
                            onChange={(e) => {
                              const v = e.target.value;
                              setOpcionesMenuStandard((prev) => {
                                const next = [...prev];
                                next[i] = v;
                                return next;
                              });
                            }}
                            className="w-full rounded-full border border-[#d1d5db] bg-white px-4 py-2 text-[13px] text-[#111827] outline-none focus:border-[#2d5a41] focus:ring-2 focus:ring-[#2d5a41]/20"
                            placeholder={i === 0 ? "Ej.: Entrada, plato, postre, bebidas…" : "Descripción de esta opción"}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-[#e5e7eb] pt-6">
                <p className="mb-4 text-[14px] font-medium text-[#111827]">Contraseña</p>
                <p className="mb-4 text-[12px] text-[#6b7280]">
                  Para cambiar email o contraseña, completá tu contraseña actual.
                </p>
                <div className="space-y-5">
                  <Field label="Contraseña actual">
                    <input
                      className={inp}
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder={emailCambio || passwordCambio ? "Obligatoria si cambiás email o contraseña" : "Solo si cambiás email o contraseña"}
                    />
                  </Field>
                  <Field label="Nueva contraseña">
                    <input
                      className={inp}
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </Field>
                  <Field label="Repetir nueva">
                    <input
                      className={inp}
                      type="password"
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={() => void handleGuardar()}
                disabled={saving}
                className="rounded-xl px-12 py-3 text-base font-bold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: "#2d5a41" }}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              {guardado && (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16a34a]">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 8 6 12 14 4" />
                  </svg>
                  Cambios guardados
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
