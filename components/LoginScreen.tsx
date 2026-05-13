"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { translateAuthError } from "@/lib/translateAuthError";

function NotchedField({
  id,
  label,
  type = "text",
  autoComplete,
  value,
  onChange,
  required: requiredField,
}: {
  id: string;
  label: string;
  type?: "text" | "password" | "email";
  autoComplete?: string;
  value: string;
  onChange: (v: string) => void;
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
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border-2 border-brand bg-input px-4 pb-3 pt-5 text-foreground placeholder:text-muted outline-none ring-brand/0 transition-shadow focus:border-brand focus:ring-4 focus:ring-brand/20"
      />
    </div>
  );
}

const ROLE_ROUTES: Record<string, string> = {
  administrador: "/admin",
  anfitrion: "/anfitrion",
  jefe_cocina: "/cocina",
  seguridad: "/seguridad",
  invitado: "/invitado",
};

type LoginScreenProps = {
  /** Cierra cualquier sesión previa (p. ej. otro rol en el mismo navegador) antes de mostrar el formulario. */
  signOutOnMount?: boolean;
};

export default function LoginScreen({ signOutOnMount = false }: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (!signOutOnMount) return;
    void supabase.auth.signOut();
  }, [signOutOnMount]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    /* Validaciones del lado del cliente (en español, antes de pegarle a Supabase). */
    const em = email.trim();
    const pwd = password;
    if (!em && !pwd) {
      setError("Ingresá tu email y contraseña para iniciar sesión.");
      return;
    }
    if (!em) {
      setError("Ingresá tu email para iniciar sesión.");
      return;
    }
    if (!pwd) {
      setError("Ingresá tu contraseña para iniciar sesión.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError("El email no parece válido. Revisalo y probá de nuevo.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: em.toLowerCase(),
        password: pwd,
      });

      if (authError || !data.user) {
        setError(translateAuthError(authError?.message, "Email o contraseña incorrectos."));
        return;
      }

      const { data: usuario, error: userError } = await supabase
        .from("usuarios")
        .select("tipo")
        .eq("id", data.user.id)
        .single();

      if (userError || !usuario) {
        setError(
          translateAuthError(
            userError?.message,
            "No pudimos cargar tu perfil. Reintentá en unos segundos.",
          ),
        );
        return;
      }

      const ruta = ROLE_ROUTES[usuario.tipo] ?? "/";
      window.location.href = ruta;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(translateAuthError(msg, "No pudimos iniciar sesión. Intentá de nuevo."));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotMsg("");
    const em = email.trim().toLowerCase();
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setForgotMsg("Ingresá un email válido (el mismo con el que te registraste).");
      return;
    }
    setForgotLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const { error: fe } = await supabase.auth.resetPasswordForEmail(em, {
      redirectTo: `${origin}/auth/recuperar`,
    });
    setForgotLoading(false);
    if (fe) {
      setForgotMsg(translateAuthError(fe.message, "No pudimos enviar el enlace. Probá de nuevo."));
      return;
    }
    setForgotMsg("Si ese email está registrado, recibirás un enlace para elegir una nueva contraseña.");
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

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl shadow-black/10 ring-1 ring-[var(--ring-soft)] sm:p-10 dark:shadow-black/40">
          <h1 className="mb-8 text-center text-3xl font-bold text-brand sm:text-4xl">
            Login
          </h1>

          {forgotOpen ? (
            <form className="space-y-6" onSubmit={handleForgot}>
              <p className="text-center text-sm text-muted">
                Te enviaremos un enlace a tu email para restablecer la contraseña.
              </p>
              <p className="text-center text-[11px] text-muted">
                <span className="font-semibold text-red-600">*</span> Campo obligatorio.
              </p>
              <NotchedField
                id="email"
                label="Email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={setEmail}
                required
              />
              {forgotMsg && (
                <p
                  className={`rounded-lg px-4 py-2 text-center text-sm font-medium ${
                    forgotMsg.startsWith("Si ese email")
                      ? "bg-green-50 text-green-800 dark:bg-green-950/50 dark:text-green-200"
                      : "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300"
                  }`}
                >
                  {forgotMsg}
                </p>
              )}
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setForgotOpen(false);
                    setForgotMsg("");
                  }}
                  className="w-full rounded-lg border-2 border-brand bg-card py-3 text-center text-base font-semibold text-brand transition-colors hover:bg-brand/10"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full rounded-lg bg-brand py-3 text-center text-base font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-60"
                >
                  {forgotLoading ? "Enviando…" : "Enviar enlace"}
                </button>
              </div>
            </form>
          ) : (
          <form className="space-y-6" onSubmit={handleLogin}>
            <p className="text-center text-[11px] text-muted">
              <span className="font-semibold text-red-600">*</span> Campo obligatorio.
            </p>
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
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              required
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-2 text-center text-sm font-medium text-red-600 dark:bg-red-950/40 dark:text-red-300">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-brand py-3 text-center text-base font-semibold text-white transition-colors hover:brightness-95 disabled:opacity-60"
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setForgotOpen(true);
                  setError("");
                }}
                className="text-center text-sm font-medium text-brand underline underline-offset-4"
              >
                Olvidé mi contraseña
              </button>
            </div>
          </form>
          )}

          <p className="mt-8 text-center text-sm">
            <Link
              href="/registro/salon"
              className="font-medium text-brand underline underline-offset-4"
            >
              Registre aquí su salón de eventos
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
