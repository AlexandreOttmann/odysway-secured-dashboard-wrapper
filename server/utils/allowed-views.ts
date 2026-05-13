// Add new views here AND create the corresponding view in Supabase (see supabase/migrations/).
// A view not listed here is not queryable, regardless of what exists in the DB.
export const ALLOWED_VIEWS = new Set(['reservations_summary', 'test_entries'])
