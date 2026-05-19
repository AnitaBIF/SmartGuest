"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const NEON = "#00FF88";
const BG_TOP = "#050A1A";
const BG_BOT = "#101525";

const glass =
  "rounded-2xl border border-white/[0.14] bg-white/[0.06] shadow-[0_8px_40px_-12px_rgba(0,0,0,0.65)] backdrop-blur-[14px]";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.11, delayChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 380, damping: 28 },
  },
};

const panelHover = {
  y: -5,
  boxShadow: `0 0 0 1px ${NEON}, 0 20px 50px -16px rgba(0,255,136,0.25)`,
  transition: { type: "spring" as const, stiffness: 400, damping: 22 },
};

function NeonButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const reduce = useReducedMotion();
  if (variant === "ghost") {
    return (
      <Link
        href={href}
        className={`inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/[0.04] px-7 py-3.5 text-[15px] font-semibold text-white/90 backdrop-blur-md transition-colors hover:bg-white/[0.08] ${reduce ? "" : "hover:border-white/35"}`}
      >
        {children}
      </Link>
    );
  }
  return (
    <motion.div whileHover={{ scale: reduce ? 1 : 1.02 }} whileTap={{ scale: 0.98 }} className="inline-block">
      <Link
        href={href}
        className="relative inline-flex items-center justify-center overflow-hidden rounded-xl px-8 py-4 text-[15px] font-bold text-[#050A1A] shadow-[0_0_28px_rgba(0,255,136,0.45)] transition-shadow hover:shadow-[0_0_40px_rgba(0,255,136,0.6)]"
        style={{ background: `linear-gradient(135deg, ${NEON} 0%, #33ffa3 100%)` }}
      >
        {!reduce && (
          <span
            className="pointer-events-none absolute inset-0 opacity-40 mix-blend-soft-light"
            style={{
              background: "radial-gradient(circle at 30% 0%, #fff 0%, transparent 55%)",
            }}
          />
        )}
        <span className="relative">{children}</span>
      </Link>
    </motion.div>
  );
}

/** Avatares que se animan hacia asientos en la mesa circular */
function RoundTableShowcase({ reduced }: { reduced: boolean }) {
  const seatCount = 8;
  const seats = useMemo(
    () =>
      Array.from({ length: seatCount }, (_, i) => {
        const angle = (i / seatCount) * Math.PI * 2 - Math.PI / 2;
        return { angle, label: String.fromCharCode(65 + i) };
      }),
    [seatCount]
  );

  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setPhase((p) => (p + 1) % 3), 4800);
    return () => clearInterval(id);
  }, [reduced]);

  const tableR = 72;
  const orbitR = 132;
  const chairR = 148;

  return (
    <div className="relative mx-auto flex aspect-square w-[min(100%,420px)] max-w-[420px] items-center justify-center">
      {/* Glow detrás de la mesa */}
      <div
        className="absolute inset-[12%] rounded-full opacity-50 blur-3xl"
        style={{ background: `radial-gradient(circle, ${NEON}33 0%, transparent 70%)` }}
      />

      {/* Mesa */}
      <motion.div
        className="relative z-[1] flex items-center justify-center rounded-full border-2 border-white/10 bg-gradient-to-br from-white/[0.12] to-white/[0.02] shadow-[inset_0_0_60px_rgba(0,255,136,0.06)]"
        style={{ width: tableR * 2, height: tableR * 2 }}
        animate={reduced ? undefined : { boxShadow: [`0 0 0 0 ${NEON}00`, `0 0 0 1px ${NEON}44`, `0 0 0 0 ${NEON}00`] }}
        transition={reduced ? undefined : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/35">Evento</span>
      </motion.div>

      {/* Sillas vacías (arcos) */}
      {seats.map(({ angle }, i) => {
        const x = Math.cos(angle) * chairR;
        const y = Math.sin(angle) * chairR;
        const filled = !reduced && phase > 0 && i < 4 + (phase % 2) * 2;
        return (
          <div
            key={`chair-${i}`}
            className="pointer-events-none absolute left-1/2 top-1/2 z-0"
            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
          >
            <div
              className={`h-8 w-8 rounded-full border-2 transition-colors duration-500 ${
                filled ? "border-[#00FF88]/80 bg-[#00FF88]/15" : "border-white/15 bg-white/[0.04]"
              }`}
            />
          </div>
        );
      })}

      {/* Invitados orbitando → asiento */}
      {seats.slice(0, 6).map(({ angle, label }, i) => {
        const ox = Math.cos(angle) * orbitR;
        const oy = Math.sin(angle) * orbitR;
        const sx = Math.cos(angle) * chairR;
        const sy = Math.sin(angle) * chairR;
        const t = reduced ? 1 : phase === 0 ? 0 : phase === 1 ? Math.min(1, 0.35 + i * 0.12) : 1;
        const x = ox + (sx - ox) * t;
        const y = oy + (sy - oy) * t;
        return (
          <motion.div
            key={`guest-${i}`}
            className="absolute left-1/2 top-1/2 z-[2]"
            style={{ marginLeft: -18, marginTop: -18 }}
            animate={{ x, y }}
            transition={{ type: "spring", stiffness: 110, damping: 20, mass: 0.8 }}
          >
            <motion.div
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#00FF88]/50 bg-gradient-to-br from-[#0d1f15] to-[#152618] text-[11px] font-bold text-[#00FF88] shadow-[0_0_16px_rgba(0,255,136,0.35)]"
              animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
              transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
            >
              {label}
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
}

function FakeQrVisual() {
  const [tick, setTick] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => (t + 1) % 4), 1200);
    return () => clearInterval(id);
  }, [reduce]);
  return (
    <div className="mx-auto flex w-[100px] flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-black/30 p-2">
      <div className="text-[8px] font-medium text-white/40">QR vivo</div>
      <div
        className="grid grid-cols-5 gap-0.5 transition-opacity duration-300"
        style={{ opacity: 0.85 + (tick % 2) * 0.15 }}
      >
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className={`aspect-square rounded-[1px] ${(i + tick) % 3 === 0 ? "bg-[#00FF88]" : i % 4 === 0 ? "bg-white" : "bg-white/15"}`}
          />
        ))}
      </div>
    </div>
  );
}

