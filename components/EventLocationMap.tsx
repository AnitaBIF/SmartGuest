"use client";

import { useMemo } from "react";

type Props = {
  salon: string;
  direccion: string;
  height?: number;
  className?: string;
  /** Mapa más alto en pantalla Datos del Evento (invitado). */
  variant?: "default" | "invitado";
};

function buildQuery(salon: string, direccion: string) {
  const parts = [salon.trim(), direccion.trim()].filter(Boolean);
  return parts.join(", ");
}

/**
 * Mapa embebido: Google Maps con búsqueda por texto (sin API key).
 * Suele resolver bien direcciones en Argentina aunque otros geocoders fallen.
 */
export default function EventLocationMap({
  salon,
  direccion,
  height,
  className = "",
  variant = "default",
}: Props) {
  const query = useMemo(() => buildQuery(salon, direccion), [salon, direccion]);

  const mapsQuery = useMemo(() => {
    if (!query) return "";
    return /\bargentin/i.test(query) ? query : `${query}, Argentina`;
  }, [query]);

  const mapsHref = useMemo(
    () => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`,
    [mapsQuery]
  );

  const embedSrc = useMemo(() => {
    if (!mapsQuery) return null;
    return `https://www.google.com/maps?q=${encodeURIComponent(mapsQuery)}&z=16&output=embed`;
  }, [mapsQuery]);

  if (!query) {
    return (
      <div className={`rounded-2xl border border-dashed border-border bg-card-muted px-4 py-6 text-center text-[13px] text-muted ${className}`}>
        La ubicación del salón se publicará cuando el organizador cargue la dirección.
      </div>
    );
  }

  const embedSizeClass =
    height != null
      ? ""
      : variant === "invitado"
        ? "aspect-[5/4] w-full min-h-[240px] max-h-[min(420px,55dvh)] sm:aspect-auto sm:min-h-[300px] sm:max-h-none lg:min-h-[min(420px,calc(100vh-14rem))] lg:aspect-auto lg:max-h-none lg:h-[min(560px,calc(100vh-11rem))]"
        : "aspect-[4/3] w-full max-h-[min(360px,58dvh)] min-h-[200px] sm:max-h-[360px]";

  return (
    <div className={`min-w-0 ${className}`}>
      <div
        className={`overflow-hidden rounded-2xl bg-muted/40 shadow ring-1 ring-border ${height == null ? embedSizeClass : ""}`}
        style={height != null ? { height } : undefined}
      >
        {embedSrc && (
          <iframe
            title="Ubicación del evento"
            width="100%"
            height="100%"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={embedSrc}
            style={{ border: 0 }}
          />
        )}
      </div>
      <p className="mt-2 text-center text-[12px] text-muted">
        {salon.trim()}
        {direccion.trim() ? ` — ${direccion.trim()}` : ""}
      </p>
      <p className="mt-1 text-center">
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] font-medium text-brand underline underline-offset-2"
        >
          Abrir en Google Maps
        </a>
      </p>
    </div>
  );
}
