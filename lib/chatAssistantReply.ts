import { ruleBasedChatReply, ruleBasedChatReplyMeta, type GuidedMenuPayload } from "@/lib/chatRuleBasedReply";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type AssistantEngine = "rules" | "gemini" | "groq" | "openai";

function normalizeEnvKey(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let k = raw.replace(/^\uFEFF/, "").replace(/\r/g, "").trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k || undefined;
}

function geminiKeyPresent(): boolean {
  return Boolean(
    normalizeEnvKey(process.env.GEMINI_API_KEY) ??
      normalizeEnvKey(process.env.GOOGLE_AI_API_KEY) ??
      normalizeEnvKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
  );
}

/**
 * - `rules` / `off`: solo motor de reglas (sin API externa).
 * - `gemini` | `groq` | `openai`: fuerza ese proveedor si hay clave (si no, reglas).
 * - `auto` (por defecto): Gemini → Groq → reglas. OpenAI no entra en `auto` (evita usar API de pago por accidente si solo quedó la clave en `.env`); para OpenAI hay que poner `SMARTGUEST_CHAT_LLM=openai`.
 */
export function resolveAssistantEngine(): AssistantEngine {
  const raw = (process.env.SMARTGUEST_CHAT_LLM ?? "auto").trim().toLowerCase();
  if (raw === "rules" || raw === "off") return "rules";
  if (raw === "gemini") return geminiKeyPresent() ? "gemini" : "rules";
  if (raw === "groq") return normalizeEnvKey(process.env.GROQ_API_KEY) ? "groq" : "rules";
  if (raw === "openai") return normalizeEnvKey(process.env.OPENAI_API_KEY) ? "openai" : "rules";

  if (geminiKeyPresent()) return "gemini";
  if (normalizeEnvKey(process.env.GROQ_API_KEY)) return "groq";
  return "rules";
}

function splitSystemAndRest(messages: ChatMessage[]): { system: string; rest: ChatMessage[] } {
  const systemParts: string[] = [];
  const rest: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") systemParts.push(m.content);
    else if (m.role === "user" || m.role === "assistant") rest.push(m);
  }
  return { system: systemParts.join("\n\n").trim(), rest };
}

function withConversationalHint(messages: ChatMessage[]): ChatMessage[] {
  const hint =
    "Estilo: español rioplatense, **muy breve** (ideal 1–4 oraciones), al grano. Sin presentación tipo «soy tu asistente» ni párrafos de relleno. Contestá **solo** lo preguntado. **Datos** (cuántos, confirmados, listas, restricciones): números y nombres del JSON, **sin** rutas /anfitrion/… como respuesta principal. **Soporte** (cómo, dónde configuro): recién ahí rutas cortas. No pegues JSON ni un volcado enorme salvo que el usuario pida explícitamente todo el detalle / estado completo / equivalente en lenguaje natural.";
  return messages.map((m, i) =>
    m.role === "system" && i === 0 ? { ...m, content: `${hint}\n\n${m.content}` } : m
  );
}

async function completeOpenAi(messages: ChatMessage[]): Promise<{ text: string } | { error: string }> {
  const key = normalizeEnvKey(process.env.OPENAI_API_KEY);
  if (!key) return { error: "OPENAI_API_KEY no está configurada." };

  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.55,
      max_tokens: 1024,
    }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof raw?.error?.message === "string" ? raw.error.message : `OpenAI ${res.status}`;
    return { error: msg };
  }
  const text = raw?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) return { error: "Respuesta vacía del modelo." };
  return { text: text.trim() };
}

async function completeGroq(messages: ChatMessage[]): Promise<{ text: string } | { error: string }> {
  const key = normalizeEnvKey(process.env.GROQ_API_KEY);
  if (!key) return { error: "GROQ_API_KEY no está configurada." };

  const model = process.env.GROQ_CHAT_MODEL?.trim() || "llama-3.1-8b-instant";
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.55,
      max_tokens: 1024,
    }),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof raw?.error?.message === "string" ? raw.error.message : `Groq ${res.status}`;
    return { error: msg };
  }
  const text = raw?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) return { error: "Respuesta vacía del modelo." };
  return { text: text.trim() };
}

async function completeGemini(messages: ChatMessage[]): Promise<{ text: string } | { error: string }> {
  const key =
    normalizeEnvKey(process.env.GEMINI_API_KEY) ??
    normalizeEnvKey(process.env.GOOGLE_AI_API_KEY) ??
    normalizeEnvKey(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  if (!key) {
    return { error: "GEMINI_API_KEY (o GOOGLE_AI_API_KEY) no está configurada." };
  }

  const model = process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-2.0-flash";
  const { system, rest } = splitSystemAndRest(messages);

  const contents = rest.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: 0.55,
      maxOutputTokens: 1024,
    },
  };
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof raw?.error?.message === "string"
        ? raw.error.message
        : typeof raw?.error === "string"
          ? raw.error
          : `Gemini ${res.status}`;
    return { error: msg };
  }

  const parts = raw?.candidates?.[0]?.content?.parts;
  const text =
    Array.isArray(parts) && parts[0] && typeof parts[0].text === "string" ? parts[0].text : "";
  if (!text.trim()) return { error: "Respuesta vacía del modelo." };
  return { text: text.trim() };
}

/**
 * Motor del asistente: con `SMARTGUEST_CHAT_LLM=auto` (default) usa Gemini o Groq si hay clave; si no, reglas + datos de BD.
 * OpenAI solo con `SMARTGUEST_CHAT_LLM=openai` y `OPENAI_API_KEY`.
 */
export async function completeAssistantReply(
  messages: ChatMessage[],
  contextJson: string
): Promise<{ text: string; guidedMenu?: GuidedMenuPayload }> {
  const engine = resolveAssistantEngine();
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUser?.content?.trim() ?? "";

  /** Navegación por menú guiado: siempre motor de reglas + `guidedMenu` (también con Gemini/Groq). */
  if (lastUserText.trim().startsWith("sg:")) {
    const m = ruleBasedChatReplyMeta(contextJson, lastUserText);
    return { text: m.reply, ...(m.guidedMenu ? { guidedMenu: m.guidedMenu } : {}) };
  }

  if (engine === "rules") {
    const m = ruleBasedChatReplyMeta(contextJson, lastUserText);
    return { text: m.reply, ...(m.guidedMenu ? { guidedMenu: m.guidedMenu } : {}) };
  }

  const llmMessages = withConversationalHint(messages);

  if (engine === "openai") {
    const r = await completeOpenAi(llmMessages);
    if ("text" in r) return r;
    return { text: ruleBasedChatReply(contextJson, lastUserText) };
  }

  if (engine === "groq") {
    const r = await completeGroq(llmMessages);
    if ("text" in r) return r;
    return { text: ruleBasedChatReply(contextJson, lastUserText) };
  }

  if (engine === "gemini") {
    const r = await completeGemini(llmMessages);
    if ("text" in r) return r;
    return { text: ruleBasedChatReply(contextJson, lastUserText) };
  }

  return { text: ruleBasedChatReply(contextJson, lastUserText) };
}
