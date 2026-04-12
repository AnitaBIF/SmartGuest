"use client";

import { use, useState } from "react";
import Image from "next/image";

/* ─── Tipos ─── */
type Evento = {
  titulo: string;
  fecha: string;
  hora: string;
  lugar: string;
  dressCode: string;
};

type InvitadoData = {
  nombre: string;
  apellido: string;
  guestId: string; // código que se graba en el QR
  evento: Evento;
};

/* ─── Base de invitados por token (simulada) ─── */
const INVITADOS: Record<string, InvitadoData> = {
  "abc123": {
    nombre: "Carlos", apellido: "Pérez",
    guestId: "SMARTGUEST_001",
    evento: { titulo: "Casamiento Díaz-Morales", fecha: "Sábado 14 de Junio, 2026", hora: "20:00 hs", lugar: "Salón Los Álamos, Av. del Libertador 1250", dressCode: "Formal" },
  },
  "def456": {
    nombre: "Valentina", apellido: "Torres",
    guestId: "SMARTGUEST_003",
    evento: { titulo: "Cumpleaños de 15 – Camila García", fecha: "Domingo 15 de Junio, 2026", hora: "20:00 hs", lugar: "Salón Villa Verde, Corrientes 870", dressCode: "Cocktail" },
  },
  "ghi789": {
    nombre: "Ana", apellido: "García",
    guestId: "SMARTGUEST_004",
    evento: { titulo: "Casamiento Pérez-Rodríguez", fecha: "Domingo 1 de Junio, 2026", hora: "19:00 hs", lugar: "Quinta La Rosaleda, Ruta 8 km 42", dressCode: "Formal" },
  },
};

const FALLBACK: InvitadoData = {
  nombre: "Invitado", apellido: "",
  guestId: "SMARTGUEST_DEMO",
  evento: { titulo: "Evento Demo", fecha: "Próximamente", hora: "20:00 hs", lugar: "Por confirmar", dressCode: "Formal" },
};

/* ─── Opciones ─── */
const MENUS = ["Menú standard", "Menú celíaco", "Menú vegetariano/vegano", "Otro"] as const;
type MenuOpt = typeof MENUS[number];

const ECOGUEST = [
  { key: "conductor",  label: "Sí, como conductor 🚗" },
  { key: "pasajero",   label: "Sí, como pasajero 🪑" },
  { key: "no",         label: "No, gracias" },
] as const;
type EcoOpt = typeof ECOGUEST[number]["key"];

type Paso = "invitacion" | "formulario" | "qr" | "rechazo";

/* ─── Logo ─── */
function Logo({ white }: { white?: boolean }) {
  const c = white ? "white" : "#2d5a41";
  return (
    <span className="text-xl font-extrabold tracking-tight" style={{ color: c }}>
      SMART<span className="font-normal" style={{ fontFamily: "var(--font-poppins)", color: c }}>GUEST</span>
    </span>
  );
}

/* ─── Ítem de detalle ─── */
function Detail({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xl">{icon}</span>
      <span className="text-[15px] text-[#374151]">{text}</span>
    </div>
  );
}

