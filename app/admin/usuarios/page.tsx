"use client";

import { useState, useEffect, useCallback } from "react";
import { LeyendaObligatorios, Req } from "@/components/FormRequired";

/* ─── Tipos ─── */
const TIPOS_DB = ["administrador", "anfitrion", "jefe_cocina", "seguridad"] as const;
type TipoDB = typeof TIPOS_DB[number];

const TIPO_LABEL: Record<TipoDB, string> = {
  administrador: "Administrador",
  anfitrion:     "Anfitrión",
  jefe_cocina:   "Jefe de cocina",
  seguridad:     "Seguridad",
};

const TIPO_COLORS: Record<TipoDB, string> = {
  administrador:
    "bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-100",
  anfitrion: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-100",
  jefe_cocina: "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-100",
  seguridad: "bg-violet-100 text-violet-900 dark:bg-violet-950/70 dark:text-violet-100",
};

type Usuario = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
  tipo: TipoDB;
  max_invitados: number;
};

/* ─── Íconos ─── */
function IconEdit() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}
function IconTrash() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  );
}

/* ─── Input estilizado ─── */
const inp =
  "w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand";

type FormState = {
  nombre: string; apellido: string; dni: string;
  email: string; password: string; tipo: TipoDB; max_invitados: string;
};
const emptyForm: FormState = {
  nombre: "", apellido: "", dni: "", email: "",
  password: "", tipo: "anfitrion", max_invitados: "",
};

