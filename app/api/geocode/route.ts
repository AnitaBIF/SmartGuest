import { NextRequest, NextResponse } from "next/server";

type NominatimHit = { lat: string; lon: string };

function buildSearchVariants(raw: string): string[] {
  const q = raw.trim();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length < 4 || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  add(q);
  if (!/\bargentin/i.test(q)) add(`${q}, Argentina`);
  const m = q.match(/^[^—–\-]+[—–\-]\s*(.+)$/);
  if (m?.[1]) {
    const addr = m[1].trim();
    add(addr);
    if (!/\bargentin/i.test(addr)) add(`${addr}, Argentina`);
  }
  return out;
}

/**
 * Geocodificación vía Nominatim (p. ej. para uso futuro o herramientas internas).
 * El mapa en la app usa embed de Google; esta ruta prueba varias variantes de texto.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 4) {
    return NextResponse.json({ error: "Consulta demasiado corta." }, { status: 400 });
  }

  const userAgent =
    process.env.GEOCODE_USER_AGENT?.trim() ||
    "SmartGuest/1.0 (event map; https://github.com/)";

  try {
    for (const variant of buildSearchVariants(q)) {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "json");
      url.searchParams.set("q", variant);
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "ar");

      const res = await fetch(url.toString(), {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/json",
          "Accept-Language": "es,en",
        },
        next: { revalidate: 86_400 },
      });

      if (!res.ok) continue;
      const data = (await res.json()) as NominatimHit[];
      const hit = data[0];
      if (!hit?.lat || !hit?.lon) continue;
      const lat = parseFloat(hit.lat);
      const lon = parseFloat(hit.lon);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        return NextResponse.json({ lat, lon, variantUsed: variant });
      }
    }
  } catch {
    return NextResponse.json({ error: "No se pudo contactar el servicio de mapas." }, { status: 502 });
  }

  return NextResponse.json({ error: "No se encontró la ubicación." }, { status: 404 });
}
