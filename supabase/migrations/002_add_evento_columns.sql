-- Columnas adicionales para eventos
alter table public.eventos
  add column if not exists tipo text,
  add column if not exists anfitrion1_nombre text not null default '',
  add column if not exists anfitrion2_nombre text,
  add column if not exists cant_invitados int not null default 0,
  add column if not exists cant_mesas int not null default 0,
  add column if not exists menu_standard text;

-- Hacer anfitrion_id nullable (el admin crea el evento y luego lo asigna)
alter table public.eventos alter column anfitrion_id drop not null;
