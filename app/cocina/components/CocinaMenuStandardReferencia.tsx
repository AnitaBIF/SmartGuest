/** Referencia del menú estándar elegido por el anfitrión en el evento (BD `menu_standard`). */
export function CocinaMenuStandardReferencia({ texto }: { texto?: string | null }) {
  const t = texto?.trim();
  if (t) {
    return (
      <p className="mb-3 rounded-lg border border-border bg-card-muted px-3 py-2 text-[11px] leading-snug text-foreground">
        <span className="font-semibold text-brand">Menú estándar del evento (anfitrión):</span> {t}
      </p>
    );
  }
  return (
    <p className="mb-3 text-[11px] italic leading-snug text-muted">
      Menú estándar del evento (anfitrión): sin cargar — si el salón ofrece varias opciones, coordiná con administración o
      anfitrión.
    </p>
  );
}
