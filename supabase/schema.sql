-- =============================================
-- SmartGuest – Schema completo
-- Pegar en Supabase > SQL Editor > New query
-- =============================================

-- Tipos
create type tipo_usuario as enum ('administrador', 'anfitrion', 'jefe_cocina', 'seguridad', 'invitado');
create type estado_mesa as enum ('pendiente', 'preparacion', 'despachado');
create type rol_smartpool as enum ('conductor', 'pasajero', 'no');
create type estado_asistencia as enum ('pendiente', 'confirmado', 'rechazado');

-- ─── USUARIOS (extiende auth.users de Supabase) ───────────────────────────────
create table public.usuarios (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  nombre     text not null,
  apellido   text not null,
  dni        text not null unique,
  tipo       tipo_usuario not null default 'invitado',
  created_at timestamptz not null default now()
);
alter table public.usuarios enable row level security;

-- ─── EVENTOS ──────────────────────────────────────────────────────────────────
create table public.eventos (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  fecha                 date not null,
  horario               text not null,
  salon                 text not null,
  direccion             text not null,
  monto_total           numeric(10,2) not null default 0,
  sena                  numeric(10,2) not null default 0,
  dress_code            text,
  menus_especiales      text[] not null default '{}',
  menus_especiales_otro text,
  anfitrion_id          uuid not null references public.usuarios(id),
  created_at            timestamptz not null default now()
);
alter table public.eventos enable row level security;

-- ─── MESAS ────────────────────────────────────────────────────────────────────
create table public.mesas (
  id         uuid primary key default gen_random_uuid(),
  evento_id  uuid not null references public.eventos(id) on delete cascade,
  numero     int not null,
  estado     estado_mesa not null default 'pendiente',
  created_at timestamptz not null default now(),
  unique(evento_id, numero)
);
alter table public.mesas enable row level security;

-- ─── INVITADOS ────────────────────────────────────────────────────────────────
create table public.invitados (
  id                     uuid primary key default gen_random_uuid(),
  usuario_id             uuid not null references public.usuarios(id),
  evento_id              uuid not null references public.eventos(id) on delete cascade,
  mesa_id                uuid references public.mesas(id),
  asistencia             estado_asistencia not null default 'pendiente',
  restriccion_alimentaria text,
  restriccion_otro       text,
  cancion                text,
  rol_smartpool          rol_smartpool,
  qr_token               text,
  qr_expires_at          timestamptz,
  created_at             timestamptz not null default now(),
  unique(usuario_id, evento_id)
);
alter table public.invitados enable row level security;

-- ─── REUNIONES ────────────────────────────────────────────────────────────────
create table public.reuniones (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  fecha       date not null,
  hora        text not null,
  notas       text,
  creado_por  uuid not null references public.usuarios(id),
  created_at  timestamptz not null default now()
);
alter table public.reuniones enable row level security;

-- ─── CANCIONES ────────────────────────────────────────────────────────────────
create table public.canciones (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos(id) on delete cascade,
  titulo      text not null,
  artista     text not null,
  pedido_por  uuid references public.usuarios(id),
  created_at  timestamptz not null default now()
);
alter table public.canciones enable row level security;

-- =============================================
-- RLS POLICIES (básicas para empezar)
-- =============================================

-- usuarios: cada uno lee su propio perfil; admins leen todo
create policy "usuarios: leer propio perfil"
  on public.usuarios for select
  using (auth.uid() = id);

create policy "usuarios: admin lee todos"
  on public.usuarios for select
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.tipo = 'administrador'
    )
  );

create policy "usuarios: admin crea/edita/borra"
  on public.usuarios for all
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid() and u.tipo = 'administrador'
    )
  );

-- eventos: admins y anfitriones gestionan; invitados leen los suyos
create policy "eventos: admin y anfitrion gestionan"
  on public.eventos for all
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.tipo in ('administrador', 'anfitrion')
    )
  );

create policy "eventos: invitado lee su evento"
  on public.eventos for select
  using (
    exists (
      select 1 from public.invitados i
      where i.usuario_id = auth.uid() and i.evento_id = eventos.id
    )
  );

-- mesas: admin/cocina/seguridad pueden leer y actualizar
create policy "mesas: roles autorizados"
  on public.mesas for all
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.tipo in ('administrador', 'anfitrion', 'jefe_cocina', 'seguridad')
    )
  );

-- invitados: admin/anfitrion gestionan; invitado lee/edita el suyo
create policy "invitados: admin y anfitrion gestionan"
  on public.invitados for all
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.tipo in ('administrador', 'anfitrion')
    )
  );

create policy "invitados: invitado lee y edita el suyo"
  on public.invitados for all
  using (usuario_id = auth.uid());

-- reuniones, canciones: admin/anfitrion
create policy "reuniones: admin y anfitrion"
  on public.reuniones for all
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.tipo in ('administrador', 'anfitrion')
    )
  );

create policy "canciones: admin y anfitrion"
  on public.canciones for all
  using (
    exists (
      select 1 from public.usuarios u
      where u.id = auth.uid()
        and u.tipo in ('administrador', 'anfitrion')
    )
  );

-- Invitados pueden ver/agregar canciones de su evento
create policy "canciones: invitado de ese evento"
  on public.canciones for select
  using (
    exists (
      select 1 from public.invitados i
      where i.usuario_id = auth.uid() and i.evento_id = canciones.evento_id
    )
  );

-- =============================================
-- FUNCIÓN: auto-crear perfil al registrarse
-- =============================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuarios (id, email, nombre, apellido, dni, tipo)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    coalesce(new.raw_user_meta_data->>'dni', ''),
    coalesce((new.raw_user_meta_data->>'tipo')::tipo_usuario, 'invitado')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- SmartPool: pareja + aceptación (migrations/006_smartpool_pareja.sql)
alter table public.invitados
  add column if not exists smartpool_pareja_invitado_id uuid references public.invitados (id) on delete set null;

alter table public.invitados
  add column if not exists smartpool_acepto boolean not null default false;

create index if not exists invitados_smartpool_busqueda_idx
  on public.invitados (evento_id, rol_smartpool)
  where
    smartpool_pareja_invitado_id is null
    and rol_smartpool in ('conductor', 'pasajero');

-- SmartPool: coordenadas opcionales (migrations/007_smartpool_coords.sql)
alter table public.invitados
  add column if not exists smartpool_lat double precision,
  add column if not exists smartpool_lng double precision;

-- SmartPool: cupos por conductor (migrations/009_smartpool_cupos_max.sql)
alter table public.invitados
  add column if not exists smartpool_cupos_max smallint not null default 4;

alter table public.invitados
  drop constraint if exists invitados_smartpool_cupos_max_check;

alter table public.invitados
  add constraint invitados_smartpool_cupos_max_check
  check (smartpool_cupos_max >= 0 and smartpool_cupos_max <= 8);

-- Grupos familiares (migrations/010 + 011: default 1 persona por invitación)
alter table public.invitados
  add column if not exists grupo_cupos_max int not null default 1;

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
