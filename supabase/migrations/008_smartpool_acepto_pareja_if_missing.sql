-- Si ves: "Could not find the 'smartpool_acepto' column ... in the schema cache"
-- Ejecutá este archivo en Supabase → SQL Editor (una sola vez).
-- Luego: Dashboard → Settings → API → "Restart" del proyecto, o esperá ~1 minuto a que PostgREST recargue el esquema.

alter table public.invitados
  add column if not exists smartpool_pareja_invitado_id uuid references public.invitados (id) on delete set null;

alter table public.invitados
  add column if not exists smartpool_acepto boolean not null default false;

create index if not exists invitados_smartpool_busqueda_idx
  on public.invitados (evento_id, rol_smartpool)
  where
    smartpool_pareja_invitado_id is null
    and rol_smartpool in ('conductor', 'pasajero');

alter table public.invitados
  add column if not exists smartpool_lat double precision,
  add column if not exists smartpool_lng double precision;
