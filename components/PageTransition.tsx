"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

type PageTransitionProps = {
  children: React.ReactNode;
  /** Extra classes on the animated wrapper (e.g. flex grow) */
  className?: string;
  /**
   * `wait`: primero termina la salida y luego entra la nueva vista (ordenado; puede sentirse seco).
   * `sync`: crossfade solapado entre salida y entrada — más continuo en rutas públicas.
   * En paneles con datos (admin / anfitrión) conviene `wait` para no ver dos páginas superpuestas.
   */
  presenceMode?: "wait" | "sync";
};

const easeOutSoft = [0.22, 1, 0.36, 1] as const;
const easeInSnappy = [0.4, 0, 0.2, 1] as const;

/**
 * Transición entre rutas: solo opacidad (sin `transform` ni `filter` en este wrapper).
 *
 * No usamos `filter`/`transform` acá: en CSS, un ancestro con `filter` o `transform` distinto de `none`
 * convierte a los hijos `position: fixed` en “fixed al ancestro”, no al viewport — los
 * modales (overlay `fixed inset-0`) quedan descentrados o pegados abajo.
 */
export function PageTransition({
  children,
  className,
  presenceMode = "wait",
}: PageTransitionProps) {
  const pathname = usePathname() ?? "";
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  const crossfade = presenceMode === "sync";

  return (
    <AnimatePresence mode={crossfade ? "sync" : "wait"} initial={false}>
      <motion.div
        key={pathname}
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{
          opacity: 0,
          transition: {
            duration: crossfade ? 0.4 : 0.34,
            ease: easeInSnappy,
          },
        }}
        transition={{
          duration: crossfade ? 0.48 : 0.56,
          delay: crossfade ? 0 : 0.06,
          ease: easeOutSoft,
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * `/` lleva intro propia en la landing; `/admin` y `/anfitrion` animan solo el panel.
 */
export function RootPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/anfitrion")
  ) {
    return <div className="flex min-h-full min-w-0 flex-1 flex-col">{children}</div>;
  }
  return (
    <PageTransition
      className="flex min-h-full min-w-0 flex-1 flex-col"
      presenceMode="sync"
    >
      {children}
    </PageTransition>
  );
}
