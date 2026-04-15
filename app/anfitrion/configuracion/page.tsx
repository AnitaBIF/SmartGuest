"use client";

import { useCallback, useEffect, useState } from "react";
import { LeyendaObligatorios, Req } from "@/components/FormRequired";

const inp =
  "flex-1 rounded-full border border-border bg-input px-4 py-2 text-[13px] text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20";

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
      <label className="w-full text-[13px] text-foreground sm:w-52 sm:text-right sm:pr-5">
        {label}
        {required ? <Req /> : null}
      </label>
      {children}
    </div>
  );
}

export default function AnfitrionConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [email, setEmail] = useState("");
  const [emailInicial, setEmailInicial] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/anfitrion/cuenta", { cache: "no-store" });
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
    } catch {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleGuardar = async () => {
    setSaving(true);
    setError(null);
    setGuardado(false);
    try {
      const body: Record<string, string> = {
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        dni: dni.trim(),
        email: email.trim().toLowerCase(),
        currentPassword,
        newPassword,
        newPasswordConfirm,
      };
      const r = await fetch("/api/anfitrion/cuenta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      window.dispatchEvent(new Event("smartguest:anfitrion-perfil-actualizado"));
    } catch {
      setError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-[50vh] min-w-0 flex-1 items-center justify-center pb-8">
        <p className="text-muted">Cargando...</p>
      </main>
    );
  }

  const emailCambio = email.trim().toLowerCase() !== emailInicial;
  const passwordCambio = newPassword.length > 0 || newPasswordConfirm.length > 0;

  return (
    <main className="mx-auto min-w-0 max-w-3xl flex-1 pb-8">
          <h1 className="mb-8 text-right text-2xl font-bold text-brand">Configuración</h1>

          <div className="mb-6 rounded-2xl border border-border bg-card-muted px-5 py-4 text-[13px] leading-relaxed text-muted ring-1 ring-[var(--ring-soft)]">
            <p className="font-semibold text-brand">Tu cuenta y datos personales</p>
            <p className="mt-2">
              La <strong>fecha, el lugar, los cupos y el contrato del evento</strong> no se modifican desde acá: eso se coordina con el salón.
            </p>
          </div>

          <div className="rounded-3xl border border-border bg-card p-8 shadow ring-1 ring-[var(--ring-soft)]">
            <h2 className="mb-4 text-[18px] font-semibold text-foreground">Datos de acceso y contacto</h2>
            <LeyendaObligatorios className="mb-6 text-[12px] text-muted" />

            {error && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
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
                <input className={inp} type="text" value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" autoComplete="off" />
              </Field>
              <Field label="Email" required>
                <input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>

              <div className="border-t border-border pt-6">
                <p className="mb-4 text-[14px] font-medium text-foreground">Contraseña</p>
                <p className="mb-4 text-[12px] text-muted">
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
                className="rounded-xl bg-brand px-12 py-3 text-base font-bold text-white transition-colors hover:brightness-95 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
              {guardado && (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 8 6 12 14 4" />
                  </svg>
                  Cambios guardados
                </p>
              )}
            </div>
          </div>
    </main>
  );
}
