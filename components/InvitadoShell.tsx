"use client";

import Sidebar from "@/app/invitado/components/Sidebar";
import { AssistantChat } from "@/components/AssistantChat";
import { useSidebarCollapsed } from "@/lib/useSidebarCollapsed";

type Props = {
  children: React.ReactNode;
  /** Clases extra en <main> (p. ej. flex, centrado). */
  mainClassName?: string;
};

/**
 * Layout común invitado: espacio bajo el menú hamburguesa, safe-area en iOS y `min-w-0`
 * para que el flex no desborde en pantallas chicas. (El tema va en el menú lateral.)
 */
export function InvitadoShell({ children, mainClassName = "" }: Props) {
  const [desktopCollapsed, setDesktopCollapsed] = useSidebarCollapsed("invitado.sidebar.collapsed");

  return (
    <div className="min-h-dvh text-foreground [overflow-wrap:anywhere]">
      <div
        className={
          "flex min-h-dvh w-full gap-4 sm:gap-6 " +
          "pl-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] sm:px-6 " +
          "pt-16 pb-[max(4.5rem,calc(env(safe-area-inset-bottom,0px)+2.5rem))] md:pt-6 md:pb-10"
        }
      >
        <Sidebar desktopCollapsed={desktopCollapsed} onToggleDesktop={setDesktopCollapsed} />
        <main className={`min-w-0 flex-1 ${mainClassName}`.trim()}>{children}</main>
      </div>
      <AssistantChat />
    </div>
  );
}
