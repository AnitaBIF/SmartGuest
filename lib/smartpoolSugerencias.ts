export function normalizeLocalidad(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Agrupa localidades del Gran Tucumán para comparar “misma zona metropolitana”. */
function inferMetroTucuman(localidad: string | null | undefined, direccion: string | null | undefined): string {
  const blob = `${localidad ?? ""} ${direccion ?? ""}`.toLowerCase();
  if (/yerba\s*buena/.test(blob)) return "yerba_buena";
  if (/taf[ií]\s*viejo/.test(blob)) return "tafi_viejo";
  if (/lules/.test(blob)) return "lules";
  if (/banda\s*(del\s*)?r[ií]o|bandadelriosali/.test(blob)) return "banda";
  if (/alderetes/.test(blob)) return "alderetes";
  if (/el\s*manantial|manantial\s*tuc/.test(blob)) return "manantial";
  if (/cevil/.test(blob)) return "cevil";
  if (/gran\s*san\s*miguel|tucum[aá]n|tucuman|san\s*miguel(\s+de)?|capital|s\.?\s*m\.?\s*t\.?/.test(blob)) {
    return "capital_metro";
  }
  return normalizeLocalidad(localidad) || "desconocido";
}

/** Heurística de barrio/zona dentro del ámbito urbano (texto libre). */
function inferZonaUrbana(localidad: string | null | undefined, direccion: string | null | undefined): string | null {
  const blob = `${direccion ?? ""} ${localidad ?? ""}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(centro|microcentro|plaza\s*independencia|peatonal|9\s*de\s*julio)\b/i, "centro"],
    [/\b(barrio\s*norte|av\.?\s*mate\s*de\s*luna|mate\s*de\s*luna)\b/i, "norte_mate"],
    [/\b(av\.?\s*sarmiento|sarmiento)\b/i, "sarmiento"],
    [/\b(av\.?\s*roca|mitre|congreso)\b/i, "este_centro"],
    [/\b(sur|lastenia|san\s*mart[ií]n)\b/i, "sur"],
    [/\b(oeste|lola\s*mora|municipalidad)\b/i, "oeste"],
    [/\b(yerba\s*buena|ipona|lola\s*mora\s*yb)\b/i, "yerba_buena_z"],
    [/\b(taf[ií]\s*viejo)\b/i, "tafi_z"],
  ];
  for (const [re, z] of rules) {
    if (re.test(blob)) return z;
  }
  return null;
}

function tokenizeDireccion(s: string | null | undefined): Set<string> {
  const t = normalizeLocalidad(s).replace(/[^\p{L}\p{N}\s]/gu, " ");
  const set = new Set<string>();
  for (const w of t.split(/\s+/)) {
    if (w.length >= 2) set.add(w);
  }
  return set;
}

function overlapDireccion(a: string | null | undefined, b: string | null | undefined): number {
  const A = tokenizeDireccion(a);
  const B = tokenizeDireccion(b);
  if (A.size === 0 || B.size === 0) return 0;
  let n = 0;
  for (const x of A) {
    if (B.has(x)) n++;
  }
  return n;
}

export type ConductorCtx = {
  localidad: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
};

export type PasajeroRow = {
  id: string;
  nombre: string;
  localidad: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
};

export type SugerenciaSmartpool = {
  invitadoId: string;
  nombre: string;
  localidad: string | null;
  motivo: string;
  distanciaKm: number | null;
};

function nombreLista(nombre: string, apellido: string): string {
  const n = nombre.trim();
  const a = apellido.trim();
  if (!a) return n || "Invitado/a";
  const ini = a[0]!.toUpperCase();
  return `${n} ${ini}.`.trim();
}

export function nombreListaDesdeUsuario(nombre: string, apellido: string): string {
  return nombreLista(nombre, apellido);
}

type Scored = PasajeroRow & {
  distanciaKm: null;
  mismaLocalidad: boolean;
  addrOverlap: number;
  mismoMetro: boolean;
  mismaZonaUrbana: boolean;
};

/**
 * Orden solo con datos de BD (localidad + dirección), optimizado para Gran Tucumán.
 * No usa GPS.
 */
export function rankPasajerosParaConductor(
  conductor: ConductorCtx,
  pasajeros: Array<{
    id: string;
    localidad: string | null;
    direccion: string | null;
    smartpool_lat: number | null;
    smartpool_lng: number | null;
    nombre: string;
    apellido: string;
  }>,
  max = 12
): SugerenciaSmartpool[] {
  const cLoc = normalizeLocalidad(conductor.localidad);
  const cMetro = inferMetroTucuman(conductor.localidad, conductor.direccion);
  const cZona = inferZonaUrbana(conductor.localidad, conductor.direccion);

  const scored: Scored[] = pasajeros.map((p) => {
    const pMetro = inferMetroTucuman(p.localidad, p.direccion);
    const pZona = inferZonaUrbana(p.localidad, p.direccion);
    const mismaLocalidad = Boolean(cLoc && normalizeLocalidad(p.localidad) === cLoc);
    const mismoMetro = cMetro === pMetro && cMetro !== "desconocido";
    const mismaZonaUrbana = Boolean(cZona && pZona && cZona === pZona);
    const addrOverlap = overlapDireccion(conductor.direccion, p.direccion);
    return {
      id: p.id,
      nombre: nombreLista(p.nombre, p.apellido),
      localidad: p.localidad,
      direccion: p.direccion,
      lat: null,
      lng: null,
      distanciaKm: null,
      mismaLocalidad,
      addrOverlap,
      mismoMetro,
      mismaZonaUrbana,
    };
  });

  scored.sort((a, b) => {
    if (a.mismaZonaUrbana && !b.mismaZonaUrbana) return -1;
    if (!a.mismaZonaUrbana && b.mismaZonaUrbana) return 1;
    if (a.mismoMetro && !b.mismoMetro) return -1;
    if (!a.mismoMetro && b.mismoMetro) return 1;
    if (a.mismaLocalidad && !b.mismaLocalidad) return -1;
    if (!a.mismaLocalidad && b.mismaLocalidad) return 1;
    if (b.addrOverlap !== a.addrOverlap) return b.addrOverlap - a.addrOverlap;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return scored.slice(0, max).map((r) => {
    let motivo: string;
    if (r.mismaZonaUrbana) {
      motivo =
        r.addrOverlap > 0
          ? "Misma zona de la ciudad · calle o referencia parecida"
          : "Misma zona urbana aproximada que vos (Tucumán)";
    } else if (r.mismoMetro) {
      motivo =
        r.addrOverlap > 0
          ? "Gran Tucumán · dirección con palabras en común"
          : "Misma área metropolitana (Gran Tucumán)";
    } else if (r.mismaLocalidad) {
      motivo =
        r.addrOverlap > 0
          ? "Misma localidad · dirección parecida a la tuya"
          : "Misma localidad que vos";
    } else {
      motivo = "Mismo evento · disponible como pasajero";
    }
    return {
      invitadoId: r.id,
      nombre: r.nombre,
      localidad: r.localidad,
      motivo,
      distanciaKm: null,
    };
  });
}
