-- Datos del salón / administrador (registro público de salón)
alter table public.usuarios
  add column if not exists salon_nombre text,
  add column if not exists salon_direccion text,
  add column if not exists cuit text,
  add column if not exists habilitacion_numero text;

comment on column public.usuarios.salon_nombre is 'Nombre comercial del salón (administrador del local)';
comment on column public.usuarios.salon_direccion is 'Dirección física del local';
comment on column public.usuarios.cuit is 'CUIT persona física o jurídica del titular';
comment on column public.usuarios.habilitacion_numero is 'Número de habilitación municipal / Bromatología u organismo local';

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.usuarios (
    id,
    email,
    nombre,
    apellido,
    dni,
    tipo,
    salon_nombre,
    salon_direccion,
    cuit,
    habilitacion_numero
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    coalesce(new.raw_user_meta_data->>'dni', ''),
    coalesce((new.raw_user_meta_data->>'tipo')::tipo_usuario, 'invitado'),
    nullif(trim(coalesce(new.raw_user_meta_data->>'salon_nombre', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'salon_direccion', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'cuit', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'habilitacion_numero', '')), '')
  );
  return new;
end;
$$;
