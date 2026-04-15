"use client";

import { useState } from "react";
import Link from "next/link";
import { LeyendaObligatorios } from "@/components/FormRequired";
import { MENUS_ESPECIALES_CATALOGO } from "@/lib/grupoFamiliar";
import {
  SALON_MENU_STANDARD_MAX_OPCIONES,
  formatSalonMenuStandardOpciones,
  validateSalonMenuStandardOpciones,
} from "@/lib/salonMenuStandardOpciones";
import { cuitValido, dniValido } from "@/lib/registroSalon";

function NotchedField({
  id,
  label,
  type = "text",
  autoComplete,
  value,
  onChange,
  placeholder,
  required: requiredField,
}: {
  id: string;
  label: string;
  type?: "text" | "password" | "email";
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="relative pt-1">
      <label
        htmlFor={id}
        className="absolute left-4 top-0 z-10 -translate-y-1/2 rounded bg-brand px-3 py-1 text-xs font-semibold tracking-wide text-white dark:text-zinc-950"
      >
        {label}
        {requiredField ? (
          <>
            <span className="ml-0.5 font-semibold text-amber-200 dark:text-zinc-950" aria-hidden="true">
              *
            </span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        ) : null}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border-2 border-brand bg-input px-4 pb-3 pt-5 text-foreground placeholder:text-muted outline-none ring-brand/0 transition-shadow focus:border-brand focus:ring-4 focus:ring-brand/20"
      />
    </div>
  );
}

