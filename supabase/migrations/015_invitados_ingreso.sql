-- Registro auditable de ingreso físico (validación QR en puerta).
alter table public.invitados
  add column if not exists ingresado boolean not null default false;

alter table public.invitados
  add column if not exists ingreso_at timestamptz;

comment on column public.invitados.ingresado is 'True si el titular de la invitación ingresó (QR validado en seguridad).';
comment on column public.invitados.ingreso_at is 'Primera vez que se validó el ingreso por QR; no se sobrescribe en re-escaneos.';

create index if not exists invitados_evento_ingreso_idx
  on public.invitados (evento_id)
  where ingresado = true;
