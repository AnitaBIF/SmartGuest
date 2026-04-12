alter table public.invitados
  add column if not exists grupo text,
  add column if not exists rango_etario text;
