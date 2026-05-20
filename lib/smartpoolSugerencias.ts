export function normalizeLocalidad(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto localidad/dirección sugiere Ciudad / AMBA (no confundir con “capital” de Tucumán). */
function blobPareceAMBA(localidad: string | null | undefined, direccion: string | null | undefined): boolean {
  const blob = `${localidad ?? ""} ${direccion ?? ""}`.toLowerCase();
  return (
    /buenos\s*aires|caba|ciudad\s*aut[oó]noma|capital\s*federal|gran\s*buenos|gba|amba|conurbano|zona\s*norte|zona\s*oeste|zona\s*sur/.test(blob) ||
    /vicente\s*lopez|san\s*isidro|tigre|san\s*fernando|malvinas|tres?\s*de\s*febrero|mor[oó]n|hurlingham|ituzaing[oó]|merlo|moreno|pilar|escobar|maschwitz|ezeiza|lan[uú]s|avellaneda|quilmes|berazategui|lomas\s*de\s*zamora|almirante\s*brown|esteban\s*echeverr[ií]a|la\s*matanza|general\s*san\s*mart[ií]n|san\s*miguel|jos[eé]\s*c\.\s*paz|don\s*torcuato|wilde|banfield|adrogu[eé]|temperley|avellaneda/i.test(
      blob,
    ) ||
    inferBarrioAMBA(localidad, direccion) != null
  );
}

/**
 * Barrios / zonas CABA + palabras típicas del AMBA para ordenar SmartPool sin GPS.
 * Orden: más específico primero.
 */
function inferBarrioAMBA(localidad: string | null | undefined, direccion: string | null | undefined): string | null {
  const blob = `${direccion ?? ""} ${localidad ?? ""}`;
  const rules: [RegExp, string][] = [
    [/\b(belgrano|av\.?\s*(cabildo|congreso|cr[aá]mer|cramer|virrey\s*olaguer|monroe))\b/i, "belgrano"],
    [/\b(nuñez|n[uú]nez|saavedra|coghlan)\b/i, "nunez_saavedra"],
    [/\b(colegiales)\b/i, "colegiales"],
    [/\b(palermo|las\s*cañitas|cañitas|hip[oó]dromo)\b/i, "palermo"],
    [/\b(recoleta|retiro|barrio\s*norte)\b/i, "recoleta_retiro"],
    [/\b(monserrat|san\s*nicol[aá]s|microcentro|congreso\s*\(caba\)|\bespaña\b|\bespana\b)\b/i, "centro_monserrat"],
    [/\b(san\s*telmo|la\s*boca|barracas|constituci[oó]n)\b/i, "sur_caba"],
    [/\b(almagro|boedo|caballito|paternal|velez\s*sarfield)\b/i, "centro_oeste_caba"],
    [/\b(villa\s*crespo|chacarita|agronom|parque\s*chas)\b/i, "villa_crespo_chacarita"],
    [/\b(flores|parque\s*chacabuco|floresta|villa\s*lugano|soldati)\b/i, "flores_sur"],
    [/\b(mataderos|liniers|villa\s*raffo)\b/i, "oeste_caba"],
    [/\b(villa\s*urquiza|parque\s*patricios|nueva\s*pompeya|pompeya)\b/i, "varios_caba"],
  ];
  for (const [re, code] of rules) {
    if (re.test(blob)) return code;
  }
  return null;
}

function esLocalidadGenericaCABA(normLoc: string): boolean {
  if (!normLoc) return false;
  const n = normLoc.trim();
  if (n === "caba" || n === "gba" || n === "bs as" || n === "bsas") return true;
  if (n === "capital federal") return true;
  if (/^buenos\s*aires$/.test(n)) return true;
  if (/^ciudad\s*autonoma/.test(n)) return true;
  if (n === "gran buenos aires") return true;
  return false;
}

/** Agrupa localidades de la región de Tucumán. No clasifica CABA/AMBA como “capital_metro” tucumano. */
function inferMetroTucuman(localidad: string | null | undefined, direccion: string | null | undefined): string {
  const blob = `${localidad ?? ""} ${direccion ?? ""}`.toLowerCase();
  if (blobPareceAMBA(localidad, direccion)) {
    return "desconocido";
  }
  if (/yerba\s*buena/.test(blob)) return "yerba_buena";
  if (/taf[ií]\s*viejo/.test(blob)) return "tafi_viejo";
  if (/lules/.test(blob)) return "lules";
  if (/banda\s*(del\s*)?r[ií]o|bandadelriosali/.test(blob)) return "banda";
  if (/alderetes/.test(blob)) return "alderetes";
  if (/el\s*manantial|manantial\s*tuc/.test(blob)) return "manantial";
  if (/cevil/.test(blob)) return "cevil";
  // Importante: no usar la palabra suelta "capital" (matchea "Capital Federal", CABA).
  if (
    /gran\s*san\s*miguel|tucum[aá]n|tucuman|^san\s*miguel(\s+de\s+tucum|\s+tucum)?\b|s\.?\s*m\.?\s*t\.?\s*\(?tucum/i.test(blob)
  ) {
    return "capital_metro";
  }
  return normalizeLocalidad(localidad) || "desconocido";
}

/** Heurística de barrio/zona dentro del ámbito urbano (texto libre). */
function inferZonaUrbana(localidad: string | null | undefined, direccion: string | null | undefined): string | null {
  if (blobPareceAMBA(localidad, direccion)) return null;
  const blob = `${direccion ?? ""} ${localidad ?? ""}`.toLowerCase();
  const rules: [RegExp, string][] = [
    [/\b(centro|microcentro|plaza\s*independencia|peatonal|9\s*de\s*julio)\b/i, "centro"],
    [/\b(barrio\s*norte|av\.?\s*mate\s*de\s*luna|mate\s*de\s*luna)\b/i, "norte_mate"],
    [/\b(av\.?\s*sarmiento|sarmiento)\b/i, "sarmiento"],
    [/\b(av\.?\s*mitre|congreso)\b/i, "este_centro"],
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

/** Señales comparables conductor ↔ pasajero (sin GPS). */
export type SmartpoolMatchSignals = {
  barrioMuyDistintoAMBA: boolean;
  mismaZonaUrbana: boolean;
  mismoBarrioAMBA: boolean;
  mismoMetro: boolean;
  localidadMatchFuerte: boolean;
  addrOverlap: number;
};

export function matchSignalsParaPasajero(
  conductor: ConductorCtx,
  p: { localidad: string | null; direccion: string | null },
): SmartpoolMatchSignals {
  const cLoc = normalizeLocalidad(conductor.localidad);
  const cMetro = inferMetroTucuman(conductor.localidad, conductor.direccion);
  const cZona = inferZonaUrbana(conductor.localidad, conductor.direccion);
  const cBarrioA = inferBarrioAMBA(conductor.localidad, conductor.direccion);
  const cAmba = blobPareceAMBA(conductor.localidad, conductor.direccion);

  const pLoc = normalizeLocalidad(p.localidad);
  const pMetro = inferMetroTucuman(p.localidad, p.direccion);
  const pZona = inferZonaUrbana(p.localidad, p.direccion);
  const pBarrioA = inferBarrioAMBA(p.localidad, p.direccion);
  const pAmba = blobPareceAMBA(p.localidad, p.direccion);

  const rawMismaLocalidad = Boolean(cLoc && pLoc === cLoc);
  const mismoBarrioAMBA = Boolean(cBarrioA && pBarrioA && cBarrioA === pBarrioA);
  const ambosEtiquetaGenericaBa = rawMismaLocalidad && esLocalidadGenericaCABA(cLoc) && esLocalidadGenericaCABA(pLoc);
  const barrioMuyDistintoAMBA = Boolean(
    cAmba && pAmba && cBarrioA && pBarrioA && cBarrioA !== pBarrioA,
  );

  let localidadMatchFuerte = rawMismaLocalidad;
  if (ambosEtiquetaGenericaBa) {
    if (barrioMuyDistintoAMBA) localidadMatchFuerte = false;
    else if (!mismoBarrioAMBA) localidadMatchFuerte = false;
  }

  const mismoMetro = cMetro === pMetro && cMetro !== "desconocido";
  const mismaZonaUrbana = Boolean(cZona && pZona && cZona === pZona);
  const addrOverlap = overlapDireccion(conductor.direccion, p.direccion);

  return {
    barrioMuyDistintoAMBA,
    mismaZonaUrbana,
    mismoBarrioAMBA,
    mismoMetro,
    localidadMatchFuerte,
    addrOverlap,
  };
}

/**
 * Negative → `a` va antes que `b` en la lista. Misma lógica que {@link rankPasajerosParaConductor}.
 */
export function compareHeuristicMatchSignals(a: SmartpoolMatchSignals, b: SmartpoolMatchSignals): number {
  if (a.barrioMuyDistintoAMBA && !b.barrioMuyDistintoAMBA) return 1;
  if (!a.barrioMuyDistintoAMBA && b.barrioMuyDistintoAMBA) return -1;
  if (a.mismaZonaUrbana && !b.mismaZonaUrbana) return -1;
  if (!a.mismaZonaUrbana && b.mismaZonaUrbana) return 1;
  if (a.mismoBarrioAMBA && !b.mismoBarrioAMBA) return -1;
  if (!a.mismoBarrioAMBA && b.mismoBarrioAMBA) return 1;
  if (a.mismoMetro && !b.mismoMetro) return -1;
  if (!a.mismoMetro && b.mismoMetro) return 1;
  if (a.localidadMatchFuerte && !b.localidadMatchFuerte) return -1;
  if (!a.localidadMatchFuerte && b.localidadMatchFuerte) return 1;
  if (b.addrOverlap !== a.addrOverlap) return b.addrOverlap - a.addrOverlap;
  return 0;
}

type Scored = PasajeroRow & SmartpoolMatchSignals & {
  distanciaKm: null;
};

/**
 * Orden solo con datos de BD (localidad + dirección).
 * Incluye región de Tucumán (capital, Yerba Buena, Tafí Viejo, etc.) y heurísticas AMBA/CABA (sin GPS).
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
  max = 12,
): SugerenciaSmartpool[] {
  const scored: Scored[] = pasajeros.map((p) => {
    const sig = matchSignalsParaPasajero(conductor, p);
    return {
      id: p.id,
      nombre: nombreLista(p.nombre, p.apellido),
      localidad: p.localidad,
      direccion: p.direccion,
      lat: null,
      lng: null,
      distanciaKm: null,
      ...sig,
    };
  });

  scored.sort((a, b) => {
    const c = compareHeuristicMatchSignals(a, b);
    if (c !== 0) return c;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return scored.slice(0, max).map((r) => {
    let motivo: string;
    if (r.mismaZonaUrbana) {
      motivo =
        r.addrOverlap > 0
          ? "Misma zona de la ciudad · calle o referencia parecida"
          : "Misma zona en la capital (San Miguel de Tucumán)";
    } else if (r.mismoBarrioAMBA) {
      motivo =
        r.addrOverlap > 0
          ? "Misma zona/barrio aproximado (AMBA/CABA) · referencia parecida"
          : "Misma zona/barrio aproximado en Ciudad o AMBA";
    } else if (r.mismoMetro) {
      motivo =
        r.addrOverlap > 0
          ? "Misma región (capital, Yerba Buena, Tafí Viejo…) · texto de dirección parecido"
          : "Misma región alrededor de Tucumán (ej. capital, Yerba Buena, Tafí Viejo)";
    } else if (r.localidadMatchFuerte) {
      motivo =
        r.addrOverlap > 0
          ? "Misma localidad · dirección parecida a la tuya"
          : "Misma localidad que vos";
    } else {
      motivo = "Mismo evento · orden aproximado por texto de dirección";
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

/** Región para el modelo de ordenamiento por IA (texto libre). */
export type SmartpoolRegionIa = "amba" | "tucuman" | "otro";

export function inferRegionSmartpoolIa(localidad: string | null, direccion: string | null): SmartpoolRegionIa {
  if (blobPareceAMBA(localidad, direccion)) return "amba";
  const blob = `${localidad ?? ""} ${direccion ?? ""}`.toLowerCase();
  if (/tucum[aá]n|tucuman|yerba\s*buena|taf[ií]\s*viejo|lules|alderetes|banda\s*del|san\s*miguel\s+de|gran\s*san\s*miguel/.test(blob)) {
    return "tucuman";
  }
  return "otro";
}
