-- Emparejamiento SmartPool EcoGuest: pareja bidireccional y aceptación mutua
alter table public.invitados
  add column if not exists smartpool_pareja_invitado_id uuid references public.invitados (id) on delete set null;

alter table public.invitados
  add column if not exists smartpool_acepto boolean not null default false;

create index if not exists invitados_smartpool_busqueda_idx
  on public.invitados (evento_id, rol_smartpool)
  where
    smartpool_pareja_invitado_id is null
    and rol_smartpool in ('conductor', 'pasajero');
