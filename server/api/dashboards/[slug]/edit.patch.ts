import { z } from 'zod'
import { lintHtml } from '../../../utils/lint-html'
import { useUploaderClient } from '../../../utils/supabase'

const MAX_HTML_BYTES = 512 * 1024

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).default(''),
  live: z.boolean().default(false),
  html: z.string().optional(),
})

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') as string

  const rawBody = await readBody(event)
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? 'Invalid request body' })
  }

  const { title, description, live, html } = parsed.data

  const update: Record<string, unknown> = { title, description, live }

  if (html !== undefined) {
    if (Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) {
      throw createError({ statusCode: 400, message: 'HTML file exceeds 512 KB limit' })
    }
    const violations = lintHtml(html)
    if (violations.length > 0) {
      throw createError({
        statusCode: 422,
        message: 'Dashboard failed security lint',
        data: { violations },
      })
    }
    update.html_content = html
  }

  const supabase = useUploaderClient()
  const { error } = await supabase
    .from('uploaded_dashboards')
    .update(update)
    .eq('slug', slug)

  if (error) {
    console.error('[edit] Supabase error:', error)
    throw createError({ statusCode: 500, message: 'Failed to update dashboard' })
  }

  return { slug }
})
