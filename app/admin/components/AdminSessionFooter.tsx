"use client";

import { useEffect, useState } from "react";
import { SidebarUserChip } from "@/components/SidebarUserChip";
import { logout } from "@/lib/supabase";

type MeResponse = {
  displayName?: string;
  tipoLabel?: string;
};

export function AdminSessionFooter({ onBeforeLogout }: { onBeforeLogout?: () => void } = {}) {
  const [displayName, setDisplayName] = useState("Administrador");
  const [tipoLabel, setTipoLabel] = useState("Administrador");

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me: MeResponse | null) => {
        if (!me) return;
        if (typeof me.displayName === "string" && me.displayName.trim()) {
          setDisplayName(me.displayName.trim());
        }
        if (typeof me.tipoLabel === "string" && me.tipoLabel.trim()) {
          setTipoLabel(me.tipoLabel.trim());
        }
      })
      .catch(() => {});
  }, []);

  return (
    <SidebarUserChip
      displayName={displayName}
      subtitle={tipoLabel}
      onLogout={() => {
        onBeforeLogout?.();
        void logout();
      }}
    />
  );
}
