/**
 * Converte erros técnicos do Supabase/PostgreSQL em mensagens legíveis.
 * Evita expor códigos de constraint, nomes de tabela e jargão de banco ao usuário.
 */
export function dbErr(error: { code?: string; message?: string } | null | undefined, contexto = 'operação'): string {
  if (!error) return `Erro na ${contexto}. Tente novamente.`

  const code = error.code || ''
  const msg  = error.message || ''

  if (code === '23505' || msg.includes('duplicate key') || msg.includes('already exists'))
    return 'Este item já existe. Verifique os dados e tente novamente.'

  if (code === '23503' || msg.includes('foreign key') || msg.includes('violates foreign'))
    return 'Não é possível realizar esta operação pois o item está vinculado a outros dados.'

  if (code === '23502' || msg.includes('null value') || msg.includes('not-null'))
    return 'Preencha todos os campos obrigatórios.'

  if (code === '23514' || msg.includes('check constraint') || msg.includes('violates check'))
    return 'Os valores informados estão fora do intervalo permitido.'

  if (code === '22P02' || msg.includes('invalid input syntax') || msg.includes('invalid value'))
    return 'Formato inválido. Verifique os dados informados.'

  if (code === '22003' || msg.includes('out of range'))
    return 'Valor fora do limite permitido.'

  if (msg.includes('JWT') || msg.includes('token') || msg.includes('unauthorized'))
    return 'Sessão expirada. Faça login novamente.'

  if (msg.includes('timeout') || msg.includes('connection'))
    return 'Serviço temporariamente indisponível. Tente novamente em instantes.'

  // Fallback genérico — nunca expõe a mensagem técnica original
  return `Erro ao ${contexto}. Tente novamente.`
}
