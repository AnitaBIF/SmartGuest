"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

function useThemeMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/**
 * Botón compacto fijo: páginas sin sidebar (login, etc.). Esquina inferior izquierda para no tapar CTAs a la derecha.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useThemeMounted();

  if (!mounted) {
    return (
      <div
        className="pointer-events-none fixed bottom-6 left-[max(1rem,env(safe-area-inset-left,0px))] z-[200] h-11 w-11 shrink-0 rounded-xl border border-border bg-card opacity-0"
        aria-hidden
      />
    );
  }

  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="fixed bottom-6 left-[max(1rem,env(safe-area-inset-left,0px))] z-[200] flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-brand shadow-md ring-1 ring-[var(--ring-soft)] transition-colors hover:bg-card-muted"
      aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
    >
      {dark ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

type RowProps = { className?: string };

/**
 * Control explícito con texto para sidebars / menú móvil (prender o apagar modo oscuro).
 */
export function ThemeToggleRow({ className = "" }: RowProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useThemeMounted();

  if (!mounted) {
    return <div className={`h-[42px] rounded-xl border border-border bg-card-muted/50 ${className}`} aria-hidden />;
  }

  const dark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={
        "flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card-muted px-3 py-2.5 text-[13px] font-semibold text-foreground shadow-sm ring-1 ring-[var(--ring-soft)] transition-colors hover:bg-card hover:text-brand " +
        className
      }
      aria-pressed={dark}
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {dark ? (
        <>
          <svg className="h-5 w-5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
          Modo claro
        </>
      ) : (
        <>
          <svg className="h-5 w-5 shrink-0 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
          Modo oscuro
        </>
      )}
    </button>
  );
}
