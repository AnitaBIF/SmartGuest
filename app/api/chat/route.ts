import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { adminServiceClient } from "@/lib/adminSalonAuth";
import { CHAT_APP_GUIDE } from "@/lib/chatAssistantAppGuide";
import { buildChatRoleContext } from "@/lib/chatAssistantContext";
import { getChatContextIfFresh, setChatContextCache } from "@/lib/chatContextSessionCache";
import { completeAssistantReply, resolveAssistantEngine, type ChatMessage } from "@/lib/chatAssistantReply";
import { guidedMenuFromContext, guidedMenuOptionLabels, liveDataDigestForChat } from "@/lib/chatRuleBasedReply";

const ALLOWED_TIPOS = new Set([
  "invitado",
  "anfitrion",
  "administrador",
  "jefe_cocina",
  "seguridad",
]);

function parseClientMessages(body: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!body || typeof body !== "object") return [];
  const m = (body as { messages?: unknown }).messages;
  if (!Array.isArray(m)) return [];
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const item of m) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (!trimmed) continue;
    if (trimmed.length > 8000) continue;
    out.push({ role, content: trimmed.slice(0, 8000) });
  }
  return out.slice(-24);
}

/** Resumen factual leído de la BD (sin historial de chat). Útil al abrir el panel. */
export async function GET(req: NextRequest) {
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const db = adminServiceClient();
  const { data: perfil, error: pErr } = await db
    .from("usuarios")
    .select("tipo")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr || !perfil?.tipo || !ALLOWED_TIPOS.has(perfil.tipo)) {
    return NextResponse.json({ error: "Tu cuenta no puede usar el asistente." }, { status: 403 });
  }

  const ctx = await buildChatRoleContext(db, user.id, perfil.tipo);
  if (!("ok" in ctx) || !ctx.ok) {
    return NextResponse.json({ error: "error" in ctx ? ctx.error : "Sin contexto." }, { status: 400 });
  }
  setChatContextCache(user.id, perfil.tipo, ctx);

  const digest = liveDataDigestForChat(ctx.contextJson);
  const engine = resolveAssistantEngine();
  const guidedMenu = guidedMenuFromContext(ctx.contextJson);
  return NextResponse.json(
    { digest, engine, guidedMenu, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}

export async function POST(req: NextRequest) {
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const db = adminServiceClient();
  const { data: perfil, error: pErr } = await db
    .from("usuarios")
    .select("tipo")
    .eq("id", user.id)
    .maybeSingle();

  if (pErr || !perfil?.tipo || !ALLOWED_TIPOS.has(perfil.tipo)) {
    return NextResponse.json({ error: "Tu cuenta no puede usar el asistente." }, { status: 403 });
  }

  const tipo = perfil.tipo;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const clientMsgs = parseClientMessages(body);
  if (clientMsgs.length === 0 || clientMsgs[clientMsgs.length - 1]?.role !== "user") {
    return NextResponse.json(
      { error: "Enviá «messages» con al menos un mensaje final del usuario." },
      { status: 400 }
    );
  }

  const lastUserContent = clientMsgs[clientMsgs.length - 1]?.content ?? "";
  const preferCachedContext = lastUserContent.startsWith("sg:");
  const cached = preferCachedContext ? getChatContextIfFresh(user.id, tipo) : null;
  const ctx =
    cached ??
    (await buildChatRoleContext(db, user.id, tipo));
  if (!("ok" in ctx) || !ctx.ok) {
    return NextResponse.json({ error: "error" in ctx ? ctx.error : "Sin contexto." }, { status: 400 });
  }
  setChatContextCache(user.id, tipo, ctx);

  const factsBlock = `Datos confiables del sistema (JSON; usalos como única fuente de hechos sobre el evento o el salón):\n${ctx.contextJson}`;
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${ctx.system}\n\n--- Guía de la aplicación (funcionamiento y rutas) ---\n${CHAT_APP_GUIDE}\n\n${factsBlock}`,
    },
    ...clientMsgs.map((m) => ({ role: m.role, content: m.content })),
  ];

  const { text, guidedMenu } = await completeAssistantReply(messages, ctx.contextJson);

  const payload: Record<string, unknown> = { reply: text };
  if (guidedMenu != null) {
    payload.guidedMenu = guidedMenu;
    payload.menuOptionLabels = guidedMenuOptionLabels(guidedMenu);
  }

  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
