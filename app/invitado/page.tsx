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
      className="flex w-full min-w-0 flex-col items-center justify-center rounded-2xl px-4 py-4 text-center text-white sm:px-6"
      style={{ backgroundColor: "#7aab8f" }}
    >
      <p className="text-[13px] font-semibold opacity-90">{label}</p>
      <p className="mt-0.5 text-[15px] font-bold break-words">{value}</p>
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

      <div className="flex min-w-0 flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex min-w-0 w-full flex-col gap-4 lg:max-w-md">
          <InfoCard label="Anfitriones" value={evento.anfitriones} />
          <InfoCard label="Día" value={evento.fecha} />
          <InfoCard label="Hora" value={`${evento.horario} hs`} />
          <InfoCard
            label="Mesa asignada"
            value={invitacion.mesa != null ? `N° ${invitacion.mesa}` : "Pendiente de asignación"}
          />
          {evento.dressCode && <InfoCard label="Dress Code" value={evento.dressCode} />}
        </div>

        <div className="min-w-0 w-full flex-1">
          <h2 className="mb-3 w-full text-center text-lg font-bold text-foreground md:text-right">Ubicación</h2>
          <EventLocationMap salon={evento.salon} direccion={evento.direccion} />
        </div>
      </div>
    </InvitadoShell>
  );
}
