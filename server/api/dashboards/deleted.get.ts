import { useSupabaseClient } from '../../utils/supabase'

interface ArchivedDashboardEntry {
  slug: string
  title: string
  description: string
  live: boolean
  created_by?: string
  created_at?: string
}

export default defineEventHandler(async (event): Promise<ArchivedDashboardEntry[]> => {
  await requireUserSession(event)

  const supabase = useSupabaseClient()
  const { data } = await supabase
    .from('uploaded_dashboards')
    .select('slug, title, description, live, created_by, created_at')
    .eq('archived', true)
    .order('created_at', { ascending: false })

  return (data ?? []).map((row) => ({
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string,
    live: row.live as boolean,
    created_by: row.created_by as string | undefined,
    created_at: row.created_at as string | undefined,
  }))
})
