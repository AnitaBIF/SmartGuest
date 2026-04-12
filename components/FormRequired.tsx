/** Asterisco visible; lectores de pantalla leen «obligatorio». */
export function Req() {
  return (
    <>
      <span className="font-semibold text-red-600" aria-hidden="true">
        *
      </span>
      <span className="sr-only"> (obligatorio)</span>
    </>
  );
}

/** Leyenda estándar para formularios. */
export function LeyendaObligatorios({ className }: { className?: string }) {
  return (
    <p className={className ?? "mb-4 text-[12px] text-[#6b7280]"}>
      <span className="font-semibold text-red-600">*</span> Campo obligatorio.
    </p>
  );
}
