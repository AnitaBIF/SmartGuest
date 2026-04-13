import Link from "next/link";

export default function RecuperarContrasenaPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-foreground">
      <h1 className="text-2xl font-bold text-brand">Recuperar contraseña</h1>
      <p className="mt-3 text-center text-foreground/80">
        Flujo en construcción.
      </p>
      <Link
        href="/"
        className="mt-8 text-sm font-medium text-brand underline"
      >
        Volver al login
      </Link>
    </main>
  );
}
