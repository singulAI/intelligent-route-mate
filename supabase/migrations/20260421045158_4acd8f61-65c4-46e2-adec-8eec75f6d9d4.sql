-- Visibility flags per line (default true to keep current behavior)
ALTER TABLE public.lines
  ADD COLUMN IF NOT EXISTS show_name boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_number boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_fare boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_availability boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_consortium boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_delegatary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_validity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_map boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_waypoints boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_schedules boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_media boolean NOT NULL DEFAULT true;

-- Observations submitted by public users (drivers) about a line
CREATE TABLE IF NOT EXISTS public.observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id uuid REFERENCES public.lines(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observations_line_id ON public.observations(line_id);
CREATE INDEX IF NOT EXISTS idx_observations_read ON public.observations(read) WHERE read = false;

ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can submit an observation
CREATE POLICY "Anyone can submit observations"
  ON public.observations
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Only admins can read/update/delete
CREATE POLICY "Admins can view observations"
  ON public.observations
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update observations"
  ON public.observations
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete observations"
  ON public.observations
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));