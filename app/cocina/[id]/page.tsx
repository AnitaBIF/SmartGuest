"use client";

import { use, useEffect, useState } from "react";
import { CocinaTopBar } from "../components/CocinaTopBar";
import type { EventoCocina, Mesa } from "../data";

type Estado = "pendiente" | "preparacion" | "despachado";

const ESTADOS: { key: Estado; label: string; color: string }[] = [
  { key: "pendiente",   label: "Pendiente",       color: "#ef4444" },
  { key: "preparacion", label: "En preparación",  color: "#f59e0b" },
  { key: "despachado",  label: "Despachado",       color: "#22c55e" },
];

const CARD_BG: Record<Estado, string> = {
  pendiente:   "bg-[#e8f5ed] ring-[#c5dece]",
  preparacion: "bg-[#fefce8] ring-[#fde68a]",
  despachado:  "bg-[#d1fae5] ring-[#6ee7b7]",
};

function Semaforo({ estado }: { estado: Estado }) {
  return (
    <div className="flex flex-col items-center gap-[4px] rounded-xl bg-[#1a1a1a] px-2.5 py-2.5 shadow-md">
      <span className={`h-4 w-4 rounded-full border border-black/40 transition-all duration-300 ${
        estado === "pendiente" ? "bg-[#ef4444] shadow-[0_0_8px_#ef4444]" : "bg-[#3a1a1a]"
      }`} />
      <span className={`h-4 w-4 rounded-full border border-black/40 transition-all duration-300 ${
        estado === "preparacion" ? "bg-[#f59e0b] shadow-[0_0_8px_#f59e0b]" : "bg-[#2e2a1a]"
      }`} />
      <span className={`h-4 w-4 rounded-full border border-black/40 transition-all duration-300 ${
        estado === "despachado" ? "bg-[#22c55e] shadow-[0_0_8px_#22c55e]" : "bg-[#1a2e1a]"
      }`} />
    </div>
  );
}

