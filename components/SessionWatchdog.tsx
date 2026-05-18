"use client";

import { useEffect } from "react";
import { requestServerLogout, signOutLocalCapped, supabase } from "@/lib/supabase";

/**
 * Vigila la sesión del usuario y la cierra automáticamente en dos casos:
 *
 *  A. **Cierre real de la aplicación** (la última pestaña murió y el usuario
 *     volvió >30 s después). Estrategia "heartbeat" en localStorage:
 *
 *       1. Cada pestaña con sesión escribe `LAST_ALIVE_KEY = Date.now()`
 *          cada `HEARTBEAT_MS` (15 s). Mientras al menos una pestaña esté
 *          abierta, el valor se mantiene fresco.
 *       2. Al montarse en cualquier página autenticada, compara el último
 *          heartbeat con `Date.now()`. Si pasaron más de `STALE_MS` (30 s)
 *          desde el último latido y hay cookie de sesión Supabase, asumimos
 *          que el usuario cerró todas las pestañas y volvió más tarde →
 *          logout silencioso.
 *       3. F5 / navegar entre rutas internas no rompe nada: el gap entre que
 *          la pestaña vieja emite su último heartbeat y la nueva monta este
 *          watchdog es de ~100–500 ms, muy por debajo del umbral.
 *
 *  B. **Inactividad prolongada** (la pestaña sigue abierta pero el usuario se
 *     fue de la compu). Estrategia listeners + temporizador:
 *
 *       1. Cualquier evento de interacción real (mousedown, keydown, scroll,
 *          touchstart, visibilitychange→visible) reinicia un timeout de
 *          `INACTIVITY_MS` (60 min).
 *       2. Si pasan 60 min sin ningún evento, ejecutamos el mismo logout
 *          silencioso que en el caso A.
 *
 * Importante: este componente NO interfiere con la página pública de login
 * ni con la invitación pública del invitado, porque solo arranca cuando
 * Supabase reporta sesión activa.
 */

const LAST_ALIVE_KEY = "smartguest:session:last-alive:v1";
const HEARTBEAT_MS = 15_000;
const STALE_MS = 30_000;
const INACTIVITY_MS = 60 * 60 * 1000; // 60 minutos sin interacción → logout

function readLastAlive(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(LAST_ALIVE_KEY);
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastAlive(ts: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAST_ALIVE_KEY, String(ts));
  } catch {
    /* almacenamiento bloqueado: ignoramos */
  }
}

function clearLastAlive() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LAST_ALIVE_KEY);
  } catch {
    /* ignore */
  }
}

export default function SessionWatchdog() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let intervalId: ReturnType<typeof setInterval> | null = null;
    let inactivityTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    let vigilando = false;

    const startHeartbeat = () => {
      if (intervalId !== null) return;
      writeLastAlive(Date.now());
      intervalId = setInterval(() => {
        writeLastAlive(Date.now());
      }, HEARTBEAT_MS);
    };

    const stopHeartbeat = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const resetInactivityTimer = () => {
      if (!vigilando) return;
      if (inactivityTimeoutId !== null) clearTimeout(inactivityTimeoutId);
      inactivityTimeoutId = setTimeout(() => {
        void ejecutarLogoutAutomatico("inactividad");
      }, INACTIVITY_MS);
    };

    const stopInactivityTimer = () => {
      if (inactivityTimeoutId !== null) {
        clearTimeout(inactivityTimeoutId);
        inactivityTimeoutId = null;
      }
    };

    // Eventos que cuentan como "el usuario está usando la app". `mousemove`
    // a propósito NO está en la lista: queremos que si la persona dejó la
    // pestaña abierta y se fue (mouse quieto, sin teclado), la sesión expire
    // igual.
    const ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart"] as const;

    const onActivity = () => resetInactivityTimer();
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Si la pestaña vuelve a primer plano después de mucho rato, la
        // contamos como actividad reciente (el usuario volvió a la app).
        resetInactivityTimer();
      }
    };

    const attachActivityListeners = () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.addEventListener(ev, onActivity, { passive: true });
      }
      document.addEventListener("visibilitychange", onVisibility);
    };

    const detachActivityListeners = () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };

    const ejecutarLogoutAutomatico = async (_motivo: "stale" | "inactividad") => {
      vigilando = false;
      stopHeartbeat();
      stopInactivityTimer();
      detachActivityListeners();
      clearLastAlive();
      await Promise.all([requestServerLogout(), signOutLocalCapped()]);
      if (!cancelled) {
        window.location.replace("/");
      }
    };

    const empezarVigilancia = () => {
      if (vigilando) return;
      vigilando = true;
      startHeartbeat();
      attachActivityListeners();
      resetInactivityTimer();
    };

    const detenerVigilancia = () => {
      vigilando = false;
      stopHeartbeat();
      stopInactivityTimer();
      detachActivityListeners();
      clearLastAlive();
    };

    const inicializar = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        clearLastAlive();
        return;
      }

      const last = readLastAlive();
      const now = Date.now();
      if (last > 0 && now - last > STALE_MS) {
        await ejecutarLogoutAutomatico("stale");
        return;
      }

      empezarVigilancia();
    };

    void inicializar();

    const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT" || !session) {
        detenerVigilancia();
        return;
      }
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        empezarVigilancia();
      }
    });

    return () => {
      cancelled = true;
      detenerVigilancia();
      authSub.subscription.unsubscribe();
    };
  }, []);

  return null;
}
