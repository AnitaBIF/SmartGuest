"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook compartido para el toggle de las sidebars (admin / anfitrión / invitado).
 * Persiste el estado en `localStorage` con la clave que se le pase y devuelve un setter
 * que actualiza ambos.
 */
export function useSidebarCollapsed(storageKey: string): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(storageKey) === "1");
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const setCollapsedPersist = useCallback(
    (v: boolean) => {
      setCollapsed(v);
      try {
        localStorage.setItem(storageKey, v ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  return [collapsed, setCollapsedPersist];
}
