"use client";

import { useEffect, useState } from "react";
import type { EventoCocina } from "../../cocina/data";

function printReporte(ev: EventoCocina) {
  const rows = ev.mesas.map((m, i) => {
    const total = m.menus.standard + m.menus.celiaco + m.menus.vegVeg + m.menus.otros;
    const detalle = [
      m.menus.standard > 0 ? `Standard: ${m.menus.standard}` : null,
      m.menus.celiaco  > 0 ? `Celíaco: ${m.menus.celiaco}`  : null,
      m.menus.vegVeg   > 0 ? `Veg/Veg: ${m.menus.vegVeg}`   : null,
      m.menus.otros    > 0 ? (m.menus.otrosDetalle ?? `Otros: ${m.menus.otros}`) : null,
    ].filter(Boolean).join(" · ");
    const mesaLabel = m.numero === 0 ? "Sin mesa asignada" : `Mesa ${m.numero}`;
    return `<tr style="background:${i % 2 === 0 ? "white" : "#f0f7f2"}">
      <td style="padding:8px 14px;font-weight:600;color:#1a3d28">${mesaLabel}</td>
      <td style="padding:8px 14px;color:#374151">${detalle}</td>
      <td style="padding:8px 14px;text-align:center;font-weight:700;color:#2d5a41">${total}</td>
    </tr>`;
  }).join("");

  const grandTotal = ev.mesas.reduce((a, m) =>
    a + m.menus.standard + m.menus.celiaco + m.menus.vegVeg + m.menus.otros, 0);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <title>Reporte de Cocina – ${ev.titulo}</title>
    <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:sans-serif;padding:40px;color:#111827}
      .brand{font-size:22px;font-weight:800;color:#2d5a41}
      h1{font-size:18px;font-weight:700;margin:14px 0 4px}
      .sub{font-size:13px;color:#6b7280;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;font-size:14px}
      th{background:#2d5a41;color:white;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
      th:last-child{text-align:center}
      .total-row td{background:#1a3d28;color:white;padding:10px 14px;font-weight:700}
      .total-row td:last-child{text-align:center;font-size:18px}
      .footer{margin-top:32px;font-size:11px;color:#9ca3af;text-align:center}
    </style></head><body>
    <div class="brand">SMART<span style="font-weight:400"> GUEST</span></div>
    <h1>Reporte de Cocina — Evento del día ${ev.fecha}</h1>
    <p class="sub">${ev.titulo} · Anfitriones: ${ev.anfitriones}</p>
    <table>
      <thead><tr><th>Mesa</th><th>Detalle de menús</th><th>Cubiertos</th></tr></thead>
      <tbody>
        ${rows}
        <tr class="total-row">
          <td colspan="2">Total general</td>
          <td>${grandTotal}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">Generado por SmartGuest · ${new Date().toLocaleDateString("es-AR")}</div>
  </body></html>`;

  const win = window.open("", "_blank", "width=700,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.onload = () => { win.print(); win.close(); };
}

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

export default function AdminCocinaPage() {
  const [eventos, setEventos] = useState<EventoCocina[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    fetch("/api/cocina", { credentials: "same-origin" })
      .then(async (r) => {
        const data: unknown = await r.json();
        if (cancelled) return;
        if (!r.ok) {
          const msg =
            typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "No se pudo cargar el reporte.";
          setLoadError(msg);
          setEventos([]);
          return;
        }
        setEventos(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setLoadError("No se pudo cargar el reporte.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="min-w-0 flex-1 pb-8">
          <h1 className="mb-8 text-right text-2xl font-bold text-brand">Reporte de Cocina</h1>

          {loading && <p className="text-center text-muted">Cargando eventos...</p>}

          {!loading && loadError && (
            <p className="text-center text-[13px] text-red-800 dark:text-red-200">{loadError}</p>
          )}

          {!loading && !loadError && eventos.length === 0 && (
            <p className="text-center text-muted">No hay eventos con mesas creadas.</p>
          )}

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {eventos.map((ev) => {
              const tot = totalMenus(ev);
              const grand = tot.standard + tot.celiaco + tot.vegVeg + tot.otros;
              return (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between rounded-3xl border border-border bg-card p-6 shadow-sm ring-1 ring-[var(--ring-soft)]"
                >
                  <div>
                    <h3 className="mb-0.5 text-[15px] font-bold text-brand">Evento del día {ev.fecha}</h3>
                    <p className="mb-1 text-[11px] text-muted">{ev.titulo}</p>
                    <p className="mb-4 text-[10px] text-muted/90">{ev.mesas.length} mesas</p>

                    <ul className="space-y-1 text-[13px] text-foreground">
                      <li className="flex justify-between gap-2">
                        <span className="text-muted">Menú standard</span>
                        <span className="font-semibold text-brand">{tot.standard}</span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-muted">Menú Celíaco</span>
                        <span className="font-semibold text-brand">{tot.celiaco}</span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-muted">Menú Vegetariano/Vegano</span>
                        <span className="font-semibold text-brand">{tot.vegVeg}</span>
                      </li>
                      <li className="flex justify-between gap-2">
                        <span className="text-muted">Otros</span>
                        <span className="font-semibold text-brand">{tot.otros}</span>
                      </li>
                    </ul>

                    <div className="mt-3 flex items-center justify-between rounded-xl border border-border bg-card-muted px-3 py-2">
                      <span className="text-[12px] font-semibold text-foreground">Total cubiertos</span>
                      <span className="text-[15px] font-bold text-brand">{grand}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => printReporte(ev)}
                    className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-[13px] font-semibold text-white shadow transition-colors hover:brightness-95"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                      <rect x="6" y="14" width="12" height="8"/>
                    </svg>
                    Imprimir reporte
                  </button>
                </div>
              );
            })}
          </div>
    </main>
  );
}
