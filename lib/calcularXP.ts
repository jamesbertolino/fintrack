export interface DadosXP {
  transacoes: { valor: number; tipo: string }[]
  metas: { valor_total: number; valor_atual: number; ativo: boolean }[]
  conquistas?: number
}

export function calcularXP(dados: DadosXP) {
  const receitas = dados.transacoes
    .filter(t => t.tipo === 'credito')
    .reduce((a, t) => a + t.valor, 0)

  const despesas = dados.transacoes
    .filter(t => t.tipo === 'debito')
    .reduce((a, t) => a + Math.abs(t.valor), 0)

  const saldo = receitas - despesas

  const xpTransacoes = dados.transacoes.length * 10
  const xpSaldo      = Math.max(0, Math.round(saldo / 10))
  const xpMetas      = dados.metas.filter(m => m.ativo).length * 50
  const xpMetasConcl = dados.metas.filter(m => m.valor_atual >= m.valor_total).length * 200
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const xpConquistas = (dados.conquistas || 0) * 0 // já contado separado

  const xpTotal = xpTransacoes + xpSaldo + xpMetas + xpMetasConcl

  return { xpTotal, xpTransacoes, xpSaldo, xpMetas: xpMetas + xpMetasConcl, saldo, receitas, despesas }
}

export const XP_POR_NIVEL = 1000

// Exportado para uso em componentes de UI que renderizam a jornada de níveis
export const NIVEIS = [
  { nivel: 1, nome: 'Iniciante',          cor: '#6b7280', min: 0    },
  { nivel: 2, nome: 'Poupador',           cor: '#4ade80', min: 1000 },
  { nivel: 3, nome: 'Controlado',         cor: '#22d3ee', min: 2000 },
  { nivel: 4, nome: 'Estrategista',       cor: '#60a5fa', min: 3000 },
  { nivel: 5, nome: 'Poupador Pro',       cor: '#a78bfa', min: 4000 },
  { nivel: 6, nome: 'Investidor',         cor: '#f97316', min: 5000 },
  { nivel: 7, nome: 'Mestre Financeiro',  cor: '#fbbf24', min: 6000 },
  { nivel: 8, nome: 'Guru das Finanças',  cor: '#f43f5e', min: 7000 },
]

export function calcularNivel(xp: number) {
  const nivelAtual    = [...NIVEIS].reverse().find(n => xp >= n.min) || NIVEIS[0]
  const proximoNivel  = NIVEIS[NIVEIS.indexOf(nivelAtual) + 1]
  const xpNoNivel     = xp - nivelAtual.min
  const xpParaProximo = proximoNivel ? proximoNivel.min - nivelAtual.min : XP_POR_NIVEL
  const pct           = Math.min(Math.round((xpNoNivel / xpParaProximo) * 100), 100)

  return { ...nivelAtual, proximoNivel, xpNoNivel, xpParaProximo, pct, xpTotal: xp }
}
