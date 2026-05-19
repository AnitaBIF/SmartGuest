"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

type PageTransitionProps = {
  children: React.ReactNode;
  /** Extra classes on the animated wrapper (e.g. flex grow) */
  className?: string;
};

/**
 * Transición suave entre rutas: solo opacidad.
 *
 * No usamos `filter: blur()` acá: en CSS, un ancestro con `filter` distinto de `none`
 * convierte a los hijos `position: fixed` en “fixed al ancestro”, no al viewport — los
 * modales (overlay `fixed inset-0`) quedan descentrados o pegados abajo.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const pathname = usePathname() ?? "";
  const reduced = useReducedMotion();

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        className={className}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.42, ease: [0.33, 1, 0.68, 1] }}
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
    <PageTransition className="flex min-h-full min-w-0 flex-1 flex-col">{children}</PageTransition>
  );
}