export default function RegistroSalonPage() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [dni, setDni] = useState("");
  const [salonNombre, setSalonNombre] = useState("");
  const [salonDireccion, setSalonDireccion] = useState("");
  const [cuit, setCuit] = useState("");
  const [habilitacion, setHabilitacion] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [menusEspeciales, setMenusEspeciales] = useState<string[]>([]);
  const [menusOtro, setMenusOtro] = useState("");
  const [nOpcionesMenuStandard, setNOpcionesMenuStandard] = useState(1);
  const [opcionesMenuStandard, setOpcionesMenuStandard] = useState<string[]>([""]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

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

  const toggleSalonMenu = (opcion: string) => {
    setMenusEspeciales((prev) => {
      const next = prev.includes(opcion)
        ? prev.filter((m) => m !== opcion)
        : [...prev, opcion];
      if (opcion === "Otro" && prev.includes("Otro")) setMenusOtro("");
      return next;
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!nombre.trim() || !apellido.trim()) {
      setError("Completá nombre y apellido.");
      return;
    }
    if (!dniValido(dni)) {
      setError("DNI inválido (7 u 8 dígitos).");
      return;
    }
    if (salonNombre.trim().length < 2) {
      setError("Indicá el nombre del salón.");
      return;
    }
    if (salonDireccion.trim().length < 8) {
      setError("Indicá la dirección completa del local (calle, número, ciudad).");
      return;
    }
    if (!cuitValido(cuit)) {
      setError("CUIT inválido (11 dígitos, persona o empresa).");
      return;
    }
    if (habilitacion.trim().length < 2) {
      setError("Indicá el número de habilitación del local físico.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Email inválido. Lo usaremos para iniciar sesión y recuperar la contraseña.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    const menuStdErr = validateSalonMenuStandardOpciones(opcionesMenuStandard);
    if (menuStdErr) {
      setError(menuStdErr);
      return;
    }
    if (menusEspeciales.includes("Otro") && menusOtro.trim().length < 2) {
      setError("Completá la descripción del menú especial «Otro».");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/registro-salon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          dni: dni.trim(),
          salon_nombre: salonNombre.trim(),
          salon_direccion: salonDireccion.trim(),
          cuit: cuit.trim(),
          habilitacion_numero: habilitacion.trim(),
          email: email.trim().toLowerCase(),
          password,
          menus_especiales: menusEspeciales,
          menus_especiales_otro: menusOtro.trim(),
          menu_standard: formatSalonMenuStandardOpciones(opcionesMenuStandard),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo completar el registro.");
        return;
      }
      setOk(true);
    } catch {
      setError("Error de red. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col text-foreground">
      <header className="flex justify-end px-5 pt-6 sm:px-10 sm:pt-8">
        <span className="text-2xl font-extrabold tracking-tight text-brand sm:text-3xl">
          SMART
          <span className="ml-1 font-normal text-brand" style={{ fontFamily: "var(--font-poppins)" }}>
            GUEST
          </span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-8 sm:py-12">
        <h1 className="mb-2 text-center text-2xl font-bold text-brand sm:text-3xl">Registro de salón</h1>
        <p className="mb-8 text-center text-sm text-muted">
          El administrador del salón crea la cuenta con sus datos y los del local. El mismo email sirve para
          ingresar y para recuperar la contraseña si la olvidás.
        </p>

        {ok ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center dark:border-emerald-800/50 dark:bg-emerald-950/40">
            <p className="font-semibold text-green-900 dark:text-emerald-100">Cuenta creada correctamente.</p>
            <p className="mt-2 text-sm text-green-800 dark:text-emerald-200/90">
              Ya podés iniciar sesión con tu email y contraseña.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:brightness-95 dark:text-zinc-950"
            >
              Ir al login
            </Link>
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <LeyendaObligatorios className="text-[12px] text-muted" />
            <NotchedField
              id="nombre"
              label="Nombre"
              autoComplete="given-name"
              value={nombre}
              onChange={setNombre}
              required
            />
            <NotchedField
              id="apellido"
              label="Apellido"
              autoComplete="family-name"
              value={apellido}
              onChange={setApellido}
              required
            />
            <NotchedField
              id="dni"
              label="DNI"
              autoComplete="off"
              placeholder="Sin puntos"
              value={dni}
              onChange={setDni}
              required
            />
            <NotchedField
              id="salon_nombre"
              label="Nombre del salón"
              autoComplete="organization"
              value={salonNombre}
              onChange={setSalonNombre}
              required
            />
            <NotchedField
              id="salon_direccion"
              label="Dirección del local"
              autoComplete="street-address"
              placeholder="Calle, número, ciudad"
              value={salonDireccion}
              onChange={setSalonDireccion}
              required
            />
            <NotchedField
              id="cuit"
              label="CUIT (personal o empresa)"
              autoComplete="off"
              placeholder="11 dígitos"
              value={cuit}
              onChange={setCuit}
              required
            />
            <NotchedField
              id="habilitacion"
              label="Nº habilitación del local"
              autoComplete="off"
              value={habilitacion}
              onChange={setHabilitacion}
              required
            />

            <div className="relative rounded-lg border-2 border-brand bg-card px-4 pb-4 pt-6 ring-1 ring-[var(--ring-soft)]">
              <p className="absolute left-4 top-0 z-10 -translate-y-1/2 rounded bg-brand px-3 py-1 text-xs font-semibold tracking-wide text-white dark:text-zinc-950">
                Menús especiales que ofrecen
                <span className="ml-0.5 font-semibold text-amber-200 dark:text-zinc-950" aria-hidden="true">
                  {" "}
                  (opcional)
                </span>
              </p>
              <p className="mb-3 text-[12px] text-muted">
                Marcá los que apliquen. Esto se usará como valor inicial al crear eventos en el calendario.
              </p>
              <div className="flex flex-col gap-2">
                {MENUS_ESPECIALES_CATALOGO.map((op) => (
                  <label key={op} className="flex cursor-pointer items-center gap-2 text-[13px] text-foreground">
                    <input
                      type="checkbox"
                      checked={menusEspeciales.includes(op)}
                      onChange={() => toggleSalonMenu(op)}
                      className="h-4 w-4 rounded accent-brand"
                    />
                    {op}
                  </label>
                ))}
              </div>
              {menusEspeciales.includes("Otro") && (
                <div className="mt-3">
                  <label htmlFor="menus_otro" className="mb-1 block text-[12px] font-medium text-foreground">
                    Detalle del menú «Otro»
                  </label>
                  <textarea
                    id="menus_otro"
                    value={menusOtro}
                    onChange={(e) => setMenusOtro(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-border bg-input px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20"
                    placeholder="Ej.: menú bajo en sodio, alergias, etc."
                  />
                </div>
              )}
            </div>

            <div className="relative rounded-lg border-2 border-brand bg-card px-4 pb-4 pt-6 ring-1 ring-[var(--ring-soft)]">
              <p className="absolute left-4 top-0 z-10 -translate-y-1/2 rounded bg-brand px-3 py-1 text-xs font-semibold tracking-wide text-white dark:text-zinc-950">
                Menú estándar del salón
                <span className="ml-0.5 font-semibold text-amber-200 dark:text-zinc-950" aria-hidden="true">
                  *
                </span>
                <span className="sr-only"> (obligatorio)</span>
              </p>
              <p className="mb-3 text-[12px] text-muted">
                Indicá cuántas opciones ofrecen y describí cada una. Se precarga al crear cada evento; podés ajustarlo por
                fiesta.
              </p>
              <div className="mb-4">
                <label htmlFor="cant_opciones_menu_standard" className="mb-1 block text-[12px] font-medium text-foreground">
                  ¿Cuántas opciones de menú estándar ofrecen?
                </label>
                <input
                  id="cant_opciones_menu_standard"
                  type="number"
                  min={1}
                  max={SALON_MENU_STANDARD_MAX_OPCIONES}
                  value={nOpcionesMenuStandard}
                  onChange={(e) => aplicarCantidadOpcionesMenu(parseInt(e.target.value, 10))}
                  className="w-full max-w-[8rem] rounded-lg border border-border bg-input px-3 py-2 text-[13px] text-foreground outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              </div>
              <div className="flex flex-col gap-3">
                {opcionesMenuStandard.map((op, i) => (
                  <div key={i} className="relative pt-1">
                    <label
                      htmlFor={`menu_std_op_${i}`}
                      className="absolute left-3 top-0 z-10 -translate-y-1/2 rounded bg-card-muted px-2 py-0.5 text-[11px] font-semibold text-brand"
                    >
                      Opción {i + 1}
                    </label>
                    <input
                      id={`menu_std_op_${i}`}
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
                      placeholder={
                        i === 0
                          ? "Ej.: Entrada + plato principal (pollo o pescado) + postre + bebidas…"
                          : "Descripción de esta opción"
                      }
                      className="w-full rounded-lg border border-border bg-input px-3 pb-2.5 pt-4 text-[13px] text-foreground placeholder:text-muted outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                ))}
              </div>
            </div>

            <NotchedField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              required
            />
            <NotchedField
              id="password"
              label="Contraseña"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
              required
            />
            <NotchedField
              id="password2"
              label="Repetir contraseña"
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={setPassword2}
              required
            />

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand py-3 text-center text-base font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-60 dark:text-zinc-950"
            >
              {loading ? "Registrando…" : "Crear cuenta"}
            </button>
          </form>
        )}

        <p className="mt-8 text-center text-sm">
          <Link href="/" className="font-medium text-brand underline underline-offset-4">
            Volver al login
          </Link>
        </p>
      </main>
    </div>
  );
}
