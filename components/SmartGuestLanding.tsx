"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const NEON = "#00FF88";
const BG_TOP = "#050A1A";
const BG_BOT = "#101525";

const glass =
  "rounded-2xl border border-white/[0.14] bg-white/[0.06] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-[14px]";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28 },
  },
};

const bentoHover = {
  y: -4,
  boxShadow: `0 0 0 1px ${NEON}, 0 16px 40px -12px rgba(0,255,136,0.2)`,
  transition: { type: "spring" as const, stiffness: 400, damping: 24 },
};

type GallerySlot = { src: string; alt: string } | { placeholder: true };

/**
 * Agregá archivos en `public/landing/` y referenciálos acá, por ejemplo:
 * `{ src: "/landing/captura-1.png", alt: "Panel invitado" }`
 */
const LANDING_GALLERY: { src: string; alt: string }[] = [];

const PLACEHOLDER_SLOTS: GallerySlot[] = [
  { placeholder: true },
  { placeholder: true },
  { placeholder: true },
];

const BENTO_ITEMS = [
  {
    title: "Gestión inteligente de invitados, simplificada.",
    accent: "01",
  },
  {
    title: "Para anfitriones, invitados y el equipo del salón.",
    accent: "02",
  },
  {
    title: "Plataforma intuitiva, eficiente y sustentable.",
    accent: "03",
  },
];

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-xl font-extrabold tracking-tight sm:text-2xl ${className}`}
      style={{ fontFamily: "var(--font-poppins), system-ui" }}
    >
      SMART<span className="ml-1 font-normal text-[#00FF88]">GUEST</span>
    </span>
  );
}

export default function SmartGuestLanding() {
  const reduce = useReducedMotion();

  const galleryItems: GallerySlot[] =
    LANDING_GALLERY.length > 0 ? LANDING_GALLERY : PLACEHOLDER_SLOTS;

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden text-white"
      style={{
        background: `linear-gradient(165deg, ${BG_TOP} 0%, #0a1022 38%, ${BG_BOT} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${NEON}22 0%, transparent 65%)` }}
      />
      <div className="pointer-events-none absolute -right-32 bottom-40 h-80 w-80 rounded-full bg-[#1a2a4a]/80 blur-3xl" />

      {/* Header: móvil = logo y debajo los 2 botones; sm+ = botón | logo | botón */}
      <header className="relative z-20 px-4 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-5 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3">
          <div className="hidden justify-self-start sm:flex">
            <Link
              href="/login"
              className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-[13px] font-semibold text-white/90 backdrop-blur-sm transition hover:border-white/25 hover:bg-white/[0.08]"
            >
              Iniciar sesión
            </Link>
          </div>
          <div className="flex justify-center sm:justify-center">
            <LogoMark />
          </div>
          <div className="hidden justify-self-end sm:flex">
            <Link
              href="/registro/salon"
              className="rounded-xl border border-[#00FF88]/45 bg-[#00FF88]/12 px-4 py-2 text-[13px] font-semibold text-[#00FF88] transition hover:bg-[#00FF88]/22"
            >
              Registrá tu salón
            </Link>
          </div>
          <div className="flex w-full max-w-sm gap-3 sm:hidden">
            <Link
              href="/login"
              className="flex-1 rounded-xl border border-white/15 bg-white/[0.05] py-2.5 text-center text-[13px] font-semibold text-white/90 backdrop-blur-sm"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/registro/salon"
              className="flex-1 rounded-xl border border-[#00FF88]/45 bg-[#00FF88]/12 py-2.5 text-center text-[13px] font-semibold text-[#00FF88]"
            >
              Registrá tu salón
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-4xl px-5 pb-16 pt-6 sm:px-10">
        <motion.div
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <h1
            className="mx-auto max-w-3xl text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-[2.35rem] md:leading-[1.15]"
            style={{ fontFamily: "var(--font-poppins), system-ui" }}
          >
            Transformando la logística de tus eventos
          </h1>
        </motion.div>

        {/* Bento: 3 bloques */}
        <motion.div
          className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-3"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
        >
          {BENTO_ITEMS.map((item, i) => (
            <motion.div
              key={item.accent}
              variants={itemVariants}
              className={`${glass} flex min-h-[140px] flex-col justify-between p-5 sm:min-h-[160px]`}
              whileHover={reduce ? undefined : bentoHover}
            >
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00FF88]/85">{item.accent}</span>
              <p className="text-left text-[15px] font-medium leading-snug text-white/90 sm:text-[14px]">{item.title}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Galería móvil horizontal */}
        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mt-14"
        >
          <p className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
            La app en acción
          </p>
          <div className="flex gap-4 overflow-x-auto overflow-y-hidden pb-4 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {galleryItems.map((item, idx) => (
              <div
                key={idx}
                className={`relative w-[200px] flex-shrink-0 sm:w-[234px] ${glass} p-2`}
              >
                <div className="relative mx-auto aspect-[9/19] w-full overflow-hidden rounded-xl bg-black/40 ring-1 ring-white/10">
                  {"placeholder" in item ? (
                    <div className="flex aspect-[9/19] w-full flex-col items-center justify-center gap-3 px-3 text-center">
                      <span className="text-2xl opacity-35" aria-hidden>
                        📱
                      </span>
                      <p className="text-[10px] leading-relaxed text-white/40">
                        Próximamente: sumá tus capturas en{" "}
                        <code className="break-all rounded bg-white/10 px-1 text-[#00FF88]/80">LANDING_GALLERY</code>
                      </p>
                    </div>
                  ) : (
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      className="object-cover object-top"
                      sizes="(max-width:640px) 200px, 234px"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-[11px] text-white/35">
        SmartGuest · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
