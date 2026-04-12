-- Coordenadas opcionales para ordenar sugerencias SmartPool por cercanía (conductor / pasajero)
alter table public.invitados
  add column if not exists smartpool_lat double precision,
  add column if not exists smartpool_lng double precision;
