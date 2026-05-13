-- Audit log table in the secondary Supabase project.
-- Written by the Nuxt app via the audit_writer role.
-- Never expose this table to dashboard_reader.

CREATE TABLE IF NOT EXISTS public.audit_log (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email   TEXT        NOT NULL,
    view_name    TEXT        NOT NULL,
    query_params JSONB,
    row_count    INTEGER     NOT NULL,
    timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_user_email_idx ON public.audit_log (user_email);
CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx  ON public.audit_log (timestamp DESC);

-- Disable Row Level Security row-by-row (append-only via role grant is sufficient)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only the audit_writer service role may insert; no one may select/update/delete via API
CREATE POLICY audit_log_insert ON public.audit_log
    FOR INSERT TO audit_writer
    WITH CHECK (true);

-- Table-level grants moved here from 002_role.sql (table must exist first)
GRANT INSERT ON public.audit_log TO audit_writer;
REVOKE SELECT, UPDATE, DELETE ON public.audit_log FROM audit_writer;
