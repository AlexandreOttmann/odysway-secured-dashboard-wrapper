import { useSupabaseClient } from '../../../utils/supabase'

const DASHBOARD_CSP =
  "default-src 'none'; " +
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; " +
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; " +
  "img-src 'self' data: https:; " +
  "connect-src 'self'; " +
  'frame-ancestors http://localhost:3000 https://odysway-secured-dashboard-wrapper.vercel.app;'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')

  const supabase = useSupabaseClient()
  const { data, error } = await supabase
    .from('uploaded_dashboards')
    .select('html_content')
    .eq('slug', slug)
    .single()

  if (error || !data) {
    throw createError({ statusCode: 404, message: 'Dashboard not found' })
  }

  setResponseHeaders(event, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': DASHBOARD_CSP,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })

  return data.html_content
})
