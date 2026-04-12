"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LoginScreen from "@/components/LoginScreen";

function LoginContent() {
  const searchParams = useSearchParams();
  const desdeInvitacion = searchParams.get("desde") === "invitacion";

  return <LoginScreen signOutOnMount={desdeInvitacion} />;
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-white text-sm text-[#6b7280]">
          Cargando…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
