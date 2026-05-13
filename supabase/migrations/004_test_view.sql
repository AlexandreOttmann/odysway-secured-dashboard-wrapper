-- Temporary view over the test table — replace with real tables once sync is wired up.
CREATE OR REPLACE VIEW public.test_entries AS
SELECT
    id,
    created_at
FROM public.test;
