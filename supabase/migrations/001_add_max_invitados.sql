-- Agregar campo max_invitados a usuarios (solo aplica a anfitriones)
alter table public.usuarios
  add column if not exists max_invitados int not null default 0;
