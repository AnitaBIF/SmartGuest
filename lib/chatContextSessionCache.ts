/** En memoria por instancia del servidor; TTL corto para acelerar navegación por menú (sg:) sin datos obsoletos largos. */
const TTL_MS = 30_000;

type CachedChatRoleContext = { ok: true; system: string; contextJson: string; savedAt: number };

const store = new Map<string, CachedChatRoleContext>();

function cacheKey(userId: string, tipo: string) {
  return `${userId}::${tipo}`;
}

export function getChatContextIfFresh(userId: string, tipo: string): { ok: true; system: string; contextJson: string } | null {
  const k = cacheKey(userId, tipo);
  const v = store.get(k);
  if (!v) return null;
  if (Date.now() - v.savedAt > TTL_MS) {
    store.delete(k);
    return null;
  }
  return { ok: true, system: v.system, contextJson: v.contextJson };
}

export function setChatContextCache(userId: string, tipo: string, ctx: { ok: true; system: string; contextJson: string }): void {
  store.set(cacheKey(userId, tipo), { ...ctx, savedAt: Date.now() });
}
