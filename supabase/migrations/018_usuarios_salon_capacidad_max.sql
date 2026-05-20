-- Capacidad máxima del salón (personas); límite superior para `eventos.cant_invitados`.
alter table public.usuarios
  add column if not exists salon_capacidad_max integer;

comment on column public.usuarios.salon_capacidad_max is 'Máximo de personas que admite el salón; cada evento no puede superar este valor en cant_invitados (null = datos históricos sin tope en app).';
