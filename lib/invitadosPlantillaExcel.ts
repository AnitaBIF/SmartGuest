import * as XLSX from "xlsx";

const HEADERS = ["Nombre completo", "Celular", "Grupo", "Rango etario"] as const;

/** Descarga la plantilla .xlsx con columnas obligatorias por invitado. */
export function downloadInvitadosPlantilla() {
  const emptyRows = Array.from({ length: 50 }, () => ["", "", "", ""]);
  const mainData: string[][] = [Array.from(HEADERS), ...emptyRows];
  const ws = XLSX.utils.aoa_to_sheet(mainData);
  ws["!cols"] = [{ wch: 32 }, { wch: 20 }, { wch: 28 }, { wch: 18 }];

  const instr: string[][] = [
    ["Plantilla SmartGuest — invitados"],
    [""],
    ["Todas las columnas de la hoja «Invitados» son obligatorias para cada fila que agregues."],
    [""],
    ["Nombre completo", "Nombre y apellido del invitado."],
    ["Celular", "Incluir código de área (ej. +54 9 11 1234-5678)."],
    [
      "Grupo",
      "Ej.: Familia, Amigos Universidad, Amigos Escuela, Compañeros Trabajo, Otros (texto libre para agrupar en SmartSeat).",
    ],
    [
      "Rango etario",
      "Valores sugeridos: Niño, Adolescente, Joven, Adulto, Mayor (coinciden con SmartSeat).",
    ],
  ];
  const wsInstr = XLSX.utils.aoa_to_sheet(instr);
  wsInstr["!cols"] = [{ wch: 22 }, { wch: 72 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invitados");
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucciones");

  XLSX.writeFile(wb, "plantilla-invitados.xlsx");
}
