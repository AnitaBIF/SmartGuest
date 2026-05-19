import * as XLSX from "xlsx";

const HEADERS = ["Nombre completo", "Celular", "Grupo", "Rango etario", "Cupos"] as const;

/** Descarga la plantilla .xlsx con columnas obligatorias por invitado. */
export function downloadInvitadosPlantilla() {
  // Sugerimos 1 cupo por defecto en cada fila vacía: el anfitrión solo cambia
  // las filas en las que la invitación cubre a más de una persona (familias).
  const emptyRows = Array.from({ length: 50 }, () => ["", "", "", "", 1]);
  const mainData: (string | number)[][] = [Array.from(HEADERS), ...emptyRows];
  const ws = XLSX.utils.aoa_to_sheet(mainData);
  ws["!cols"] = [{ wch: 32 }, { wch: 20 }, { wch: 28 }, { wch: 18 }, { wch: 10 }];

  const instr: string[][] = [
    ["Plantilla SmartGuest — invitados"],
    [""],
    ["«Nombre completo», «Celular», «Grupo» y «Rango etario» son obligatorios para cada fila que agregues."],
    ["«Cupos» es opcional: si lo dejás vacío se asume 1 (invitación individual)."],
    [""],
    ["Nombre completo", "Nombre y apellido del invitado."],
    ["Celular", "Incluir código de área (ej. +54 9 11 1234-5678)."],
    [
      "Grupo",
      "Identificador de familia o grupo de mesa. IMPORTANTE: si repetís exactamente el mismo texto en varias filas, SmartGuest las trata como una sola familia y genera una sola invitación (los cupos se calculan según esas filas y la columna Cupos). Para dos familias distintas usá textos distintos (ej. «Familia López», «Familia López 2»).",
    ],
    [
      "Rango etario",
      "Valores sugeridos: Niño, Adolescente, Joven, Adulto, Mayor (coinciden con SmartSeat).",
    ],
    [
      "Cupos",
      "Número entero entre 1 y 20: cuántas personas cubre esta invitación familiar. Si hay varias filas con el mismo «Grupo», se fusionan en una sola invitación; los cupos serán el mayor valor entre lo que pongas acá y la cantidad de filas de ese grupo. Si omitís la columna o la celda, cada fila cuenta al menos como 1 persona.",
    ],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instr);
  wsInstr["!cols"] = [{ wch: 22 }, { wch: 72 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invitados");
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

  XLSX.writeFile(wb, "plantilla-invitados.xlsx");
}
