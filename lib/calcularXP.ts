export interface DadosXP {
  transacoes: { valor: number; tipo: string }[]
  metas: { valor_total: number; valor_atual: number; ativo?: boolean }[]
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
  const xpMetas      = dados.metas.filter(m => m.ativo === true).length * 50
  const xpMetasConcl = dados.metas.filter(m => m.valor_atual >= m.valor_total).length * 200
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const xpConquistas = (dados.conquistas || 0) * 0 // já contado separado

  const xpTotal = xpTransacoes + xpSaldo + xpMetas + xpMetasConcl

  return { xpTotal, xpTransacoes, xpSaldo, xpMetas: xpMetas + xpMetasConcl, saldo, receitas, despesas }
}

export const XP_POR_NIVEL = 1000

export const NIVEIS = [
  { nivel: 1, nome: 'Camponês',    titulo: 'O início da jornada',         cor: '#6b7280', min: 0     },
  { nivel: 2, nome: 'Escudeiro',   titulo: 'Guardando os primeiros ouros', cor: '#4ade80', min: 500   },
  { nivel: 3, nome: 'Cavaleiro',   titulo: 'Mestre de sua própria bolsa',  cor: '#22d3ee', min: 1500  },
  { nivel: 4, nome: 'Barão',       titulo: 'Senhor de suas finanças',      cor: '#60a5fa', min: 3500  },
  { nivel: 5, nome: 'Nobre',       titulo: 'A corte reconhece seu valor',  cor: '#a78bfa', min: 7000  },
  { nivel: 6, nome: 'Conde',       titulo: 'Domínio sobre o tesouro',      cor: '#f97316', min: 13000 },
  { nivel: 7, nome: 'Duque',       titulo: 'Um império financeiro cresce', cor: '#d4a017', min: 22000 },
  { nivel: 8, nome: 'Rei',         titulo: 'O reino é seu — e próspero',   cor: '#f43f5e', min: 35000 },
]

export function calcularNivel(xp: number) {
  const nivelAtual    = [...NIVEIS].reverse().find(n => xp >= n.min) || NIVEIS[0]
  const proximoNivel  = NIVEIS[NIVEIS.indexOf(nivelAtual) + 1]
  const xpNoNivel     = xp - nivelAtual.min
  const xpParaProximo = proximoNivel ? proximoNivel.min - nivelAtual.min : XP_POR_NIVEL
  const pct           = Math.min(Math.round((xpNoNivel / xpParaProximo) * 100), 100)

  return { ...nivelAtual, proximoNivel, xpNoNivel, xpParaProximo, pct, xpTotal: xp }
}
