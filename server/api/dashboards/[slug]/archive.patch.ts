import { useUploaderClient } from '../../../utils/supabase'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const slug = getRouterParam(event, 'slug') as string

  const supabase = useUploaderClient()
  const { data, error } = await supabase
    .from('uploaded_dashboards')
    .update({ archived: true })
    .eq('slug', slug)
    .select('slug')
    .single()

  if (error || !data) {
    throw createError({ statusCode: 404, message: 'Dashboard not found' })
  }

  return { ok: true }
})
