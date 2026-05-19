"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

const NEON = "#00FF88";
const BG_TOP = "#050A1A";
const BG_BOT = "#101525";

/** Glass + borde más definido, look “tech” */
const glass =
  "rounded-2xl border border-white/[0.18] bg-gradient-to-br from-white/[0.1] to-white/[0.03] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] backdrop-blur-[16px]";

const glassStrong =
  "rounded-[1.35rem] border border-[#00FF88]/25 bg-gradient-to-b from-white/[0.09] to-white/[0.02] shadow-[0_0_40px_-8px_rgba(0,255,136,0.2)] backdrop-blur-[18px]";

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
  y: -5,
  boxShadow: `0 0 0 1px ${NEON}, 0 20px 48px -12px rgba(0,255,136,0.28)`,
  transition: { type: "spring" as const, stiffness: 400, damping: 24 },
};

type GallerySlot = { src: string; alt: string } | { placeholder: true };

/**
 * Capturas en `public/landing/`. Si agregás archivos nuevos, actualizá esta lista.
 * Los nombres deben coincidir exactamente con los archivos (incl. mayúsculas).
 */
const LANDING_GALLERY: { src: string; alt: string }[] = [
  { src: "/landing/Invitado1imagen.png", alt: "Vista invitado — datos del evento" },
  { src: "/landing/SmartSeat.jpeg", alt: "SmartSeat — gestión de mesas" },
  { src: "/landing/Cocina.png", alt: "Vista jefe de cocina — conteos y menús" },
  { src: "/landing/SmartPool2.png", alt: "SmartPool — viajes compartidos" },
  {
    src: `/landing/${encodeURIComponent("QR Dinamico3.png")}`,
    alt: "QR dinámico de ingreso",
  },
];

const PLACEHOLDER_SLOTS: GallerySlot[] = [{ placeholder: true }, { placeholder: true }, { placeholder: true }];

