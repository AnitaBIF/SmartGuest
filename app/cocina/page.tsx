"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CocinaTopBar } from "./components/CocinaTopBar";
import type { EventoCocina } from "./data";

function totalMenus(ev: EventoCocina) {
  return ev.mesas.reduce(
    (acc, m) => ({
      standard: acc.standard + m.menus.standard,
      celiaco:  acc.celiaco  + m.menus.celiaco,
      vegVeg:   acc.vegVeg   + m.menus.vegVeg,
      otros:    acc.otros    + m.menus.otros,
    }),
    { standard: 0, celiaco: 0, vegVeg: 0, otros: 0 }
  );
}

export default function CocinaHome() {
  const [eventos, setEventos] = useState<EventoCocina[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cocina")
      .then((r) => r.json())
      .then((data) => {
        setEventos(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <CocinaTopBar />
        <main className="pb-8">
          <h1 className="mb-8 text-right text-2xl font-bold text-brand">Reporte de Cocina</h1>

          {loading && <p className="text-center text-muted">Cargando eventos...</p>}

          {!loading && eventos.length === 0 && (
            <p className="text-center text-muted">No hay eventos con mesas creadas.</p>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eventos.map((ev) => {
              const tot = totalMenus(ev);
              return (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-sm ring-1 ring-[var(--ring-soft)]"
                >
                  <div>
                    <h3 className="mb-0.5 text-[15px] font-bold text-brand">Evento del día {ev.fecha}</h3>
                    <p className="mb-4 text-[11px] text-muted">{ev.titulo}</p>

                    <ul className="space-y-1 text-[13px] text-muted">
                      <li className="flex justify-between"><span>Menú standard</span>        <span className="font-semibold text-brand">{tot.standard}</span></li>
                      <li className="flex justify-between"><span>Menú Celíaco</span>          <span className="font-semibold text-brand">{tot.celiaco}</span></li>
                      <li className="flex justify-between"><span>Menú Vegetariano/Vegano</span><span className="font-semibold text-brand">{tot.vegVeg}</span></li>
                      <li className="flex justify-between"><span>Otros</span>                 <span className="font-semibold text-brand">{tot.otros}</span></li>
                    </ul>
                  </div>

                  <Link
                    href={`/cocina/${ev.id}`}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-[13px] font-semibold text-white shadow transition-colors hover:brightness-95"
                  >
                    Abrir
                  </Link>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
