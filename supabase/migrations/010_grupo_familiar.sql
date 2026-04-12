-- Grupos familiares: cupos por invitación, menús por persona, bloqueo SmartPool si el grupo llena un auto.

alter table public.invitados
  add column if not exists grupo_cupos_max int not null default 4;

alter table public.invitados
  drop constraint if exists invitados_grupo_cupos_max_check;

alter table public.invitados
  add constraint invitados_grupo_cupos_max_check
  check (grupo_cupos_max >= 1 and grupo_cupos_max <= 20);

alter table public.invitados
  add column if not exists grupo_personas_confirmadas int;

alter table public.invitados
  add column if not exists grupo_menus_json jsonb not null default '[]'::jsonb;

alter table public.invitados
  add column if not exists smartpool_grupo_vehiculo_lleno boolean not null default false;

comment on column public.invitados.grupo_cupos_max is
  'Cupos máximos que el anfitrión asigna a esta invitación (familia); el invitado confirma cuántas personas van.';

comment on column public.invitados.grupo_personas_confirmadas is
  'Cantidad de personas confirmadas al evento para esta invitación (1..grupo_cupos_max).';

comment on column public.invitados.grupo_menus_json is
  'Array JSON: un menú/restricción por persona confirmada [{ "restriccion": "...", "restriccionOtro": null }].';

comment on column public.invitados.smartpool_grupo_vehiculo_lleno is
  'True si el grupo confirmó >= 4 personas: no puede usar SmartPool (auto lleno).';
