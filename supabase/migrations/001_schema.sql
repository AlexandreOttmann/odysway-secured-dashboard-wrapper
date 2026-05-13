-- Creates the dashboard schema and the initial views.
-- Run this against the SECONDARY Supabase project only — never against production.
--
-- Views deliberately expose only aggregated, non-PII fields.
-- No base tables live in this schema.

CREATE SCHEMA IF NOT EXISTS dashboard;

-- reservations_summary
-- Counts per status/destination/month. No names, emails, or payment references.
CREATE OR REPLACE VIEW dashboard.reservations_summary AS
SELECT
    status,
    destination,
    DATE_TRUNC('month', created_at)::date AS month,
    COUNT(*)                              AS count
FROM public.reservations
GROUP BY
    status,
    destination,
    DATE_TRUNC('month', created_at)::date;
