import { createClient } from '@supabase/supabase-js'

// Limites mensais de tokens por plano (total = prompt + completion)
export const LIMITES_TOKENS: Record<string, number> = {
  free:    50_000,
  pro:    300_000,
  familia:500_000,
}

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface LogIAParams {
  user_id:           string
  endpoint:          string
  provider:          'anthropic' | 'openai'
  modelo:            string
  prompt_tokens:     number
  completion_tokens: number
}

export async function logIAUsage(p: LogIAParams): Promise<void> {
  try {
    await getServiceClient().from('ia_usage_logs').insert({
      user_id:           p.user_id,
      endpoint:          p.endpoint,
      provider:          p.provider,
      modelo:            p.modelo,
      prompt_tokens:     p.prompt_tokens,
      completion_tokens: p.completion_tokens,
      total_tokens:      p.prompt_tokens + p.completion_tokens,
    })
  } catch {
    // nunca interrompe o fluxo principal
  }
}

// Retorna tokens consumidos no mês corrente pelo usuário
export async function tokensUsadosMes(user_id: string): Promise<number> {
  const inicio = new Date()
  inicio.setDate(1)
  inicio.setHours(0, 0, 0, 0)

  const { data } = await getServiceClient()
    .from('ia_usage_logs')
    .select('total_tokens')
    .eq('user_id', user_id)
    .gte('created_at', inicio.toISOString())

  return (data || []).reduce((s, r) => s + (r.total_tokens || 0), 0)
}

// Verifica se o usuário pode fazer mais chamadas de IA este mês
export async function verificarLimiteTokens(
  user_id: string,
  plano: string,
): Promise<{ permitido: boolean; usados: number; limite: number; restante: number }> {
  const limite  = LIMITES_TOKENS[plano] ?? LIMITES_TOKENS.free
  const usados  = await tokensUsadosMes(user_id)
  const restante = Math.max(0, limite - usados)
  return { permitido: usados < limite, usados, limite, restante }
}
