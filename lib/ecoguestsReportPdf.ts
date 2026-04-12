import { jsPDF } from "jspdf";

export type EcoGuestPdfRow = {
  nombre: string;
  rol: string;
  grupo: string;
  telefono: string;
  asistencia: string;
};

const BRAND = { r: 45, g: 90, b: 65 };
const MINT = { r: 232, g: 243, b: 236 };
const TEXT_MUTED = { r: 75, g: 85, b: 99 };

function fmtFecha(iso?: string): string {
  if (!iso || typeof iso !== "string") return "";
  try {
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/**
 * Reporte EcoGuests en A4, listo para imprimir o archivar.
 */
export function downloadEcoGuestsPdf(opts: {
  eventoNombre: string;
  eventoFecha?: string;
  anfitrionNombre?: string;
  guests: EcoGuestPdfRow[];
  conteo: { total: number; conductores: number; pasajeros: number };
}): void {
  const { eventoNombre, eventoFecha, anfitrionNombre, guests, conteo } = opts;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const m = 14;
  const contentW = pageW - m * 2;
  let y = m;

  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("SMART GUEST", m, 10);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Reporte EcoGuests", m, 19);

  y = 34;
  doc.setTextColor(30, 30, 30);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const titleLines = doc.splitTextToSize(eventoNombre || "Evento", contentW);
  doc.text(titleLines, m, y);
  y += titleLines.length * 5 + 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  const fechaStr = fmtFecha(eventoFecha);
  if (fechaStr) {
    doc.text(`Fecha del evento: ${fechaStr}`, m, y);
    y += 5;
  }
  if (anfitrionNombre?.trim()) {
    doc.text(`Anfitrión: ${anfitrionNombre.trim()}`, m, y);
    y += 5;
  }

  y += 3;
  doc.setTextColor(30, 30, 30);
  doc.setFillColor(MINT.r, MINT.g, MINT.b);
  doc.roundedRect(m, y, contentW, 18, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Resumen", m + 4, y + 7);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const sum = `${conteo.total} EcoGuests · ${conteo.conductores} conductor(es) · ${conteo.pasajeros} pasajero(s)`;
  const sumLines = doc.splitTextToSize(sum, contentW - 8);
  doc.text(sumLines, m + 4, y + 13);
  y += 22 + (sumLines.length - 1) * 4;

  doc.setFontSize(8);
  doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
  doc.text(
    "Criterio: asistencia confirmada y rol SmartPool conductor o pasajero (igual que en el panel).",
    m,
    y
  );
  y += 8;

  const col = {
    nombre: m,
    rol: m + 58,
    grupo: m + 82,
    tel: m + 128,
    asist: m + 168,
  };
  const headerH = 9;

  function drawHeader(yy: number) {
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.setTextColor(255, 255, 255);
    doc.rect(m, yy, contentW, headerH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Nombre", col.nombre + 1, yy + 6);
    doc.text("Rol", col.rol + 1, yy + 6);
    doc.text("Grupo", col.grupo + 1, yy + 6);
    doc.text("Teléfono", col.tel + 1, yy + 6);
    doc.text("Asist.", col.asist + 1, yy + 6);
    doc.setDrawColor(200, 210, 205);
    doc.setLineWidth(0.1);
    doc.line(col.rol, yy, col.rol, yy + headerH);
    doc.line(col.grupo, yy, col.grupo, yy + headerH);
    doc.line(col.tel, yy, col.tel, yy + headerH);
    doc.line(col.asist, yy, col.asist, yy + headerH);
  }

  function newPage() {
    doc.addPage();
    y = m;
    drawHeader(y);
    y += headerH;
  }

  function clipOneLine(text: string, maxW: number): string {
    const lines = doc.splitTextToSize(text || "—", maxW);
    return (lines[0] as string) || "—";
  }

  drawHeader(y);
  y += headerH;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let stripe = false;
  const lineH = 8;

  for (const g of guests) {
    if (y + lineH > pageH - m - 10) {
      newPage();
    }

    if (stripe) {
      doc.setFillColor(250, 252, 250);
      doc.rect(m, y, contentW, lineH, "F");
    }
    stripe = !stripe;

    doc.setTextColor(30, 30, 30);
    doc.setFont("helvetica", "normal");
    doc.text(clipOneLine(g.nombre, col.rol - col.nombre - 3), col.nombre + 1, y + 5.5);
    doc.setFont("helvetica", "bold");
    doc.text(g.rol, col.rol + 1, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.text(clipOneLine(g.grupo, col.tel - col.grupo - 3), col.grupo + 1, y + 5.5);
    doc.text(clipOneLine(g.telefono, col.asist - col.tel - 3), col.tel + 1, y + 5.5);
    doc.text(clipOneLine(g.asistencia, 20), col.asist + 1, y + 5.5);

    doc.setDrawColor(230, 236, 233);
    doc.line(m, y + lineH, m + contentW, y + lineH);
    y += lineH;
  }

  const gen = new Date().toLocaleString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const footer = `Generado el ${gen} · SmartGuest`;
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(TEXT_MUTED.r, TEXT_MUTED.g, TEXT_MUTED.b);
    doc.text(footer, m, pageH - 8);
    doc.text(`${p} / ${totalPages}`, pageW - m - 12, pageH - 8);
  }

  const safeName = (eventoNombre || "evento")
    .trim()
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 48);
  doc.save(`ecoguests-${safeName || "reporte"}.pdf`);
}
