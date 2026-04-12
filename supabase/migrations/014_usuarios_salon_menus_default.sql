-- Valores por defecto de menús del salón (administrador): se copian al crear eventos
alter table public.usuarios
  add column if not exists salon_menus_especiales text[] not null default '{}',
  add column if not exists salon_menus_especiales_otro text,
  add column if not exists salon_menu_standard text;

comment on column public.usuarios.salon_menus_especiales is 'Tipos de menú especial que el salón ofrece (checkboxes al registro; default en nuevos eventos)';
comment on column public.usuarios.salon_menus_especiales_otro is 'Texto si incluyen la opción Otro en especiales del salón';
comment on column public.usuarios.salon_menu_standard is 'Descripción de qué incluye el menú estándar del salón (default en nuevos eventos)';

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
    habilitacion_numero,
    salon_menus_especiales,
    salon_menus_especiales_otro,
    salon_menu_standard
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
    nullif(trim(coalesce(new.raw_user_meta_data->>'habilitacion_numero', '')), ''),
    '{}'::text[],
    null,
    null
  );
  return new;
end;
$$;