function MesaCard({ mesa, estado, onEstado }: { mesa: Mesa; estado: Estado; onEstado: (e: Estado) => void }) {
  const total = mesa.menus.standard + mesa.menus.celiaco + mesa.menus.vegVeg + mesa.menus.otros;

  return (
    <div className={`flex flex-col rounded-3xl p-5 ring-1 shadow-sm transition-colors duration-300 ${CARD_BG[estado]}`}>
      <div className="mb-3 flex items-start justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-[#1a3d28]">
            {mesa.numero === 0 ? "Sin mesa asignada" : `Mesa ${mesa.numero}`}
          </h3>
          <p className="text-[11px] text-[#4b7a5e]">{total} cubiertos</p>
        </div>
        <Semaforo estado={estado} />
      </div>

      <ul className="mb-4 space-y-1 text-[13px] text-[#374151]">
        {mesa.menus.standard > 0 && (
          <li className="flex justify-between"><span>Menú standard</span><span className="font-semibold text-[#1a3d28]">{mesa.menus.standard}</span></li>
        )}
        {mesa.menus.celiaco > 0 && (
          <li className="flex justify-between"><span>Menú Celíaco</span><span className="font-semibold text-[#1a3d28]">{mesa.menus.celiaco}</span></li>
        )}
        {mesa.menus.vegVeg > 0 && (
          <li className="flex justify-between"><span>Menú Vegetariano/Vegano</span><span className="font-semibold text-[#1a3d28]">{mesa.menus.vegVeg}</span></li>
        )}
        {mesa.menus.otros > 0 && (
          <li className="flex justify-between gap-2">
            <span className="text-[#6b7280]">{mesa.menus.otrosDetalle ?? "Otros"}</span>
            <span className="flex-shrink-0 font-semibold text-[#1a3d28]">{mesa.menus.otros}</span>
          </li>
        )}
        {total === 0 && <li className="text-[#9ca3af]">Sin invitados asignados</li>}
      </ul>

      <div className="mt-auto flex overflow-hidden rounded-2xl border border-[#c5dece]">
        {ESTADOS.map(({ key, label, color }) => {
          const active = estado === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onEstado(key)}
              style={{
                flex: 1,
                backgroundColor: active ? color : "#ffffff",
                color: active ? "#ffffff" : "#6b7280",
                borderRight: key !== "despachado" ? "1px solid #c5dece" : undefined,
              }}
              className="py-2 px-1 text-[11px] font-semibold leading-tight transition-colors"
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function EventoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [evento, setEvento] = useState<EventoCocina | null>(null);
  const [loading, setLoading] = useState(true);
  const [estados, setEstados] = useState<Record<string, Estado>>({});

  useEffect(() => {
    fetch("/api/cocina")
      .then((r) => r.json())
      .then((data: unknown) => {
        const list: EventoCocina[] = Array.isArray(data) ? (data as EventoCocina[]) : [];
        const found = list.find((e) => e.id === id);
        if (found) {
          setEvento(found);
          const initial: Record<string, Estado> = {};
          found.mesas.forEach((m) => {
            initial[m.id] = (m as Mesa & { estado?: Estado }).estado ?? "pendiente";
          });
          setEstados(initial);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-[#9ca3af]">Cargando...</p></div>;
  if (!evento) return <div className="flex min-h-screen items-center justify-center"><p className="text-[#6b7280]">Evento no encontrado.</p></div>;

  const getEstado = (mesaId: string | number): Estado => estados[mesaId] ?? "pendiente";
  const setEstado = (mesaId: string | number, e: Estado) => {
    setEstados((p) => ({ ...p, [mesaId]: e }));
    // Persistir en Supabase
    fetch("/api/cocina/estado", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mesa_id: mesaId, estado: e }),
    });
  };

  const totalMesas    = evento.mesas.length;
  const enPreparacion = evento.mesas.filter((m) => getEstado(m.id) === "preparacion").length;
  const despachadas   = evento.mesas.filter((m) => getEstado(m.id) === "despachado").length;
  const pctDespachado  = totalMesas > 0 ? (despachadas / totalMesas) * 100 : 0;
  const pctPreparacion = totalMesas > 0 ? (enPreparacion / totalMesas) * 100 : 0;

  const handlePrint = () => {
    const rows = evento.mesas.map((m, i) => {
      const total = m.menus.standard + m.menus.celiaco + m.menus.vegVeg + m.menus.otros;
      const items = [
        m.menus.standard > 0 ? `Standard: ${m.menus.standard}` : null,
        m.menus.celiaco  > 0 ? `Celíaco: ${m.menus.celiaco}`  : null,
        m.menus.vegVeg   > 0 ? `Veg/Veg: ${m.menus.vegVeg}`   : null,
        m.menus.otros    > 0 ? (m.menus.otrosDetalle ?? `Otros: ${m.menus.otros}`) : null,
      ].filter(Boolean).join(" · ");
      return `<tr style="background:${i % 2 === 0 ? "white" : "#f0f7f2"}">
        <td style="padding:8px 14px;font-weight:600;color:#1a3d28">Mesa ${m.numero}</td>
        <td style="padding:8px 14px;color:#374151">${items}</td>
        <td style="padding:8px 14px;text-align:center;font-weight:700;color:#2d5a41">${total}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
      <title>Reporte – ${evento.titulo}</title>
      <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:sans-serif;padding:40px;color:#111827}.brand{font-size:22px;font-weight:800;color:#2d5a41}h1{font-size:18px;font-weight:700;margin:14px 0 4px}.sub{font-size:13px;color:#6b7280;margin-bottom:24px}table{width:100%;border-collapse:collapse;font-size:14px}th{background:#2d5a41;color:white;padding:10px 14px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em}th:last-child{text-align:center}.footer{margin-top:32px;font-size:11px;color:#9ca3af;text-align:center}</style></head><body>
      <div class="brand">SMART<span style="font-weight:400"> GUEST</span></div>
      <h1>Evento del día ${evento.fecha} — ${evento.titulo}</h1>
      <p class="sub">Anfitriones: ${evento.anfitriones}</p>
      <table><thead><tr><th>Mesa</th><th>Detalle de menús</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="footer">Generado por SmartGuest · ${new Date().toLocaleDateString("es-AR")}</div>
    </body></html>`;

    const win = window.open("", "_blank", "width=700,height=600");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.onload = () => { win.print(); win.close(); };
  };

  return (
    <div className="min-h-screen text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-8 text-foreground sm:px-6 lg:px-8">
        <CocinaTopBar />
        <main className="pb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button type="button" onClick={handlePrint}
                className="flex items-center gap-2 rounded-full bg-[#2d5a41] px-5 py-2.5 text-[13px] font-semibold text-white shadow hover:bg-[#24503a] transition-colors">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect x="6" y="14" width="12" height="8"/>
                </svg>
                Imprimir
              </button>
              <div className="flex items-center gap-3 text-[13px]">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f59e0b]" />
                  <span className="text-[#6b7280]">{enPreparacion} en preparación</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
                  <span className="text-[#6b7280]">{despachadas}/{totalMesas} despachadas</span>
                </span>
              </div>
            </div>
            <h1 className="text-xl font-bold text-brand">Evento del día {evento.fecha}</h1>
          </div>

          <div className="mb-6 h-2.5 w-full overflow-hidden rounded-full bg-[#e0ede6]">
            <div className="flex h-full">
              <div className="h-full rounded-l-full bg-[#22c55e] transition-all duration-500" style={{ width: `${pctDespachado}%` }} />
              <div className={`h-full bg-[#f59e0b] transition-all duration-500 ${pctDespachado === 0 ? "rounded-l-full" : ""}`}
                style={{ width: `${pctPreparacion}%` }} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {evento.mesas.map((mesa) => (
              <MesaCard key={mesa.id} mesa={mesa} estado={getEstado(mesa.id)} onEstado={(e) => setEstado(mesa.id, e)} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
