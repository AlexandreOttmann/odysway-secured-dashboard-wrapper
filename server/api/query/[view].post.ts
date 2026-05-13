import { z } from 'zod'
import { ALLOWED_VIEWS } from '../../utils/allowed-views'
import { useSupabaseClient } from '../../utils/supabase'
import { writeAuditLog } from '../../utils/audit'

// Only plain scalar values allowed as filter params — no nested objects or arrays
const paramsSchema = z
  .record(z.union([z.string(), z.number(), z.boolean()]))
  .optional()
  .default({})

const bodySchema = z.object({ params: paramsSchema })

// Per-user token bucket: 60 requests / 60s. In-memory; fine for single-instance.
const RATE_LIMIT = 60
const RATE_WINDOW_MS = 60_000
const buckets = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }
  if (b.count >= RATE_LIMIT) return false
  b.count++
  return true
}

export default defineEventHandler(async (event) => {
  // CSRF: reject cross-origin POSTs even with a valid session cookie
  const origin = getRequestHeader(event, 'origin')
  if (origin) {
    const requestHost = getRequestHost(event)
    try {
      if (new URL(origin).host !== requestHost) {
        throw createError({ statusCode: 403, message: 'Forbidden origin' })
      }
    } catch {
      throw createError({ statusCode: 403, message: 'Forbidden origin' })
    }
  }

  // Session is already verified by server middleware, but we read it here for audit logging
  const session = await getUserSession(event)
  const userEmail = session?.user?.email as string

  if (!checkRateLimit(userEmail)) {
    throw createError({ statusCode: 429, message: 'Too many requests' })
  }

  const viewName = getRouterParam(event, 'view')
  if (!viewName || !ALLOWED_VIEWS.has(viewName)) {
    console.warn('[query] rejected unknown view request:', { viewName, userEmail })
    throw createError({ statusCode: 400, message: `View "${viewName}" is not queryable` })
  }

  const rawBody = await readBody(event)
  const parsed = bodySchema.safeParse(rawBody)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request body' })
  }

  const params = parsed.data.params ?? {}

  const supabase = useSupabaseClient()
  let query = supabase.from(viewName).select('*')

  // Apply equality filters from validated params — never raw SQL
  for (const [key, value] of Object.entries(params)) {
    query = query.eq(key, value as string)
  }

  const { data, error } = await query.limit(10_000)

  if (error) {
    console.error('[query] Supabase error:', { viewName, error })
    throw createError({ statusCode: 500, message: 'Query failed' })
  }

  await writeAuditLog({
    userEmail,
    viewName,
    queryParams: params,
    rowCount: data?.length ?? 0,
  })

  return data
})
