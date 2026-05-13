import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useSupabaseClient } from '../../utils/supabase'

interface DashboardEntry {
  slug: string
  title: string
  description: string
  file?: string
  live: boolean
  created_by?: string
  created_at?: string
}

export default defineEventHandler(async (): Promise<DashboardEntry[]> => {
  const manifestPath = join(process.cwd(), 'public/dashboards/_manifest.json')
  let staticEntries: DashboardEntry[] = []
  try {
    staticEntries = JSON.parse(readFileSync(manifestPath, 'utf-8'))
  } catch {
    // manifest missing — proceed with DB entries only
  }

  const supabase = useSupabaseClient()
  const { data } = await supabase
    .from('uploaded_dashboards')
    .select('slug, title, description, live, created_by, created_at')
    .eq('archived', false)
    .order('created_at', { ascending: false })

  const uploadedEntries: DashboardEntry[] = (data ?? []).map((row) => ({
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string,
    live: row.live as boolean,
    created_by: row.created_by as string | undefined,
    created_at: row.created_at as string | undefined,
  }))

  return [...staticEntries, ...uploadedEntries]
})
