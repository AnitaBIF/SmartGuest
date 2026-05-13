"use client";

/**
 * Pie de sidebar: nombre con salto de línea (sin truncate) + subtítulo + logout.
 * `title` en cada línea permite ver el texto completo al pasar el mouse.
 */
export function SidebarUserChip({
  displayName,
  subtitle,
  onLogout,
}: {
  displayName: string;
  subtitle: string;
  onLogout: () => void;
}) {
  const name = displayName.trim() || "—";
  const sub = subtitle.trim() || "—";

  return (
    <div className="mt-8 rounded-2xl border border-border bg-card-muted px-4 py-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand/80 bg-card">
          <span className="text-sm font-semibold text-[#4b2e83]" aria-hidden>
            👤
          </span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="break-words text-[12px] font-semibold leading-snug text-foreground" title={name}>
            {name}
          </p>
          <p className="mt-0.5 break-words text-[10px] leading-snug text-muted" title={sub}>
            {sub}
          </p>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted transition-colors hover:bg-card hover:text-brand"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 17l5-5-5-5" />
            <path d="M20 12H9" />
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
