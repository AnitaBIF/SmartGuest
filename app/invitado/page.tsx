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

function InfoCard({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div
      className={
        "flex w-full min-w-0 flex-col justify-center rounded-xl border border-[#5d8f73]/35 bg-[#7aab8f] px-3 py-3 text-left text-white shadow-sm dark:border-border dark:bg-card-muted dark:text-foreground dark:shadow-none sm:px-4 sm:py-3 sm:text-center " +
        className
      }
    >
      <p className="text-[11px] font-semibold opacity-90 dark:text-muted sm:text-[12px]">{label}</p>
      <p className="mt-1 text-[14px] font-bold leading-snug break-words sm:text-[15px]">{value}</p>
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
      <h1 className="mb-4 w-full text-balance text-2xl font-bold text-brand sm:mb-6 md:mb-8 md:text-right">
        Datos del Evento
      </h1>

      <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-12 lg:items-stretch lg:gap-8">
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5 lg:col-span-4 lg:flex lg:max-w-none lg:flex-col lg:gap-2.5 xl:col-span-3">
          <InfoCard className="col-span-2" label="Anfitriones" value={evento.anfitriones} />
          <InfoCard label="Día" value={evento.fecha} />
          <InfoCard label="Hora" value={`${evento.horario} hs`} />
          <InfoCard
            className="col-span-2"
            label="Mesa asignada"
            value={invitacion.mesa != null ? `N° ${invitacion.mesa}` : "Pendiente de asignación"}
          />
          {evento.dressCode ? (
            <InfoCard className="col-span-2" label="Dress Code" value={evento.dressCode} />
          ) : null}
        </div>

        <div className="min-w-0 lg:col-span-8 xl:col-span-9">
          <h2 className="mb-2 w-full text-balance text-lg font-bold text-foreground sm:mb-3 md:text-right">
            Ubicación
          </h2>
          <EventLocationMap salon={evento.salon} direccion={evento.direccion} variant="invitado" />
        </div>
      </div>
    </InvitadoShell>
  );
}
