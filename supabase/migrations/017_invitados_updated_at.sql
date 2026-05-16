-- Actividad reciente del anfitrión: ordenar por último cambio (confirmación, rechazo, etc.),
-- no solo por created_at del alta/import.

ALTER TABLE public.invitados
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.invitados
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.invitados
  ALTER COLUMN updated_at SET DEFAULT now();

ALTER TABLE public.invitados
  ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.invitados_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invitados_touch_updated_at ON public.invitados;
CREATE TRIGGER invitados_touch_updated_at
  BEFORE UPDATE ON public.invitados
  FOR EACH ROW
  EXECUTE PROCEDURE public.invitados_touch_updated_at();