/* ─── Página ─── */
export default function InvitadoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const data = INVITADOS[token] ?? FALLBACK;

  const [paso,        setPaso]       = useState<Paso>("invitacion");
  const [menu,        setMenu]       = useState<MenuOpt | "">("");
  const [menuOtro,    setMenuOtro]   = useState("");
  const [eco,         setEco]        = useState<EcoOpt | "">("");

  const handleConfirmar = () => { setMenu(""); setEco(""); setPaso("formulario"); };
  const handleEnviar = () => { if (!menu || !eco) return; setPaso("qr"); };

  /* ── Pantalla 1: Invitación ── */
  if (paso === "invitacion") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        {/* Header verde */}
        <div className="rounded-b-[40px] px-6 pb-10 pt-8" style={{ background: "linear-gradient(160deg,#2d5a41 0%,#3d7a58 100%)" }}>
          <div className="mb-6 flex justify-center"><Logo white /></div>
          <p className="mb-1 text-center text-[13px] font-medium text-white/70">¡Hola, {data.nombre}!</p>
          <h1 className="text-center text-2xl font-extrabold leading-tight text-white">
            Estás invitado/a a
          </h1>
        </div>

        {/* Card evento */}
        <div className="mx-4 -mt-6 rounded-3xl bg-white p-6 shadow-xl ring-1 ring-black/5">
          <h2 className="mb-5 text-[17px] font-bold text-[#1a3d28]">{data.evento.titulo}</h2>
          <div className="space-y-3">
            <Detail icon="📅" text={data.evento.fecha} />
            <Detail icon="🕐" text={data.evento.hora} />
            <Detail icon="📍" text={data.evento.lugar} />
            <Detail icon="👔" text={`Dress code: ${data.evento.dressCode}`} />
          </div>
        </div>

        {/* Botones RSVP */}
        <div className="mx-4 mt-6 space-y-3">
          <button
            type="button"
            onClick={handleConfirmar}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-colors"
            style={{ backgroundColor: "#2d5a41" }}
          >
            <span className="text-xl">✓</span> Confirmar asistencia
          </button>
          <button
            type="button"
            onClick={() => setPaso("rechazo")}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#d1d5db] py-4 text-base font-semibold text-[#6b7280] transition-colors hover:bg-[#f3f4f6]"
          >
            No podré asistir
          </button>
        </div>

        <p className="mt-6 pb-8 text-center text-[11px] text-[#9ca3af]">
          Powered by SmartGuest
        </p>
      </div>
    );
  }

  /* ── Pantalla 2: Formulario ── */
  if (paso === "formulario") {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        <header className="flex items-center justify-between px-5 pt-6 pb-4">
          <button type="button" onClick={() => setPaso("invitacion")}
            className="text-[13px] font-medium text-[#6b7280]">← Volver</button>
          <Logo />
        </header>

        <div className="flex-1 overflow-y-auto px-5 pb-10">
          <h2 className="mb-1 text-2xl font-extrabold text-[#1a3d28]">¡Genial!</h2>
          <p className="mb-7 text-[14px] text-[#6b7280]">Solo completá estos datos para terminar.</p>

          {/* Menú */}
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[#2d5a41]">¿Qué menú preferís?</p>
          <div className="mb-2 space-y-2">
            {MENUS.map((m) => (
              <button key={m} type="button" onClick={() => setMenu(m)}
                className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[14px] font-medium transition-colors"
                style={{
                  borderColor: menu === m ? "#2d5a41" : "#e5e7eb",
                  backgroundColor: menu === m ? "#f0f7f2" : "white",
                  color: menu === m ? "#1a3d28" : "#374151",
                }}>
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                  style={{ borderColor: menu === m ? "#2d5a41" : "#d1d5db", backgroundColor: menu === m ? "#2d5a41" : "white" }}>
                  {menu === m && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                {m}
              </button>
            ))}
          </div>
          {menu === "Otro" && (
            <input
              type="text"
              placeholder="Especificá tu restricción alimentaria"
              value={menuOtro}
              onChange={(e) => setMenuOtro(e.target.value)}
              className="mb-6 mt-1 w-full rounded-2xl border border-[#d1d5db] px-4 py-3 text-[14px] outline-none focus:border-[#2d5a41] focus:ring-1 focus:ring-[#2d5a41]"
            />
          )}

          {/* EcoGuest */}
          <p className="mb-3 mt-7 text-[13px] font-semibold uppercase tracking-wide text-[#2d5a41]">
            ¿Querés sumarte al programa EcoGuest?
          </p>
          <p className="mb-3 text-[12px] text-[#9ca3af]">Compartí el auto y reducí la huella de carbono del evento.</p>
          <div className="space-y-2">
            {ECOGUEST.map(({ key, label }) => (
              <button key={key} type="button" onClick={() => setEco(key)}
                className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[14px] font-medium transition-colors"
                style={{
                  borderColor: eco === key ? "#2d5a41" : "#e5e7eb",
                  backgroundColor: eco === key ? "#f0f7f2" : "white",
                  color: eco === key ? "#1a3d28" : "#374151",
                }}>
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                  style={{ borderColor: eco === key ? "#2d5a41" : "#d1d5db", backgroundColor: eco === key ? "#2d5a41" : "white" }}>
                  {eco === key && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                {label}
              </button>
            ))}
          </div>

          {/* Botón enviar */}
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!menu || !eco}
            className="mt-8 w-full rounded-2xl py-4 text-base font-bold text-white shadow transition-colors disabled:opacity-40"
            style={{ backgroundColor: "#2d5a41" }}
          >
            Confirmar asistencia
          </button>
        </div>
      </div>
    );
  }

  /* ── Pantalla 3: QR ── */
  if (paso === "qr") {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(data.guestId)}&bgcolor=ffffff&color=1a3d28&margin=10`;
    return (
      <div className="flex min-h-[100dvh] flex-col bg-white">
        {/* Header */}
        <div className="rounded-b-[40px] px-6 pb-10 pt-8" style={{ background: "linear-gradient(160deg,#2d5a41 0%,#3d7a58 100%)" }}>
          <div className="mb-4 flex justify-center"><Logo white /></div>
          <h1 className="text-center text-2xl font-extrabold text-white">¡Todo listo!</h1>
          <p className="mt-1 text-center text-[13px] text-white/70">Nos vemos el {data.evento.fecha.split(",")[0]}</p>
        </div>

        <div className="flex flex-1 flex-col items-center px-6 pb-10">
          {/* QR */}
          <div className="-mt-8 mb-6 overflow-hidden rounded-3xl bg-white p-4 shadow-xl ring-1 ring-black/5">
            <Image
              src={qrUrl}
              alt="Tu código QR"
              width={220}
              height={220}
              unoptimized
              className="block"
            />
          </div>

          <p className="mb-6 text-center text-[13px] font-semibold text-[#6b7280]">
            Mostrá este código en la entrada del evento
          </p>

          {/* Resumen */}
          <div className="w-full rounded-3xl bg-[#f0f7f2] p-5 space-y-3">
            <p className="text-[13px] font-bold text-[#1a3d28]">{data.evento.titulo}</p>
            <Detail icon="📅" text={data.evento.fecha} />
            <Detail icon="🕐" text={data.evento.hora} />
            <Detail icon="📍" text={data.evento.lugar} />
            <Detail icon="👔" text={`Dress code: ${data.evento.dressCode}`} />
            <div className="border-t border-[#d1e8db] pt-3">
              <Detail icon="🍽️" text={menu === "Otro" ? menuOtro || "Otro" : menu} />
              {eco !== "no" && (
                <Detail icon="🌱" text={`EcoGuest: ${eco === "conductor" ? "Conductor" : "Pasajero"}`} />
              )}
            </div>
          </div>

          {/* Compartir (Web Share API) */}
          {typeof navigator !== "undefined" && "share" in navigator && (
            <button
              type="button"
              onClick={() => navigator.share?.({ title: "Mi invitación SmartGuest", text: `Mi QR para ${data.evento.titulo}`, url: window.location.href })}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#2d5a41] py-3.5 text-[14px] font-semibold text-[#2d5a41]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              Compartir invitación
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ── Pantalla: Rechazo ── */
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-8 text-center">
      <div className="mb-6 flex justify-center"><Logo /></div>
      <p className="mb-4 text-5xl">😔</p>
      <h2 className="mb-2 text-2xl font-extrabold text-[#1a3d28]">¡Qué lástima!</h2>
      <p className="mb-8 text-[15px] text-[#6b7280]">
        Lamentamos que no puedas asistir. <br />Hemos notificado al anfitrión.
      </p>
      <button type="button" onClick={() => setPaso("invitacion")}
        className="rounded-2xl border border-[#d1d5db] px-8 py-3 text-[14px] font-medium text-[#374151]">
        Cambiar respuesta
      </button>
    </div>
  );
}
