"use client";

import { useEffect } from "react";

/**
 * Botón fijo para abrir la navegación en &lt; md (no ocupa hueco en el flex del layout).
 */
export function MobileNavOpenButton({ onClick, expanded }: { onClick: () => void; expanded: boolean }) {
  return (
    <div className="relative h-0 w-0 shrink-0 md:hidden" aria-hidden={false}>
      <button
        type="button"
        onClick={onClick}
        className="fixed left-4 top-4 z-[70] flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card text-brand shadow-md ring-1 ring-[var(--ring-soft)]"
        aria-label="Abrir menú de navegación"
        aria-expanded={expanded}
        aria-haspopup="dialog"
      >
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>
  );
}

/**
 * Panel lateral + overlay; solo visible en &lt; md.
 */
export function MobileNavDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] md:hidden" role="dialog" aria-modal="true" aria-label="Menú de navegación">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        onClick={onClose}
        aria-label="Cerrar menú"
      />
      <div className="absolute left-0 top-0 flex h-full w-[min(20rem,90vw)] flex-col overflow-y-auto bg-card text-foreground shadow-2xl ring-1 ring-[var(--ring-soft)]">
        <div className="flex items-center justify-end border-b border-border-subtle px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-card-muted"
            aria-label="Cerrar menú"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex flex-1 flex-col px-5 pb-6 pt-2">{children}</div>
      </div>
    </div>
  );
}
