"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GuidedMenuOption, GuidedMenuPayload } from "@/lib/chatRuleBasedReply";

type ChatLine = { role: "user" | "assistant"; content: string; displayLabel?: string };

function engineBadgeText(engine: string | null): string {
  if (engine === "gemini") return "Gemini";
  if (engine === "groq") return "Groq";
  if (engine === "openai") return "OpenAI";
  if (engine === "rules") return "Solo datos (reglas)";
  return engine ? String(engine) : "…";
}

function engineSubtitle(engine: string | null): string {
  if (engine === "gemini" || engine === "groq") return "Modelo externo (clave en servidor).";
  if (engine === "openai") return "OpenAI (config manual).";
  if (engine === "rules") return "Reglas + datos del evento (sin API de chat).";
  return "Datos en vivo.";
}

function isGuidedMenuPayload(x: unknown): x is GuidedMenuPayload {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  if (typeof o.greeting !== "string" || !Array.isArray(o.options)) return false;
  return (o.options as unknown[]).every(
    (it) =>
      it &&
      typeof it === "object" &&
      typeof (it as Record<string, unknown>).value === "string" &&
      typeof (it as Record<string, unknown>).label === "string"
  );
}

export function AssistantChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [digest, setDigest] = useState<string | null>(null);
  const [digestLoading, setDigestLoading] = useState(false);
  const [digestError, setDigestError] = useState("");
  const [engineLabel, setEngineLabel] = useState<string | null>(null);
  const [guidedMenu, setGuidedMenu] = useState<GuidedMenuPayload | null>(null);
  const [bootReady, setBootReady] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollBottom = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollBottom();
  }, [lines, open, loading, guidedMenu, scrollBottom]);

  const loadDigest = useCallback((mode: "bootstrap" | "digestOnly") => {
    setDigestLoading(true);
    setDigestError("");
    fetch("/api/chat", { method: "GET", credentials: "same-origin", cache: "no-store" })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setDigest(null);
          setDigestError(typeof d?.error === "string" ? d.error : "No se pudo cargar el resumen.");
          if (mode === "bootstrap") {
            setGuidedMenu(null);
            setLines([
              {
                role: "assistant",
                content: "Hola, ¿qué necesitás? No se pudo cargar el menú. Probá de nuevo más tarde.",
              },
            ]);
            setBootReady(true);
          }
          return;
        }
        const text = typeof d?.digest === "string" ? d.digest : "";
        setDigest(text || null);
        if (!text) setDigestError("Sin datos para mostrar.");
        const eng = typeof d?.engine === "string" ? d.engine : null;
        setEngineLabel(eng);

        const gm = isGuidedMenuPayload(d?.guidedMenu) ? d.guidedMenu : null;
        if (mode === "digestOnly") {
          if (gm) setGuidedMenu(gm);
          return;
        }

        setGuidedMenu(gm);
        if (gm) {
          setLines([
            {
              role: "assistant",
              content: `${gm.greeting}\n\nElegí una opción con los botones de abajo.`,
            },
          ]);
        } else {
          setLines([
            {
              role: "assistant",
              content: "Hola, ¿qué necesitás? No hay menú guiado para tu cuenta; podés escribir tu consulta.",
            },
          ]);
        }
        setBootReady(true);
      })
      .catch(() => {
        setDigest(null);
        setDigestError("Error de red al cargar el resumen.");
        if (mode === "bootstrap") {
          setGuidedMenu(null);
          setLines([{ role: "assistant", content: "Hola, ¿qué necesitás? Error de red al cargar el menú." }]);
          setBootReady(true);
        }
      })
      .finally(() => setDigestLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    setLines([]);
    setGuidedMenu(null);
    setBootReady(false);
    setError("");
    loadDigest("bootstrap");
  }, [open, loadDigest]);

  const postChat = useCallback(async (historyLines: ChatLine[]) => {
    const history = historyLines
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ messages: history }),
    });
    const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      return { ok: false as const, error: typeof data?.error === "string" ? data.error : "No se pudo obtener respuesta." };
    }
    const reply = typeof data?.reply === "string" ? data.reply : "";
    if (!reply) {
      return { ok: false as const, error: "Respuesta vacía." };
    }
    const gm =
      "guidedMenu" in data && isGuidedMenuPayload(data.guidedMenu) ? data.guidedMenu : undefined;
    return { ok: true as const, reply, guidedMenu: gm };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    const nextUser: ChatLine = { role: "user", content: text };
    setLines((prev) => [...prev, nextUser]);
    setLoading(true);

    const history: ChatLine[] = [...lines, nextUser].filter((m) => m.role === "user" || m.role === "assistant");

    try {
      const result = await postChat(history);
      if (!result.ok) {
        setError(result.error);
        setLines((prev) => prev.slice(0, -1));
        return;
      }
      if (result.guidedMenu != null) setGuidedMenu(result.guidedMenu);
      setLines((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch {
      setError("Error de red.");
      setLines((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const pickMenuOption = async (opt: GuidedMenuOption) => {
    if (loading) return;
    setError("");
    const nextUser: ChatLine = { role: "user", content: opt.value, displayLabel: opt.label };
    setLines((prev) => [...prev, nextUser]);
    setLoading(true);

    const history: ChatLine[] = [...lines, nextUser].filter((m) => m.role === "user" || m.role === "assistant");

    try {
      const result = await postChat(history);
      if (!result.ok) {
        setError(result.error);
        setLines((prev) => prev.slice(0, -1));
        return;
      }
      if (result.guidedMenu != null) setGuidedMenu(result.guidedMenu);
      setLines((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch {
      setError("Error de red.");
      setLines((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="pointer-events-none fixed z-[130] flex flex-col items-end gap-3"
      style={{
        right: "max(1rem, env(safe-area-inset-right, 0px))",
        bottom: "max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))",
      }}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto flex max-h-[min(78dvh,560px)] w-[min(100vw-1.5rem,420px)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-foreground shadow-[0_20px_50px_-12px_rgb(0_0_0/0.35)] ring-1 ring-[var(--ring-soft)] dark:shadow-[0_24px_60px_-12px_rgb(0_0_0/0.55)]"
          >
            <header className="shrink-0 border-b border-border bg-card-muted/80 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-brand">Asistente SmartGuest</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted">
                    {engineLabel != null ? (
                      <>
                        <span className="font-medium text-foreground">{engineBadgeText(engineLabel)}</span>
                        {" · "}
                      </>
                    ) : null}
                    {engineSubtitle(engineLabel)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    setLines([]);
                    setGuidedMenu(null);
                    setBootReady(false);
                  }}
                  className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-border-subtle hover:text-foreground"
                  aria-label="Cerrar chat"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </header>

            <details className="group shrink-0 border-b border-border-subtle bg-card-muted/25 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-card-muted/50">
                <span className="text-[12px] font-semibold text-foreground">Resumen del evento</span>
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      loadDigest("digestOnly");
                    }}
                    disabled={digestLoading}
                    className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-brand transition-colors hover:bg-card-muted disabled:opacity-50"
                  >
                    {digestLoading ? "…" : "Actualizar"}
                  </button>
                  <svg
                    className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <div className="border-t border-border-subtle px-4 pb-3 pt-0">
                {digestError && (
                  <p className="pt-2 text-[12px] text-red-800 dark:text-red-200">{digestError}</p>
                )}
                {digestLoading && !digest && !digestError && (
                  <p className="pt-2 text-[12px] text-muted">Leyendo datos…</p>
                )}
                {digest && (
                  <div className="mt-2 max-h-[min(22dvh,168px)] overflow-y-auto overscroll-contain rounded-xl border border-border-subtle bg-card px-3 py-2.5 text-[12px] leading-relaxed text-foreground sm:text-[13px]">
                    <p className="whitespace-pre-wrap break-words font-mono">{digest}</p>
                  </div>
                )}
              </div>
            </details>

            <div
              ref={listRef}
              className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
            >
              {!bootReady && digestLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-border-subtle bg-card-muted/90 px-4 py-2.5 text-[13px] text-muted">
                    Cargando menú…
                  </div>
                </div>
              )}
              {lines.map((m, i) => (
                <div
                  key={`${i}-${m.role}`}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={
                      "max-w-[min(100%,22rem)] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed sm:text-[14px] " +
                      (m.role === "user"
                        ? "bg-brand text-white shadow-sm"
                        : "border border-border-subtle bg-card-muted/90 text-foreground shadow-sm")
                    }
                  >
                    {(m.displayLabel ?? m.content).split("\n").map((line, j) => (
                      <span key={j}>
                        {j > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-border-subtle bg-card-muted/90 px-4 py-2.5 text-[13px] text-muted">
                    Pensando…
                  </div>
                </div>
              )}
            </div>

            {guidedMenu && guidedMenu.options.length > 0 && bootReady && (
              <div className="shrink-0 border-t border-border-subtle bg-card-muted/40 px-3 pb-2 pt-2 sm:px-4">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">Opciones</p>
                <div
                  key={guidedMenu.options.map((o) => o.value).join("|")}
                  className="flex max-h-[min(40dvh,280px)] flex-col gap-2 overflow-y-auto overscroll-contain pr-0.5"
                >
                  {guidedMenu.options.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={loading}
                      onClick={() => void pickMenuOption(opt)}
                      className="w-full shrink-0 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-[13px] font-medium leading-snug text-foreground shadow-sm transition-colors hover:bg-brand/10 hover:border-brand/40 disabled:opacity-45"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {guidedMenu.note ? (
                  <p className="mt-2 text-[11px] leading-snug text-muted">{guidedMenu.note}</p>
                ) : null}
              </div>
            )}

            {error && (
              <p className="shrink-0 border-t border-border bg-red-50 px-3 py-2 text-center text-[12px] text-red-800 dark:bg-red-950/40 dark:text-red-200">
                {error}
              </p>
            )}

            <div className="shrink-0 border-t border-border bg-card-muted/60 p-2 sm:p-3">
              <div className="flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  placeholder="O escribí tu consulta…"
                  disabled={loading}
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-border bg-input px-3 py-2 text-[13px] text-foreground placeholder:text-muted outline-none ring-brand/25 focus:ring-2 disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={loading || !input.trim()}
                  className="shrink-0 self-end rounded-xl bg-brand px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-[filter] hover:brightness-95 disabled:opacity-40"
                >
                  Enviar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        layout
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setOpen((o) => {
            if (o) {
              setLines([]);
              setGuidedMenu(null);
              setBootReady(false);
            }
            setError("");
            return !o;
          });
        }}
        whileTap={{ scale: 0.94 }}
        className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg ring-2 ring-white/25 transition-[filter,box-shadow] hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:ring-black/30"
        aria-expanded={open}
        aria-label={open ? "Cerrar asistente" : "Abrir asistente"}
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8.5z" />
          </svg>
        )}
      </motion.button>
    </div>
  );
}
