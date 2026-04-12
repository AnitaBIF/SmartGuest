"use client";
import { useEffect, useState } from "react";
import { LeyendaObligatorios, Req } from "@/components/FormRequired";
import Sidebar from "../components/Sidebar";

const inp = "flex-1 rounded-full border border-[#d1d5db] bg-white px-4 py-2 text-[13px] text-[#111827] outline-none focus:border-[#2d5a41] focus:ring-2 focus:ring-[#2d5a41]/20";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
      <label className="w-full text-[13px] text-[#374151] sm:w-52 sm:text-right sm:pr-5">
        {label}
        {required ? <Req /> : null}
      </label>
      {children}
    </div>
  );
}

export default function ConfiguracionPage() {
  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    localidad: "",
    telefono: "",
    restriccion: "Ninguna",
    restriccionOtro: "",
    cancion: "",
  });
  const [loading, setLoading] = useState(true);
  const [guardado, setGuardado] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restriccionesOpciones, setRestriccionesOpciones] = useState<string[]>(["Ninguna"]);

  useEffect(() => {
    fetch("/api/invitado/evento")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          const inv = data.invitacion;
          const base =
            Array.isArray(data.menuOpciones) && data.menuOpciones.length > 0
              ? (data.menuOpciones as string[])
              : ["Ninguna"];
          let restriccion = inv.restriccion_alimentaria ?? "Ninguna";
          if (restriccion === "otro") restriccion = "Otro";
          const opts = [...base];
          if (restriccion !== "Ninguna" && !opts.includes(restriccion)) opts.push(restriccion);
          setRestriccionesOpciones(opts);
          const restriccionForm = opts.includes(restriccion) ? restriccion : "Ninguna";

          setForm({
            nombre: data.usuario.nombre || "",
            direccion: inv.direccion || "",
            localidad: inv.localidad || "",
            telefono: inv.telefono || "",
            restriccion: restriccionForm,
            restriccionOtro: inv.restriccion_otro || "",
            cancion: inv.cancion || "",
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleGuardar = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/invitado/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setGuardado(true);
        setTimeout(() => setGuardado(false), 3000);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
        <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
          <Sidebar />
          <main className="flex flex-1 items-center justify-center"><p className="text-[#9ca3af]">Cargando...</p></main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_50%_-10%,#e3efe8_0,#f5f7f4_40%,#ffffff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-5xl gap-6 px-4 py-6 sm:px-6">
        <Sidebar />

        <main className="flex-1 pb-8">
          <h1 className="mb-8 text-right text-2xl font-bold text-brand">Configuración</h1>

          <div className="rounded-3xl bg-white p-8 shadow ring-1 ring-[#e5efe8]">
            <h2 className="mb-4 text-[18px] font-semibold text-[#111827]">
              Aquí puedes editar datos que necesites cambiar
            </h2>
            <LeyendaObligatorios className="mb-6 text-[12px] text-[#6b7280]" />

            <div className="space-y-5">
              <Field label="Nombre y Apellido" required>
                <input className={inp} type="text" value={form.nombre} onChange={set("nombre")} />
              </Field>

              <Field label="Dirección">
                <input className={inp} type="text" value={form.direccion} onChange={set("direccion")} />
              </Field>

              <Field label="Localidad">
                <input className={inp} type="text" value={form.localidad} onChange={set("localidad")} />
              </Field>

              <Field label="Celular (SmartPool / contacto)">
                <input
                  className={inp}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="Ej: 381 5123456"
                  value={form.telefono}
                  onChange={set("telefono")}
                />
              </Field>

              <Field label="Restricciones alimentarias" required>
                <div className="relative flex-1">
                  <select value={form.restriccion} onChange={set("restriccion")}
                    className={`${inp} w-full appearance-none pr-8`}>
                    {restriccionesOpciones.map((r) => <option key={r}>{r}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7280] text-xs">⌄</span>
                </div>
              </Field>

              {form.restriccion === "Otro" && (
                <Field label="Detalle de «Otro»" required>
                  <input className={inp} type="text" placeholder="Especificá tu restricción"
                    value={form.restriccionOtro} onChange={set("restriccionOtro")} />
                </Field>
              )}

              <Field label="¿Qué canción no puede faltar?">
                <input className={inp} type="text" value={form.cancion} onChange={set("cancion")} />
              </Field>
            </div>

            <div className="mt-10 flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleGuardar}
                disabled={saving}
                className="rounded-xl px-12 py-3 text-base font-bold text-white transition-colors disabled:opacity-60"
                style={{ backgroundColor: "#2d5a41" }}
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>

              {guardado && (
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#16a34a]">
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 8 6 12 14 4" />
                  </svg>
                  Cambios guardados
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
