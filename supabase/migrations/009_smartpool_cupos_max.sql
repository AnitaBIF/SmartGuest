-- SmartPool: cupos de pasajeros por conductor (default 4 plazas típicas de auto).
alter table public.invitados
  add column if not exists smartpool_cupos_max smallint not null default 4;

alter table public.invitados
  drop constraint if exists invitados_smartpool_cupos_max_check;

alter table public.invitados
  add constraint invitados_smartpool_cupos_max_check
  check (smartpool_cupos_max >= 1 and smartpool_cupos_max <= 8);

-- Modelo "estrella": solo el pasajero guarda smartpool_pareja_invitado_id = conductor.
-- Quitar el vínculo inverso que apuntaba del conductor al pasajero (migración desde 1:1).
update public.invitados c
set
  smartpool_pareja_invitado_id = null,
  smartpool_acepto = false
where
  c.rol_smartpool = 'conductor'
  and c.smartpool_pareja_invitado_id is not null;

comment on column public.invitados.smartpool_cupos_max is
  'Máximo de pasajeros SmartPool que puede llevar el conductor (por defecto 4).';
