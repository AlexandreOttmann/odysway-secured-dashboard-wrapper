import { z } from 'zod'
import { ALLOWED_VIEWS } from '../../utils/allowed-views'
import { useSupabaseClient } from '../../utils/supabase'
import { writeAuditLog } from '../../utils/audit'

const scalar = z.union([z.string(), z.number(), z.boolean()])

const operatorsSchema = z
  .object({
    eq: scalar.optional(),
    in: z.array(scalar).max(500).optional(),
    gte: scalar.optional(),
    gt: scalar.optional(),
    lte: scalar.optional(),
    lt: scalar.optional(),
    is: z.union([z.null(), z.literal(true), z.literal(false)]).optional(),
  })
  .strict()

// Legacy shape: { params: { col: scalar } } — kept working for existing dashboards.
const legacyParamsSchema = z.record(scalar).optional()

const bodySchema = z
  .object({
    select: z.array(z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/)).max(50).optional(),
    filters: z.record(operatorsSchema).optional(),
    order: z
      .object({
        column: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
        ascending: z.boolean().optional(),
      })
      .optional(),
    limit: z.number().int().positive().max(20_000).optional(),
    params: legacyParamsSchema,
  })
  .strict()

const MAX_ROWS = 20_000

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
  const parsed = bodySchema.safeParse(rawBody ?? {})
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Invalid request body' })
  }

  const { select, filters, order, limit, params } = parsed.data

  const supabase = useSupabaseClient()
  const columns = select && select.length > 0 ? select.join(',') : '*'
  let query = supabase.from(viewName).select(columns)

  // Legacy: { params: { col: val } } → eq filters
  if (params) {
    for (const [col, value] of Object.entries(params)) {
      query = query.eq(col, value as never)
    }
  }

  if (filters) {
    for (const [col, ops] of Object.entries(filters)) {
      if (ops.eq !== undefined) query = query.eq(col, ops.eq as never)
      if (ops.in !== undefined) query = query.in(col, ops.in as never[])
      if (ops.gte !== undefined) query = query.gte(col, ops.gte as never)
      if (ops.gt !== undefined) query = query.gt(col, ops.gt as never)
      if (ops.lte !== undefined) query = query.lte(col, ops.lte as never)
      if (ops.lt !== undefined) query = query.lt(col, ops.lt as never)
      if (ops.is !== undefined) query = query.is(col, ops.is as never)
    }
  }

  if (order) {
    query = query.order(order.column, { ascending: order.ascending ?? true })
  }

  const effectiveLimit = Math.min(limit ?? MAX_ROWS, MAX_ROWS)
  const { data, error } = await query.limit(effectiveLimit)

  if (error) {
    console.error('[query] Supabase error:', { viewName, error })
    throw createError({ statusCode: 500, message: 'Query failed' })
  }

  await writeAuditLog({
    userEmail,
    viewName,
    queryParams: { select, filters, order, limit, params },
    rowCount: data?.length ?? 0,
  })

  return data
})
