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
    offset: z.number().int().min(0).optional(),
    // When true, returns { rows, total } instead of plain array (backwards compat)
    count: z.boolean().optional(),
    params: legacyParamsSchema,
  })
  .strict()

// PostgREST hard cap per request; server fans out transparently when limit > this.
const SUPABASE_PAGE = 1_000
const MAX_LIMIT = 20_000

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFiltersAndParams(q: any, filters: any, params: any): any {
  if (params) {
    for (const [col, value] of Object.entries(params)) {
      q = q.eq(col, value)
    }
  }
  if (filters) {
    for (const [col, ops] of Object.entries(filters as Record<string, Record<string, unknown>>)) {
      if (ops.eq !== undefined) q = q.eq(col, ops.eq)
      if (ops.in !== undefined) q = q.in(col, ops.in)
      if (ops.gte !== undefined) q = q.gte(col, ops.gte)
      if (ops.gt !== undefined) q = q.gt(col, ops.gt)
      if (ops.lte !== undefined) q = q.lte(col, ops.lte)
      if (ops.lt !== undefined) q = q.lt(col, ops.lt)
      if (ops.is !== undefined) q = q.is(col, ops.is)
    }
  }
  return q
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

  const { select, filters, order, limit, offset, count: wantCount, params } = parsed.data

  const supabase = useSupabaseClient()
  const columns = select && select.length > 0 ? select.join(',') : '*'
  const startOffset = offset ?? 0
  const totalWanted = Math.min(limit ?? MAX_LIMIT, MAX_LIMIT)

  // Helper: build a query with filters + order applied, no pagination yet.
  function base(withCount = false): any {
    const opts = withCount ? { count: 'exact' as const } : undefined
    let q: any = supabase.from(viewName!).select(columns, opts)
    q = applyFiltersAndParams(q, filters, params)
    if (order) q = q.order(order.column, { ascending: order.ascending ?? true })
    return q
  }

  let allRows: unknown[]
  let dbTotal: number | null = null

  if (totalWanted <= SUPABASE_PAGE) {
    // Single Supabase call
    const { data, count: c, error } = await base(wantCount)
      .range(startOffset, startOffset + totalWanted - 1)
    if (error) {
      console.error('[query] Supabase error:', { viewName, error })
      throw createError({ statusCode: 500, message: 'Query failed' })
    }
    allRows = data ?? []
    dbTotal = c ?? null
  } else {
    // Fan out: first page + count, then remaining pages in parallel.
    const { data: first, count: total, error: e0 } = await base(true)
      .range(startOffset, startOffset + SUPABASE_PAGE - 1)
    if (e0) {
      console.error('[query] Supabase error:', { viewName, error: e0 })
      throw createError({ statusCode: 500, message: 'Query failed' })
    }

    dbTotal = total ?? 0
    allRows = first ?? []

    const fetchUpTo = Math.min(totalWanted, (dbTotal ?? 0) - startOffset)
    const pagesLeft = Math.ceil((fetchUpTo - allRows.length) / SUPABASE_PAGE)

    if (pagesLeft > 0) {
      const pageResults = await Promise.all(
        Array.from({ length: pagesLeft }, (_, i) => {
          const pOff = startOffset + SUPABASE_PAGE * (i + 1)
          const pEnd = Math.min(pOff + SUPABASE_PAGE - 1, startOffset + fetchUpTo - 1)
          return base().range(pOff, pEnd).then(({ data, error }: { data: unknown[]; error: unknown }) => {
            if (error) throw error
            return data ?? []
          })
        }),
      )
      allRows = allRows.concat(...pageResults)
    }
  }

  await writeAuditLog({
    userEmail,
    viewName,
    queryParams: { select, filters, order, limit, offset, params },
    rowCount: allRows.length,
  })

  if (wantCount) {
    return { rows: allRows, total: dbTotal ?? allRows.length }
  }
  return allRows
})
