"use client";

import Sidebar from "@/app/invitado/components/Sidebar";

type Props = {
  children: React.ReactNode;
  /** Clases extra en <main> (p. ej. flex, centrado). */
  mainClassName?: string;
};

/**
 * Layout común invitado: espacio bajo el menú hamburguesa, margen para el botón de tema,
 * safe-area en iOS y `min-w-0` para que el flex no desborde en pantallas chicas.
 */
export function InvitadoShell({ children, mainClassName = "" }: Props) {
  return (
    <div className="min-h-dvh text-foreground [overflow-wrap:anywhere]">
      <div
        className={
          "mx-auto flex min-h-dvh w-full max-w-5xl gap-4 sm:gap-6 " +
          "pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:px-6 " +
          "pt-16 pb-[max(7rem,calc(env(safe-area-inset-bottom,0px)+5rem))] md:pt-6 md:pb-10"
        }
      >
        <Sidebar />
        <main className={`min-w-0 flex-1 ${mainClassName}`.trim()}>{children}</main>
      </div>
    </div>
  );
}
