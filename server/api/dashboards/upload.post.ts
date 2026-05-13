import { z } from 'zod'
import { lintHtml } from '../../utils/lint-html'
import { useUploaderClient } from '../../utils/supabase'

const MAX_HTML_BYTES = 512 * 1024 // 512 KB

const bodySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'slug must be lowercase letters, numbers, and hyphens only'),
  title: z.string().min(1).max(200),
  description: z.string().max(500).default(''),
  live: z.boolean().default(false),
  html: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  const userEmail = session?.user?.email as string

  const rawBody = await readBody(event)
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: parsed.error.issues[0]?.message ?? 'Invalid request body' })
  }

  const { slug, title, description, live, html } = parsed.data

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

  const supabase = useUploaderClient()
  const { error } = await supabase
    .from('uploaded_dashboards')
    .upsert(
      { slug, title, description, live, html_content: html, created_by: userEmail },
      { onConflict: 'slug' },
    )

  if (error) {
    console.error('[upload] Supabase error:', error)
    throw createError({ statusCode: 500, message: 'Failed to save dashboard' })
  }

  return { slug }
})
