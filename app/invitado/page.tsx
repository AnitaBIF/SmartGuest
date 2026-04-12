"use client";
import { useEffect, useState } from "react";
import EventLocationMap from "@/components/EventLocationMap";
import Sidebar from "./components/Sidebar";

type EventoData = {
  evento: {
    anfitriones: string;
    fecha: string;
    horario: string;
    salon: string;
    direccion: string;
    dressCode: string | null;
  };
  invitacion: {
    mesa: number | null;
  };
};

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl px-6 py-4 text-center text-white"
      style={{ backgroundColor: "#7aab8f", minWidth: 200 }}>
      <p className="text-[13px] font-semibold opacity-90">{label}</p>
      <p className="text-[15px] font-bold mt-0.5">{value}</p>
    </div>
  );
}

export default function DatosEventoPage() {
  const [data, setData] = useState<EventoData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/invitado/evento")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
          <Sidebar />
          <main className="flex flex-1 items-center justify-center">
            <p className="text-[#9ca3af]">Cargando...</p>
          </main>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
          <Sidebar />
          <main className="flex flex-1 items-center justify-center">
            <p className="text-[#6b7280]">No tienes eventos asignados.</p>
          </main>
        </div>
      </div>
    );
  }

  const { evento, invitacion } = data;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
        <Sidebar />
        <main className="flex-1 pb-8">
          <h1 className="mb-8 text-right text-2xl font-bold text-brand">Datos del Evento</h1>

          <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <div className="flex flex-col gap-4">
              <InfoCard label="Anfitriones" value={evento.anfitriones} />
              <InfoCard label="Día" value={evento.fecha} />
              <InfoCard label="Hora" value={`${evento.horario} hs`} />
              <InfoCard
                label="Mesa asignada"
                value={invitacion.mesa != null ? `N° ${invitacion.mesa}` : "Pendiente de asignación"}
              />
              {evento.dressCode && <InfoCard label="Dress Code" value={evento.dressCode} />}
            </div>

            <div className="flex-1">
              <h2 className="mb-3 text-right text-lg font-bold text-[#111827]">Ubicación</h2>
              <EventLocationMap salon={evento.salon} direccion={evento.direccion} height={360} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
