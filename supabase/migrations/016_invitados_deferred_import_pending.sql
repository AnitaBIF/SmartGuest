-- Import masivo sin crear cuentas Auth en el acto: filas con usuario_id NULL
-- hasta que el invitado abre /invitacion/:id y confirma (Ola 2).

ALTER TABLE public.invitados
  ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE public.invitados
  ADD COLUMN IF NOT EXISTS pending_import_nombre text,
  ADD COLUMN IF NOT EXISTS pending_import_email text,
  ADD COLUMN IF NOT EXISTS pending_import_dni text;

COMMENT ON COLUMN public.invitados.pending_import_nombre IS 'Nombre completo del Excel hasta vincular usuario (usuario_id NULL).';
COMMENT ON COLUMN public.invitados.pending_import_email IS 'Email previsto/import hasta vincular cuenta.';
COMMENT ON COLUMN public.invitados.pending_import_dni IS 'DNI o código SG provisional hasta confirmar.';
