
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Restrict listing on public bucket: drop broad SELECT and replace with admin-only listing
DROP POLICY IF EXISTS "Public can read line-media" ON storage.objects;

CREATE POLICY "Admins can list line-media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'line-media' AND public.has_role(auth.uid(), 'admin'));
-- Public reads of files happen via the public CDN URL; no SELECT policy needed for that.
