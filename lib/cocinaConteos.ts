import { mapUiMenuToInvitadoColumns, parseGrupoMenusJson } from "./grupoFamiliar";

/** Alineado con anfitrion/restricciones: textos guardados en DB y etiquetas de UI. */
export function categoriaMenu(
  restriccion: string | null | undefined,
  restriccionOtro: string | null | undefined
): "standard" | "celiaco" | "vegetariano" | "otro" {
  const r = (restriccion ?? "").trim().toLowerCase();
  if (!r || r === "ninguna" || r === "standard" || r.includes("standard")) return "standard";
  if (
    r.includes("celiac") ||
    r.includes("celíac") ||
    r.includes("tacc") ||
    r === "sin tacc" ||
    r === "celiaco" ||
    r === "celíaco"
  ) {
    return "celiaco";
  }
  if (r.includes("vegetar") || r.includes("vegano") || r === "veg/veg" || r === "vegano/vegetariano") {
    return "vegetariano";
  }
  if (r === "otro" && restriccionOtro?.trim()) return "otro";
  if (r === "otro") return "otro";
  return "otro";
}

export type MenuBuckets = {
  standard: number;
  celiaco: number;
  vegVeg: number;
  otros: number;
  otrosDetalles: Record<string, number>;
};

export function emptyMenuBuckets(): MenuBuckets {
  return { standard: 0, celiaco: 0, vegVeg: 0, otros: 0, otrosDetalles: {} };
}

function addPersonaToBuckets(
  buckets: MenuBuckets,
  restriccion_alimentaria: string | null,
  restriccion_otro: string | null
) {
  const cat = categoriaMenu(restriccion_alimentaria, restriccion_otro);
  if (cat === "standard") buckets.standard++;
  else if (cat === "celiaco") buckets.celiaco++;
  else if (cat === "vegetariano") buckets.vegVeg++;
  else {
    buckets.otros++;
    const detKey =
      restriccion_alimentaria?.trim().toLowerCase() === "otro" && restriccion_otro?.trim()
        ? restriccion_otro.trim().toLowerCase()
        : restriccion_alimentaria?.trim().toLowerCase() || "otro";
    buckets.otrosDetalles[detKey] = (buckets.otrosDetalles[detKey] ?? 0) + 1;
  }
}

/** Una fila invitados = grupo; cada persona en grupo_menus_json suma un cubierto. */
export function menuBucketsFromInvitado(inv: {
  restriccion_alimentaria: string | null;
  restriccion_otro: string | null;
  grupo_menus_json: unknown;
}): MenuBuckets {
  const menus = parseGrupoMenusJson(inv.grupo_menus_json);
  const buckets = emptyMenuBuckets();

  if (menus.length > 0) {
    for (const p of menus) {
      const cols = mapUiMenuToInvitadoColumns(p.restriccion, p.restriccionOtro);
      addPersonaToBuckets(buckets, cols.restriccion_alimentaria, cols.restriccion_otro);
    }
    return buckets;
  }

  addPersonaToBuckets(buckets, inv.restriccion_alimentaria, inv.restriccion_otro);
  return buckets;
}

export function mergeMenuBuckets(a: MenuBuckets, b: MenuBuckets): MenuBuckets {
  const otrosDetalles = { ...a.otrosDetalles };
  for (const [k, v] of Object.entries(b.otrosDetalles)) {
    otrosDetalles[k] = (otrosDetalles[k] ?? 0) + v;
  }
  return {
    standard: a.standard + b.standard,
    celiaco: a.celiaco + b.celiaco,
    vegVeg: a.vegVeg + b.vegVeg,
    otros: a.otros + b.otros,
    otrosDetalles,
  };
}

export function bucketsToMenusPayload(b: MenuBuckets): {
  standard: number;
  celiaco: number;
  vegVeg: number;
  otros: number;
  otrosDetalle?: string;
} {
  const otrosDetalle =
    Object.entries(b.otrosDetalles)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ") || undefined;
  return {
    standard: b.standard,
    celiaco: b.celiaco,
    vegVeg: b.vegVeg,
    otros: b.otros,
    otrosDetalle,
  };
}