export default function SmartGuestLanding() {
  const reduce = useReducedMotion();

  return (
    <div
      className="relative min-h-dvh overflow-x-hidden text-white"
      style={{
        background: `linear-gradient(165deg, ${BG_TOP} 0%, #0a1022 38%, ${BG_BOT} 100%)`,
      }}
    >
      {/* Textura / ruido sutil */}
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

      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-10">
        <span className="text-lg font-extrabold tracking-tight" style={{ fontFamily: "var(--font-poppins), system-ui" }}>
          SMART<span className="ml-1 font-normal text-[#00FF88]">GUEST</span>
        </span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="text-[13px] font-medium text-white/55 transition hover:text-white">
            Acceder
          </Link>
          <Link
            href="/registro/salon"
            className="rounded-lg border border-[#00FF88]/40 bg-[#00FF88]/10 px-3 py-1.5 text-[13px] font-semibold text-[#00FF88] transition hover:bg-[#00FF88]/20"
          >
            Registrar salón
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-8 pt-4 text-center sm:px-10 sm:pb-12 sm:pt-2">
        <motion.div
          initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.35em] text-[#00FF88]/90">Plataforma integral</p>
          <h1
            className="mx-auto max-w-4xl text-balance text-[1.65rem] font-bold leading-tight tracking-tight text-white sm:text-4xl md:text-[2.65rem] md:leading-[1.1]"
            style={{ fontFamily: "var(--font-poppins), system-ui" }}
          >
            SmartGuest: transformando la logística de tus eventos
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-[15px] leading-relaxed text-white/65 sm:text-lg">
            Gestión inteligente de invitados, simplificada. Para anfitriones, invitados y el equipo del salón — intuitiva,
            eficiente y sustentable.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <NeonButton href="#experiencia">Descubrí cómo funciona</NeonButton>
            <NeonButton href="/login" variant="ghost">
              Iniciar sesión
            </NeonButton>
          </div>
        </motion.div>
      </section>

      {/* Zona central + paneles */}
      <section id="experiencia" className="relative z-10 mx-auto max-w-6xl px-4 pb-20 sm:px-8">
        <motion.div
          className="relative min-h-[560px] sm:min-h-[620px]"
          variants={containerVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
        >
          {/* Mesa central */}
          <div className="relative z-[1] mx-auto flex justify-center pt-2 sm:pt-6">
            <RoundTableShowcase reduced={!!reduce} />
          </div>

          {/* Paneles flotantes — posiciones absolutas responsivas */}
          <motion.div
            variants={itemVariants}
            className={`${glass} absolute left-1/2 top-[2%] z-[3] w-[min(92vw,240px)] -translate-x-1/2 p-4 sm:left-[2%] sm:top-[18%] sm:translate-x-0 xl:left-[4%]`}
            whileHover={reduce ? undefined : panelHover}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">Invitados</p>
            <p className="mt-1 text-[13px] font-semibold text-white/90">Gestión + RSVP</p>
            <div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-black/20 p-2.5 text-[11px] text-white/70">
              <div className="flex justify-between">
                <span>DNI</span>
                <span className="font-mono text-[#00FF88]">OK</span>
              </div>
              <div className="flex justify-between">
                <span>Asistencia</span>
                <span className="text-emerald-300">Confirmado</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className={`${glass} absolute right-1/2 top-[14%] z-[3] w-[min(92vw,220px)] translate-x-1/2 p-4 sm:right-[2%] sm:top-[12%] sm:translate-x-0 xl:right-[4%]`}
            whileHover={reduce ? undefined : panelHover}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">Menú</p>
            <p className="mt-1 text-[13px] font-semibold text-white/90">Restricciones</p>
            <div className="mt-3 flex gap-2">
              {["🥗", "🌾", "🥜"].map((e, i) => (
                <span key={i} className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-black/25 text-lg">
                  {e}
                </span>
              ))}
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className={`${glass} absolute bottom-[28%] left-1/2 z-[3] w-[min(92vw,260px)] -translate-x-1/2 p-4 sm:bottom-[12%] sm:left-[6%] sm:translate-x-0 xl:left-[8%]`}
            whileHover={reduce ? undefined : panelHover}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">SmartPool</p>
            <p className="mt-1 text-[13px] font-semibold text-white/90">Viajes compartidos</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex -space-x-2">
                {["C", "P", "P"].map((x, i) => (
                  <div
                    key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#0a1528] bg-gradient-to-br from-[#00FF88]/40 to-[#00FF88]/10 text-[10px] font-bold text-white"
                  >
                    {x}
                  </div>
                ))}
              </div>
              <span className="text-[10px] text-white/45">conductor / pasajeros</span>
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[10px] text-white/50">
                <span>Eco-impacto</span>
                <span className="text-[#00FF88]">+78%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${NEON}, #66ffc4)` }}
                  initial={{ width: "12%" }}
                  animate={reduce ? undefined : { width: ["12%", "78%", "55%", "78%"] }}
                  transition={reduce ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
            </div>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className={`${glass} absolute bottom-[22%] right-1/2 z-[3] w-[min(92vw,200px)] translate-x-1/2 p-4 sm:bottom-[18%] sm:right-[5%] sm:translate-x-0 xl:right-[7%]`}
            whileHover={reduce ? undefined : panelHover}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">Ingreso</p>
            <p className="mt-1 text-[13px] font-semibold text-white/90">QR dinámico</p>
            <FakeQrVisual />
          </motion.div>

          <motion.div
            variants={itemVariants}
            className={`${glass} absolute bottom-[2%] left-1/2 z-[3] w-[min(94vw,320px)] -translate-x-1/2 p-4 sm:bottom-[4%]`}
            whileHover={reduce ? undefined : panelHover}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#00FF88]">Jefe de cocina</p>
            <p className="mt-1 text-[13px] font-semibold text-white/90">Vista de conteos</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                { label: "Vegano", n: 24, c: "text-emerald-300" },
                { label: "Sin TACC", n: 11, c: "text-amber-200" },
                { label: "Standard", n: 86, c: "text-white/80" },
                { label: "En prep.", n: 7, c: "text-sky-300" },
              ].map((row) => (
                <div key={row.label} className="rounded-lg border border-white/10 bg-black/25 px-2.5 py-2">
                  <p className="text-[10px] text-white/45">{row.label}</p>
                  <p className={`text-lg font-bold ${row.c}`}>{row.n}</p>
                  <div className="mt-1 h-0.5 rounded-full bg-white/10">
                    <div className="h-full w-2/3 rounded-full bg-[#00FF88]/60" />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-[12px] text-white/40">
        <p>SmartGuest · Presentación académica · Logística de eventos</p>
        <div className="mt-2 flex flex-wrap justify-center gap-4">
          <Link href="/login" className="text-[#00FF88]/80 hover:underline">
            Iniciar sesión
          </Link>
          <Link href="/registro/salon" className="hover:underline">
            Registrar salón
          </Link>
        </div>
      </footer>
    </div>
  );
}
