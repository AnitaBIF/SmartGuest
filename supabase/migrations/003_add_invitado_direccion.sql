alter table public.invitados
  add column if not exists direccion  text,
  add column if not exists localidad  text;
