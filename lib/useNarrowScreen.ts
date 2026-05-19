"use client";

import { useSyncExternalStore } from "react";

/** Viewport tipo celular (break Tailwind `sm`, 640px). */

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(max-width: 639px)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getSnapshot() {
  return window.matchMedia("(max-width: 639px)").matches;
}

/** SSR/desktop-first; en el primer paint cliente se corrige si es móvil. */
function getServerSnapshot() {
  return false;
}

export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
