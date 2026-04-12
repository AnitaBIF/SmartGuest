-- EcoGuest: cupos = personas en la invitación (default 1).
-- Plazas SmartPool para conductor = max(0, 5 - grupo_cupos_max) si N<=5; si N>5 no hay EcoGuest.
-- Permite smartpool_cupos_max = 0 (grupo de 5: insignia conductor/pasajeros sin cupos extra).

alter table public.invitados alter column grupo_cupos_max set default 1;

alter table public.invitados
  drop constraint if exists invitados_smartpool_cupos_max_check;

alter table public.invitados
  add constraint invitados_smartpool_cupos_max_check
  check (smartpool_cupos_max >= 0 and smartpool_cupos_max <= 8);

-- `where id is not null` equivale a todas las filas (toda fila tiene id); evita la alerta del editor por UPDATE sin WHERE.
update public.invitados
set
  smartpool_cupos_max = case
    when grupo_cupos_max > 5 then 0
    else greatest(0, 5 - grupo_cupos_max)
  end,
  smartpool_grupo_vehiculo_lleno = false
where id is not null;

comment on column public.invitados.grupo_cupos_max is
  'Cantidad de personas cubiertas por esta invitación (1–20). EcoGuest: plazas extra en pool = max(0,5-N) si N≤5; si N>5 no aplica EcoGuest.';

comment on column public.invitados.smartpool_grupo_vehiculo_lleno is
  'Reservado; la lógica de cupos usa grupo_cupos_max y smartpool_cupos_max.';
