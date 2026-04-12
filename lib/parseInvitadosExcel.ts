import * as XLSX from "xlsx";

export type ParsedInvitadoRow = {
  nombreCompleto: string;
  celular: string;
  grupo: string;
  rangoEtario: string;
  rowNumber: number;
};

/** Normaliza texto; evita fallar si el motor no soporta \p{M} en RegExp. */
function norm(s: string): string {
  try {
    const t = String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD");
    return t.replace(/\p{M}/gu, "");
  } catch {
    return String(s ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }
}

export function cellToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") {
    if (!Number.isFinite(val)) return "";
    if (Number.isInteger(val) && Math.abs(val) < 1e15) return String(val);
    return String(val);
  }
  return String(val).trim();
}

/** Encuentra índice de columna: encabezado igual o que contiene la clave. */
function colIndex(headers: string[], ...candidates: string[]): number {
  const h = headers.map((x) => norm(String(x ?? "")));
  for (let i = 0; i < h.length; i++) {
    for (const c of candidates) {
      const nc = norm(c);
      if (!nc) continue;
      if (h[i] === nc || h[i].includes(nc)) return i;
    }
  }
  return -1;
}

function sheetToMatrix(ws: XLSX.WorkSheet): string[][] {
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
  return raw.map((row) => {
    const arr = Array.isArray(row) ? row : [];
    const max = arr.length;
    return Array.from({ length: max }, (_, j) => cellToString(arr[j]));
  });
}

/** Fila de encabezados: debe tener indicios de las 4 columnas (evita la hoja Instrucciones). */
function findHeaderRowAndCols(data: string[][]) {
  for (let r = 0; r < data.length; r++) {
    const row = data[r] ?? [];
    const headers = row.map((c) => String(c ?? "").trim());
    const joined = norm(headers.join(" | "));
    const hasNombre =
      headers.some((h) => {
        const n = norm(h);
        return (
          n.includes("nombre") &&
          (n.includes("completo") || n.includes("apellido") || n === "nombre")
        );
      }) || joined.includes("nombre completo");
    const hasCel = headers.some((h) => {
      const n = norm(h);
      return n.includes("celular") || n.includes("telefono") || n.includes("movil");
    });
    const hasGrupo = headers.some((h) => norm(h) === "grupo" || norm(h).startsWith("grupo "));
    const hasRango = headers.some((h) => {
      const n = norm(h);
      return n.includes("rango");
    });
    if (!(hasNombre && hasCel && hasGrupo && hasRango)) continue;

    const iNombre = colIndex(headers, "nombre completo", "nombre y apellido", "nombre");
    const iCel = colIndex(headers, "celular", "telefono", "teléfono", "movil", "móvil");
    const iGrupo = colIndex(headers, "grupo");
    const iRango = colIndex(headers, "rango etario", "rango");

    if (iNombre < 0 || iCel < 0 || iGrupo < 0 || iRango < 0) continue;
    if (iNombre === iCel || iNombre === iGrupo || iNombre === iRango) continue;
    return { headerRowIdx: r, headers, iNombre, iCel, iGrupo, iRango };
  }
  return null;
}

function pickWorksheet(wb: XLSX.WorkBook): { ws: XLSX.WorkSheet; sheetLabel: string } | null {
  if (!wb.SheetNames?.length) return null;

  const byName = wb.SheetNames.find((n) => norm(n) === "invitados");
  const tryOrder = byName
    ? [byName, ...wb.SheetNames.filter((n) => n !== byName)]
    : [...wb.SheetNames];

  for (const name of tryOrder) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const data = sheetToMatrix(ws);
    const found = findHeaderRowAndCols(data);
    if (found) return { ws, sheetLabel: name };
  }

  const first = wb.SheetNames[0];
  const ws = first ? wb.Sheets[first] : null;
  if (!ws) return null;
  return { ws, sheetLabel: first };
}

export async function parseInvitadosExcelFile(file: File): Promise<{
  rows: ParsedInvitadoRow[];
  error?: string;
}> {
  let buf: ArrayBuffer;
  try {
    buf = await file.arrayBuffer();
  } catch {
    return { rows: [], error: "No se pudo leer el archivo." };
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  } catch {
    return { rows: [], error: "No es un Excel válido (.xls / .xlsx)." };
  }

  const picked = pickWorksheet(wb);
  if (!picked) return { rows: [], error: "El archivo no tiene hojas." };

  const data = sheetToMatrix(picked.ws);
  const found = findHeaderRowAndCols(data);
  if (!found) {
    return {
      rows: [],
      error: `En la hoja «${picked.sheetLabel}» no se encontraron las columnas: Nombre completo, Celular, Grupo, Rango etario. Usá la plantilla del botón «Descargar plantilla».`,
    };
  }

  const { headerRowIdx, iNombre, iCel, iGrupo, iRango } = found;
  const maxCol = Math.max(iNombre, iCel, iGrupo, iRango);

  const rows: ParsedInvitadoRow[] = [];
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    let row = data[r] ?? [];
    if (row.length <= maxCol) {
      row = [...row, ...Array.from({ length: maxCol + 1 - row.length }, () => "")];
    }
    const nombreCompleto = cellToString(row[iNombre]).trim();
    const celular = cellToString(row[iCel]).trim();
    const grupo = cellToString(row[iGrupo]).trim();
    const rangoEtario = cellToString(row[iRango]).trim();
    if (!nombreCompleto && !celular && !grupo && !rangoEtario) continue;
    rows.push({
      nombreCompleto,
      celular,
      grupo,
      rangoEtario,
      rowNumber: r + 1,
    });
  }

  return { rows };
}
