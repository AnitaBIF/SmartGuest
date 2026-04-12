-- Eventos que nunca configuraron menús especiales: mismo catálogo que antes (todas las opciones).
-- Los nuevos eventos guardan solo lo que el admin marca en el formulario.
UPDATE eventos
SET menus_especiales = ARRAY[
  'Vegano/Vegetariano',
  'Sin TACC (celíaco)',
  'Sin lactosa',
  'Halal',
  'Kosher',
  'Otro'
]::text[]
WHERE cardinality(menus_especiales) = 0;