function IconUsers({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 11a3 3 0 100-6 3 3 0 000 6zM8 13a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M4 20v-1a4 4 0 014-4h2M20 20v-1a3 3 0 00-3-3h-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconHub({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 5v2M12 17v2M5 12h2M17 12h2M7.05 7.05l1.42 1.42M15.54 15.54l1.4 1.4M7.05 16.95l1.42-1.42M15.54 8.46l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconOrbit({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l1.8 5.5h5.8l-4.7 3.4 1.8 5.5L12 15.5 7.3 16.4l1.8-5.5L4.4 7.5h5.8L12 2z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
        className="text-[#00FF88]"
      />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" className="text-white/90" />
    </svg>
  );
}

const BENTO_ITEMS = [
  {
    title: "Invitaciones bajo control",
    subtitle:
      "Automatizá confirmaciones, controlá cupos máximos y gestioná el sistema de confirmación de asistencia en tiempo real desde un solo lugar.",
    accent: "01",
    Icon: IconUsers,
  },
  {
    title: "Experiencia 360°",
    subtitle:
      "Conectá en tiempo real las decisiones de tus invitados con el panel del anfitrión y las tarjetas de la cocina.",
    accent: "02",
    Icon: IconHub,
  },
  {
    title: "Acceso inteligente",
    subtitle:
      "Controlá el ingreso con QR dinámico anticopia y gestioná traslados eficientes con lógica SmartPool.",
    accent: "03",
    Icon: IconOrbit,
  },
];

/** Fila estática de capturas: sin marco de teléfono, una al lado de la otra; leve arco 3D (se desactiva con “reducir movimiento”). */
function LandingGalleryStrip({
  items,
  reduced,
}: {
  items: GallerySlot[];
  reduced: boolean;
}) {
  const n = items.length;
  if (n === 0) return null;

  const mid = (n - 1) / 2;

  return (
    <div
      className="relative mx-auto w-full max-w-6xl px-1 sm:px-3"
      aria-label="Capturas de la aplicación SmartGuest"
    >
      <div
        className={
          "flex items-center justify-start gap-3 overflow-x-auto overflow-y-visible py-6 [scrollbar-width:thin] " +
          "[scrollbar-color:rgba(0,255,136,0.3)_transparent] sm:justify-center sm:gap-4 sm:overflow-x-visible md:gap-5 " +
          "[&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#00FF88]/35"
        }
        style={reduced ? undefined : { perspective: "1100px" }}
      >
        {items.map((item, i) => {
          const offset = i - mid;
          const abs = Math.abs(offset);
          const transform = reduced
            ? undefined
            : `rotateY(${offset * -15}deg) scale(${1 - abs * 0.06}) translateZ(${-abs * 14}px)`;

          return (
            <div
              key={i}
              className="relative shrink-0"
              style={
                reduced
                  ? { zIndex: 5 }
                  : {
                      transform,
                      transformStyle: "preserve-3d" as const,
                      zIndex: 10 - abs,
                    }
              }
            >
              <div
                className={
                  "relative w-[min(38vw,10rem)] overflow-hidden rounded-2xl border border-white/12 " +
                  "bg-[#0b1020] shadow-[0_20px_48px_-16px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.05] sm:w-40 md:w-44"
                }
              >
                {"placeholder" in item ? (
                  <div className="flex min-h-[220px] w-full flex-col items-center justify-center gap-2 px-3 py-8 text-center">
                    <span className="text-2xl opacity-35" aria-hidden>
                      📱
                    </span>
                    <p className="text-[10px] leading-relaxed text-white/45">
                      Guardá imágenes en <span className="text-[#00FF88]/90">public/landing/</span> y listalas en{" "}
                      <code className="rounded bg-white/10 px-1 text-[9px]">LANDING_GALLERY</code>
                    </p>
                  </div>
                ) : (
                  <div className="relative w-full leading-none">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      width={900}
                      height={1200}
                      sizes="(max-width:640px) 38vw, 176px"
                      className="block h-auto w-full max-w-none align-top"
                      style={{ height: "auto", width: "100%" }}
                      priority={i === 0}
                    />
                    <div
                      className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#050A1A]/25 to-transparent"
                      aria-hidden
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`block text-center text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl ${className}`}
      style={{ fontFamily: "var(--font-poppins), system-ui" }}
    >
      SMART<span className="ml-1.5 font-normal text-[#00FF88] md:ml-2">GUEST</span>
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
        background: `linear-gradient(165deg, ${BG_TOP} 0%, #080d1f 40%, ${BG_BOT} 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      {/* Grid futurista muy sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(${NEON} 1px, transparent 1px), linear-gradient(90deg, ${NEON} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />
      <div
        className="pointer-events-none absolute -left-40 top-20 h-96 w-96 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${NEON}28 0%, transparent 65%)` }}
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-40 h-80 w-80 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, #3b82f618 0%, transparent 60%)` }}
      />

      <header className="relative z-20 px-4 pb-2 pt-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl justify-center">
          <LogoMark />
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-4 sm:px-8 lg:px-12">
        <motion.div
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="text-center"
        >
          <h1
            className="mx-auto max-w-3xl text-balance text-lg font-semibold leading-snug tracking-tight text-white/90 sm:text-2xl md:max-w-2xl md:text-[1.65rem]"
            style={{ fontFamily: "var(--font-poppins), system-ui" }}
          >
            Transformando la logística de tus eventos
          </h1>
        </motion.div>

        <motion.div
          className="mx-auto mt-12 grid w-full max-w-7xl grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-5 lg:gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.15 }}
        >
          {BENTO_ITEMS.map((item) => {
            const Icon = item.Icon;
            return (
              <motion.div
                key={item.accent}
                variants={itemVariants}
                className={`${glass} group relative flex min-h-[220px] flex-col gap-4 overflow-hidden p-6 sm:min-h-[240px] sm:p-7`}
                whileHover={reduce ? undefined : bentoHover}
              >
                <div
                  className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-30 blur-2xl transition-opacity group-hover:opacity-50"
                  style={{ background: NEON }}
                />
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#00FF88]/35 bg-[#00FF88]/10 text-[#00FF88] shadow-[0_0_24px_rgba(0,255,136,0.18)]"
                    aria-hidden
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums tracking-[0.22em] text-[#00FF88]/90">
                    {item.accent}
                  </span>
                </div>
                <div className="relative flex flex-1 flex-col gap-3">
                  <p className="text-left text-[1.125rem] font-semibold leading-tight tracking-tight text-white sm:text-xl">
                    {item.title}
                  </p>
                  <p className="text-left text-[14px] leading-relaxed text-white/60 sm:text-[15px]">{item.subtitle}</p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="mx-auto mt-10 flex w-full max-w-lg flex-col gap-3 sm:max-w-2xl sm:flex-row sm:justify-center sm:gap-4"
        >
          <Link
            href="/login"
            className="rounded-xl border border-white/18 bg-white/[0.06] py-3.5 text-center text-[15px] font-semibold text-white/95 backdrop-blur-md transition hover:border-white/28 hover:bg-white/[0.1] sm:min-w-[200px] sm:px-8"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro/salon"
            className="rounded-xl border border-[#00FF88]/50 bg-[#00FF88]/12 py-3.5 text-center text-[15px] font-semibold text-[#00FF88] shadow-[0_0_24px_rgba(0,255,136,0.15)] transition hover:bg-[#00FF88]/22 sm:min-w-[200px] sm:px-8"
          >
            Registrá tu salón
          </Link>
        </motion.div>

        <motion.div
          initial={reduce ? { opacity: 1 } : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="mt-16"
        >
          <div className="mb-5 flex flex-col items-center gap-2">
            <span
              className="h-px w-12 bg-gradient-to-r from-transparent via-[#00FF88] to-transparent opacity-80"
              aria-hidden
            />
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.32em] text-[#00FF88]/80">
              La app en acción
            </p>
            <span
              className="h-px w-12 bg-gradient-to-r from-transparent via-[#00FF88] to-transparent opacity-80"
              aria-hidden
            />
          </div>
          <LandingGalleryStrip items={galleryItems} reduced={!!reduce} />
        </motion.div>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-6 text-center text-[11px] text-white/35">
        SmartGuest · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
