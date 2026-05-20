/**
 * Ordena pasajeros con modelo de lenguaje (sin GPS): región de Tucumán.
 * Requiere OPENAI_API_KEY o SMARTGUEST_OPENAI_API_KEY en el servidor.
 */

export type PasajeroIaInput = {
  id: string;
  localidad: string | null;
  direccion: string | null;
  nombre: string;
};

export type SugerenciaIa = {
  invitadoId: string;
  nombre: string;
  localidad: string | null;
  motivo: string;
  distanciaKm: null;
};

type OpenAiOrden = { id: string; motivo: string };

function parseOrdenJson(raw: string): OpenAiOrden[] | null {
  try {
    const j = JSON.parse(raw) as { orden?: unknown };
    if (!Array.isArray(j.orden)) return null;
    const out: OpenAiOrden[] = [];
    for (const x of j.orden) {
      if (
        typeof x === "object" &&
        x !== null &&
        typeof (x as { id?: string }).id === "string" &&
        typeof (x as { motivo?: string }).motivo === "string"
      ) {
        out.push({ id: (x as { id: string }).id, motivo: (x as { motivo: string }).motivo.trim() });
      }
    }
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

const JSON_SCHEMA_HINT =
  '{"orden":[{"id":"<uuid del pasajero>","motivo":"frase corta en español, máx. 120 caracteres, explicando por qué conviene el viaje compartido"}]}';

const SYSTEM_PROMPT_SMARTPOOL_TUCUMAN = `Sos experto en geografía de la región de Tucumán, Argentina. Trabajá pensando en localidades distintas con trayectos reales entre ellas: San Miguel de Tucumán (capital), Yerba Buena, Tafí Viejo, Lules, Banda del Río Salí, Alderetes, El Manantial, Cevil Redondo, etc. Entre capital, Yerba Buena y Tafí Viejo las distancias suelen ser largas para ir y volver: quien viva claramente más lejos del conductor debe ir abajo en el ranking salvo que el texto indique que quedan muy cerca (misma calle, mismo barrio de la capital, referencias casi iguales).
Conocés la ciudad capital por zonas (Centro, Norte, Sur, Este, Oeste) y avenidas típicas (Av. Mate de Luna, Av. Sarmiento, Av. Roca, Av. Alem, Circunvalación, etc.).

Recibís direcciones en texto tal como las cargaron los invitados (sin coordenadas GPS).
Ordená los pasajeros del que probablemente quede MÁS CERCA o más conveniente para compartir viaje con el conductor, al MENOS conveniente.

Reglas estrictas:
(1) No inventes tiempos en minutos, kilómetros ni rutas: no tenés GPS ni mapa. En el "motivo" no uses “a 5 min”, “10 minutos”, etc.
(2) Misma localidad o mismo municipio/clúster del texto debe ir claramente antes que otra localidad distinta cuando el texto lo deje en evidencia.
(3) Si dos direcciones son de zonas claramente lejanas dentro de la misma ciudad (Centro vs extremos, norte vs sur de la capital) o entre capital, Yerba Buena y municipios del Gran Tucumán, el más lejano debe ir abajo.

Respondé SOLO un JSON válido con esta forma exacta:
${JSON_SCHEMA_HINT}
Incluí cada id de pasajero exactamente una vez. No inventes ids.`;

/**
 * Devuelve sugerencias ordenadas o `null` si falla la API / el parseo (usar heurística).
 */
export async function rankPasajerosConIaTucuman(
  conductor: { localidad: string | null; direccion: string | null },
  pasajeros: PasajeroIaInput[],
  apiKey: string
): Promise<SugerenciaIa[] | null> {
  if (pasajeros.length === 0) return [];

  const model =
    process.env.SMARTPOOL_OPENAI_MODEL?.trim() ||
    process.env.SMARTGUEST_OPENAI_MODEL?.trim() ||
    "gpt-4o-mini";

  const payload = {
    conductor: {
      localidad: conductor.localidad ?? "",
      direccion: conductor.direccion ?? "",
    },
    pasajeros: pasajeros.map((p) => ({
      id: p.id,
      localidad: p.localidad ?? "",
      direccion: p.direccion ?? "",
      nombre: p.nombre,
    })),
  };

  const user = `Datos (JSON):\n${JSON.stringify(payload, null, 0)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 18_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.25,
        max_tokens: 2500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT_SMARTPOOL_TUCUMAN },
          { role: "user", content: user },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const orden = parseOrdenJson(text);
    if (!orden) return null;

    const byId = new Map(pasajeros.map((p) => [p.id.trim().toLowerCase(), p]));
    const seen = new Set<string>();
    const out: SugerenciaIa[] = [];
    const motivoDefault = "Cercanía en la región (capital, Yerba Buena, Tafí Viejo, etc.) según direcciones";

    for (const row of orden) {
      const key = row.id.trim().toLowerCase();
      const p = byId.get(key);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        invitadoId: p.id.trim().toLowerCase(),
        nombre: p.nombre,
        localidad: p.localidad,
        motivo: row.motivo || motivoDefault,
        distanciaKm: null,
      });
    }

    for (const p of pasajeros) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({
        invitadoId: p.id.trim().toLowerCase(),
        nombre: p.nombre,
        localidad: p.localidad,
        motivo: "Mismo evento (orden sugerido por dirección)",
        distanciaKm: null,
      });
    }

    return out;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}
