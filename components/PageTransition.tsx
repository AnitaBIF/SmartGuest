"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

const ease = [0.22, 1, 0.36, 1] as const;

type PageTransitionProps = {
  children: React.ReactNode;
  /** Extra classes on the animated wrapper (e.g. flex grow) */
  className?: string;
};

/**
 * Cross-fade + ligero desplazamiento vertical al cambiar de ruta (misma zona de layout).
 * Usar `initial={false}` en presencia para no animar el primer paint.
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
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.26, ease }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Layout raíz: anima transiciones entre páginas “sueltas”.
 * `/admin` y `/anfitrion` lo omiten porque llevan su propia transición en el panel principal.
 */
export function RootPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  if (pathname.startsWith("/admin") || pathname.startsWith("/anfitrion")) {
    return <>{children}</>;
  }
  return (
    <PageTransition className="flex min-h-full flex-1 flex-col">{children}</PageTransition>
  );
}
