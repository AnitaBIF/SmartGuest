"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LeyendaObligatorios } from "@/components/FormRequired";
import { supabase } from "@/lib/supabase";

export default function RecuperarContrasenaPage() {
  const [listo, setListo] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setListo(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setListo(true);
      if (event === "SIGNED_IN" && session && window.location.hash.includes("type=recovery")) {
        setListo(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    const { error: upErr } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setOk(true);
    await supabase.auth.signOut();
    setTimeout(() => {
      window.location.href = "/";
    }, 2000);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col px-4 py-10 text-foreground">
      <header className="mb-8 text-center">
        <span className="text-2xl font-extrabold tracking-tight text-brand">
          SMART
          <span className="ml-1 font-normal text-brand" style={{ fontFamily: "var(--font-poppins)" }}>
            GUEST
          </span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-md">
        <h1 className="mb-2 text-center text-xl font-bold text-foreground">Nueva contraseña</h1>
        <p className="mb-6 text-center text-sm text-muted">
          Si llegaste desde el enlace del email, elegí una contraseña nueva. El mismo email sirve para
          recuperar el acceso cuando lo olvides.
        </p>

        {!listo && !ok && (
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-center text-sm text-amber-900">
            Esperando el enlace de recuperación… Si no abriste el mail desde este dispositivo, abrí el
            enlace que te envió Supabase y volvé a esta página.
          </p>
        )}

        {listo && !ok && (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <LeyendaObligatorios className="text-center text-[12px] text-[#6b7280]" />
            <div className="relative pt-1">
              <label
                htmlFor="np"
                className="absolute left-4 top-0 z-10 -translate-y-1/2 rounded bg-brand px-3 py-1 text-xs font-semibold text-white dark:text-zinc-950"
              >
                Nueva contraseña
                <span className="ml-0.5 font-semibold text-amber-200 dark:text-zinc-950" aria-hidden="true">
                  *
                </span>
                <span className="sr-only"> (obligatorio)</span>
              </label>
              <input
                id="np"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border-2 border-brand bg-white px-4 pb-3 pt-5 text-gray-900 outline-none focus:ring-4 focus:ring-brand/20"
              />
            </div>
            <div className="relative pt-1">
              <label
                htmlFor="np2"
                className="absolute left-4 top-0 z-10 -translate-y-1/2 rounded bg-brand px-3 py-1 text-xs font-semibold text-white dark:text-zinc-950"
              >
                Repetir contraseña
                <span className="ml-0.5 font-semibold text-amber-200 dark:text-zinc-950" aria-hidden="true">
                  *
                </span>
                <span className="sr-only"> (obligatorio)</span>
              </label>
              <input
                id="np2"
                type="password"
                autoComplete="new-password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="w-full rounded-lg border-2 border-brand bg-white px-4 pb-3 pt-5 text-gray-900 outline-none focus:ring-4 focus:ring-brand/20"
              />
            </div>
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-2 text-center text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-brand py-3 font-semibold text-white hover:bg-[#24503a] disabled:opacity-60"
            >
              {loading ? "Guardando…" : "Guardar contraseña"}
            </button>
          </form>
        )}

        {ok && (
          <p className="rounded-lg bg-green-50 px-4 py-3 text-center text-sm font-medium text-green-800">
            Listo. Redirigiendo al inicio de sesión…
          </p>
        )}

        <p className="mt-8 text-center text-sm">
          <Link href="/" className="font-medium text-brand underline">
            Volver al login
          </Link>
        </p>
      </main>
    </div>
  );
}
