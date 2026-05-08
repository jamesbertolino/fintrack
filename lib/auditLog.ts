import { createClient } from '@supabase/supabase-js'

type AuditAction =
  | 'transaction.create'
  | 'transaction.update'
  | 'transaction.delete'
  | 'profile.update'

interface AuditEntry {
  user_id: string
  action: AuditAction
  resource_id?: string
  metadata?: Record<string, unknown>
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await getServiceClient().from('audit_log').insert({
      user_id:     entry.user_id,
      action:      entry.action,
      resource_id: entry.resource_id ?? null,
      metadata:    entry.metadata ?? null,
    })
  } catch {
    // audit failure must never break the main flow
  }
}
