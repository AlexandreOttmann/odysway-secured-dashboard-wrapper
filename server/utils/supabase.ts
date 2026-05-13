import { createClient } from '@supabase/supabase-js'

export function useSupabaseClient() {
  const { supabaseUrl, supabaseDashboardKey } = useRuntimeConfig()
  return createClient(supabaseUrl as string, supabaseDashboardKey as string, {
    auth: { persistSession: false },
  })
}

export function useAuditClient() {
  const { supabaseUrl, supabaseAuditKey } = useRuntimeConfig()
  return createClient(supabaseUrl as string, supabaseAuditKey as string, {
    auth: { persistSession: false },
  })
}

export function useUploaderClient() {
  const { supabaseUrl, supabaseUploaderKey } = useRuntimeConfig()
  return createClient(supabaseUrl as string, supabaseUploaderKey as string, {
    auth: { persistSession: false },
  })
}
