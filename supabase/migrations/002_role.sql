-- Creates the dashboard_reader role (SELECT-only on dashboard schema)
-- and the audit_writer role (INSERT-only on public.audit_log).
--
-- Generate two separate API keys in the Supabase dashboard, one per role.
-- Store them as NUXT_SUPABASE_DASHBOARD_KEY and NUXT_SUPABASE_AUDIT_KEY in Vercel.

-- dashboard_reader: read-only access to all views in the dashboard schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dashboard_reader') THEN
    CREATE ROLE dashboard_reader NOLOGIN;
  END IF;
END
$$;

GRANT USAGE  ON SCHEMA dashboard                    TO dashboard_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA dashboard      TO dashboard_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA dashboard
  GRANT SELECT ON TABLES TO dashboard_reader;

-- Explicitly deny access to every other schema
REVOKE ALL ON SCHEMA public  FROM dashboard_reader;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM dashboard_reader;
REVOKE ALL ON ALL SEQUENCES  IN SCHEMA public FROM dashboard_reader;
REVOKE ALL ON ALL FUNCTIONS  IN SCHEMA public FROM dashboard_reader;


-- audit_writer: append-only to public.audit_log
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'audit_writer') THEN
    CREATE ROLE audit_writer NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO audit_writer;
-- Table-level grants on audit_log are in 003_audit.sql (table doesn't exist yet)
