import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useSupabaseClient } from '../../../utils/supabase'

interface DashboardMeta {
  slug: string
  title: string
  description: string
  live: boolean
  source: 'db' | 'static'
  file?: string
}

export default defineEventHandler(async (event): Promise<DashboardMeta> => {
  const slug = getRouterParam(event, 'slug') as string

  // 1. Check Supabase first
  const supabase = useSupabaseClient()
  const { data } = await supabase
    .from('uploaded_dashboards')
    .select('slug, title, description, live')
    .eq('slug', slug)
    .single()

  if (data) {
    return {
      slug: data.slug as string,
      title: data.title as string,
      description: data.description as string,
      live: data.live as boolean,
      source: 'db',
    }
  }

  // 2. Fall back to static manifest
  try {
    const manifest: (DashboardMeta & { file: string })[] = JSON.parse(
      readFileSync(join(process.cwd(), 'public/dashboards/_manifest.json'), 'utf-8'),
    )
    const entry = manifest.find((d) => d.slug === slug)
    if (entry) {
      return { ...entry, source: 'static' }
    }
  } catch {
    // manifest unreadable — fall through to 404
  }

  throw createError({ statusCode: 404, message: 'Dashboard not found' })
})
