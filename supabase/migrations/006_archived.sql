ALTER TABLE public.uploaded_dashboards
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_uploaded_dashboards_archived
  ON public.uploaded_dashboards (archived);
