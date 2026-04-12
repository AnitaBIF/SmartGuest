/**
 * Anti-replay best-effort: el mismo string de QR no se acepta dos veces dentro de ~2 ventanas.
 * En un deploy serverless sin Redis cada instancia tiene su propia memoria (documentar en el trabajo).
 */

const TTL_MS = 70_000;
const store = new Map<string, number>();
const MAX_ENTRIES = 10_000;

function prune(now: number) {
  if (store.size < MAX_ENTRIES) return;
  for (const [k, exp] of store) {
    if (exp < now) store.delete(k);
  }
  if (store.size > MAX_ENTRIES) {
    const keys = [...store.keys()].slice(0, store.size - MAX_ENTRIES);
    keys.forEach((k) => store.delete(k));
  }
}

export function isQrReplay(token: string): boolean {
  const now = Date.now();
  prune(now);
  const key = token.trim();
  const exp = store.get(key);
  if (exp != null && exp > now) return true;
  store.set(key, now + TTL_MS);
  return false;
}
