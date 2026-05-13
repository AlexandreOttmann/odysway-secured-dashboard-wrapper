import { useAuditClient } from './supabase'

interface AuditEntry {
  userEmail: string
  viewName: string
  queryParams: Record<string, unknown>
  rowCount: number
}

export async function writeAuditLog(entry: AuditEntry) {
  const client = useAuditClient()
  const { error } = await client.from('audit_log').insert({
    user_email: entry.userEmail,
    view_name: entry.viewName,
    query_params: entry.queryParams,
    row_count: entry.rowCount,
    timestamp: new Date().toISOString(),
  })
  if (error) {
    console.error('[audit] write failed:', JSON.stringify(error))
  }
}
