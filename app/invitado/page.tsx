"use client";
import { useEffect, useState } from "react";
import EventLocationMap from "@/components/EventLocationMap";
import { InvitadoShell } from "@/components/InvitadoShell";

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
    <div
      className="flex w-full min-w-0 flex-col items-center justify-center rounded-xl px-3 py-2.5 text-center text-white sm:px-4 sm:py-3"
      style={{ backgroundColor: "#7aab8f" }}
    >
      <p className="text-[11px] font-semibold opacity-90 sm:text-[12px]">{label}</p>
      <p className="mt-0.5 text-[13px] font-bold break-words sm:text-[14px]">{value}</p>
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
      <InvitadoShell mainClassName="flex items-center justify-center">
        <p className="text-muted">Cargando...</p>
      </InvitadoShell>
    );
  }

  if (!data) {
    return (
      <InvitadoShell mainClassName="flex items-center justify-center">
        <p className="text-muted">No tienes eventos asignados.</p>
      </InvitadoShell>
    );
  }

  const { evento, invitacion } = data;

  return (
    <InvitadoShell>
      <h1 className="mb-6 w-full text-center text-2xl font-bold text-brand md:mb-8 md:text-right">
        Datos del Evento
      </h1>

      <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12 lg:items-stretch lg:gap-8">
        <div className="flex min-w-0 flex-col gap-2.5 lg:col-span-4 lg:max-w-none xl:col-span-3">
          <InfoCard label="Anfitriones" value={evento.anfitriones} />
          <InfoCard label="Día" value={evento.fecha} />
          <InfoCard label="Hora" value={`${evento.horario} hs`} />
          <InfoCard
            label="Mesa asignada"
            value={invitacion.mesa != null ? `N° ${invitacion.mesa}` : "Pendiente de asignación"}
          />
          {evento.dressCode && <InfoCard label="Dress Code" value={evento.dressCode} />}
        </div>

        <div className="min-w-0 lg:col-span-8 xl:col-span-9">
          <h2 className="mb-2 w-full text-center text-lg font-bold text-foreground lg:mb-3 lg:text-right">
            Ubicación
          </h2>
          <EventLocationMap salon={evento.salon} direccion={evento.direccion} variant="invitado" />
        </div>
      </div>
    </InvitadoShell>
  );
}