/* ─── Página ─── */
export default function UsuariosPage() {
  const [usuarios,      setUsuarios]      = useState<Usuario[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showModal,     setShowModal]     = useState(false);
  const [editTarget,    setEditTarget]    = useState<Usuario | null>(null);
  const [form,          setForm]          = useState<FormState>(emptyForm);
  const [showPass,      setShowPass]      = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/usuarios");
    if (res.ok) {
      const data = await res.json();
      setUsuarios(data as Usuario[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsuarios(); }, [fetchUsuarios]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setShowPass(false);
    setShowModal(true);
  };

  const openEdit = (u: Usuario) => {
    setEditTarget(u);
    setForm({ nombre: u.nombre, apellido: u.apellido, dni: u.dni,
              email: u.email, password: "", tipo: u.tipo,
              max_invitados: u.max_invitados > 0 ? String(u.max_invitados) : "" });
    setShowPass(false);
    setShowModal(true);
  };

  const closeModal = () => { setShowModal(false); setEditTarget(null); setForm(emptyForm); };

  const handleSubmit = async () => {
    if (!form.nombre || !form.apellido || !form.email) return;
    if (!editTarget && !form.password) { showToast("La contraseña es obligatoria.", false); return; }
    setSaving(true);

    const payload = {
      ...form,
      max_invitados: form.max_invitados ? parseInt(form.max_invitados) : 0,
      ...(editTarget ? { id: editTarget.id } : {}),
    };

    const res = await fetch("/api/admin/usuarios", {
      method: editTarget ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    setSaving(false);

    if (!res.ok) {
      showToast(json.error ?? "Error al guardar.", false);
      return;
    }

    showToast(editTarget ? "Usuario actualizado." : "Usuario creado con éxito.");
    closeModal();
    fetchUsuarios();
  };

  const handleDelete = async (id: string) => {
    const res = await fetch("/api/admin/usuarios", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    setDeleteConfirm(null);

    if (!res.ok) { showToast(json.error ?? "Error al eliminar.", false); return; }
    showToast("Usuario eliminado.");
    fetchUsuarios();
  };

  const f = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <>
    <main className="min-w-0 flex-1 pb-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <button
              onClick={openCreate}
              className="rounded-full bg-[#2d5a41] px-6 py-2.5 text-sm font-semibold text-white shadow hover:bg-[#24503a] transition-colors"
            >
              + Crear nuevo usuario
            </button>
            <h1 className="text-2xl font-bold text-brand">Gestión de usuarios</h1>
          </div>

          {/* Tabla */}
          <section>
            <h2 className="mb-4 text-lg font-semibold text-foreground">Usuarios</h2>

            <div className="overflow-hidden rounded-2xl border border-border bg-card ring-1 ring-[var(--ring-soft)]">
              <div className="grid grid-cols-[2fr_1.2fr_2fr_1.4fr_auto] gap-4 bg-card-muted px-5 py-3 text-[12px] font-semibold text-muted">
                <span>Nombre y Apellido</span>
                <span>DNI</span>
                <span>Email</span>
                <span>Tipo</span>
                <span />
              </div>

              {loading && (
                <div className="bg-card px-5 py-10 text-center text-sm text-muted">
                  Cargando usuarios...
                </div>
              )}

              {!loading && usuarios.map((u, i) => (
                <div
                  key={u.id}
                  className={`grid grid-cols-[2fr_1.2fr_2fr_1.4fr_auto] items-center gap-4 px-5 py-3 text-[13px] ${i % 2 === 0 ? "bg-card" : "bg-card-muted"}`}
                >
                  <span className="font-medium text-foreground">{u.nombre} {u.apellido}</span>
                  <span className="text-muted">{u.dni || "—"}</span>
                  <span className="truncate text-muted">{u.email}</span>
                  <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${TIPO_COLORS[u.tipo]}`}>
                    {TIPO_LABEL[u.tipo]}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="rounded-full p-1.5 text-muted hover:bg-card-muted hover:text-brand transition-colors"
                      title="Editar"
                    >
                      <IconEdit />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(u.id)}
                      className="rounded-full p-1.5 text-muted hover:bg-red-950/40 hover:text-red-400 transition-colors"
                      title="Eliminar"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}

              {!loading && usuarios.length === 0 && (
                <div className="bg-card px-5 py-10 text-center text-sm text-muted">
                  No hay usuarios registrados.
                </div>
              )}
            </div>
          </section>
    </main>

      {/* ─── Toast ─── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all ${toast.ok ? "bg-[#2d5a41]" : "bg-[#ef4444]"}`}>
          {toast.msg}
        </div>
      )}

      {/* ─── Modal crear / editar ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 dark:bg-black/50">
          <div className="w-full max-w-md rounded-3xl border border-border bg-card shadow-xl ring-1 ring-[var(--ring-soft)]">
            <div className="rounded-t-3xl border-b border-border bg-card-muted px-7 py-5">
              <h2 className="text-lg font-bold text-brand">
                {editTarget ? "Editar usuario" : "Crear nuevo usuario"}
              </h2>
            </div>

            <div className="space-y-4 px-7 py-6">
              <LeyendaObligatorios className="text-[11px] text-muted" />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted">
                    Nombre
                    <Req />
                  </label>
                  <input className={inp} placeholder="Ej: Carlos" value={form.nombre}
                    onChange={(e) => f("nombre", e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted">
                    Apellido
                    <Req />
                  </label>
                  <input className={inp} placeholder="Ej: Méndez" value={form.apellido}
                    onChange={(e) => f("apellido", e.target.value)} />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">DNI</label>
                <input
                  className={inp}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="7 a 10 dígitos, sin puntos (opcional)"
                  value={form.dni}
                  onChange={(e) => f("dni", e.target.value)}
                />
                <p className="mt-1 text-[10px] leading-snug text-muted">
                  Si lo dejás vacío, el sistema asigna un identificador interno único. Si lo completás, solo dígitos (se ignoran puntos y guiones).
                </p>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">
                  Email
                  <Req />
                </label>
                <input className={inp} type="email" placeholder="usuario@email.com" value={form.email}
                  onChange={(e) => f("email", e.target.value)} />
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">
                  {editTarget ? (
                    "Nueva contraseña (dejar vacío para no cambiar)"
                  ) : (
                    <>
                      Contraseña
                      <Req />
                    </>
                  )}
                </label>
                <div className="relative">
                  <input
                    className={`${inp} pr-10`}
                    type={showPass ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={form.password}
                    onChange={(e) => f("password", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-brand"
                  >
                    {showPass ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] font-medium text-muted">
                  Tipo de usuario
                  <Req />
                </label>
                <div className="relative">
                  <select
                    value={form.tipo}
                    onChange={(e) => f("tipo", e.target.value)}
                    className={`${inp} appearance-none pr-8`}
                  >
                    {TIPOS_DB.map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">⌄</span>
                </div>
              </div>

              {form.tipo === "anfitrion" && (
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-muted">Máx. invitados permitidos</label>
                  <input
                    className={inp}
                    type="number"
                    min="0"
                    placeholder="Ej: 150"
                    value={form.max_invitados}
                    onChange={(e) => f("max_invitados", e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-border bg-card-muted px-7 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-border px-6 py-2 text-sm text-foreground hover:bg-card"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-full bg-[#2d5a41] px-8 py-2 text-sm font-semibold text-white hover:bg-[#24503a] disabled:opacity-60"
              >
                {saving ? "Guardando..." : editTarget ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal confirmar eliminación ─── */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 dark:bg-black/50">
          <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 shadow-xl ring-1 ring-[var(--ring-soft)]">
            <h2 className="mb-2 text-base font-bold text-foreground">¿Eliminar usuario?</h2>
            <p className="mb-6 text-sm text-muted">
              Esta acción eliminará al usuario de la plataforma. No se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 rounded-xl border border-border py-2 text-sm text-foreground hover:bg-card-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-xl bg-[#ef4444] py-2 text-sm font-semibold text-white hover:bg-[#dc2626]"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
