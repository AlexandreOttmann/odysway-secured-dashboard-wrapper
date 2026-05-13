CREATE ROLE dashboard_uploader NOLOGIN;

CREATE TABLE public.uploaded_dashboards (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text        UNIQUE NOT NULL,
  title        text        NOT NULL,
  description  text        NOT NULL DEFAULT '',
  html_content text        NOT NULL,
  live         boolean     NOT NULL DEFAULT false,
  created_by   text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT                    ON public.uploaded_dashboards TO dashboard_reader;
GRANT INSERT, UPDATE, DELETE    ON public.uploaded_dashboards TO dashboard_uploader;
