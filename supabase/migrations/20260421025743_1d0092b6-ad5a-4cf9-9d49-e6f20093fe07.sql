
-- Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin');

-- user_roles table (separate from any profile table)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Only admins can manage roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- LINES table
CREATE TABLE public.lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number INTEGER NOT NULL UNIQUE CHECK (number >= 1 AND number <= 9999),
  name TEXT NOT NULL DEFAULT '',
  description TEXT,
  fare NUMERIC(6,2),
  consortium TEXT,
  delegatary TEXT,
  validity_date DATE,
  cover_image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER lines_updated_at BEFORE UPDATE ON public.lines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view published lines"
  ON public.lines FOR SELECT
  USING (published = true);

CREATE POLICY "Admins can view all lines"
  ON public.lines FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert lines"
  ON public.lines FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update lines"
  ON public.lines FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete lines"
  ON public.lines FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- WAYPOINTS
CREATE TABLE public.waypoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  instruction TEXT NOT NULL DEFAULT '',
  maneuver_type TEXT NOT NULL DEFAULT 'straight',
  suggested_gear TEXT,
  max_speed INTEGER,
  observation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX waypoints_line_id_idx ON public.waypoints(line_id, position);
ALTER TABLE public.waypoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view waypoints of published lines"
  ON public.waypoints FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lines l WHERE l.id = line_id AND l.published = true));

CREATE POLICY "Admins can view all waypoints"
  ON public.waypoints FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage waypoints"
  ON public.waypoints FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- MEDIA
CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('image','video')),
  url TEXT NOT NULL,
  caption TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX media_line_id_idx ON public.media(line_id, position);
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view media of published lines"
  ON public.media FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lines l WHERE l.id = line_id AND l.published = true));

CREATE POLICY "Admins can view all media"
  ON public.media FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage media"
  ON public.media FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID REFERENCES public.lines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'info' CHECK (priority IN ('info','warning','critical')),
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_line_id_idx ON public.notifications(line_id);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active notifications"
  ON public.notifications FOR SELECT
  USING (
    active = true AND
    (line_id IS NULL OR EXISTS (SELECT 1 FROM public.lines l WHERE l.id = line_id AND l.published = true))
  );

CREATE POLICY "Admins can view all notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage notifications"
  ON public.notifications FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SCHEDULES
CREATE TABLE public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_id UUID NOT NULL REFERENCES public.lines(id) ON DELETE CASCADE,
  day_type TEXT NOT NULL CHECK (day_type IN ('util','sabado','ferias','atipico')),
  departures JSONB NOT NULL DEFAULT '[]'::jsonb,
  fleet_per_hour JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (line_id, day_type)
);

CREATE INDEX schedules_line_id_idx ON public.schedules(line_id);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view schedules of published lines"
  ON public.schedules FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.lines l WHERE l.id = line_id AND l.published = true));

CREATE POLICY "Admins can view all schedules"
  ON public.schedules FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage schedules"
  ON public.schedules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- STORAGE bucket for media
INSERT INTO storage.buckets (id, name, public)
VALUES ('line-media', 'line-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read line-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'line-media');

CREATE POLICY "Admins can upload line-media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'line-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update line-media"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'line-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete line-media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'line-media' AND public.has_role(auth.uid(), 'admin'));
