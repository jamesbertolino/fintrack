export type TipoMissao = 'diaria' | 'semanal'

export interface Missao {
  id: string
  tipo: TipoMissao
  titulo: string
  descricao: string
  icone: string
  xp: number
  meta: number
}

export const MISSOES_DIARIAS: Missao[] = [
  {
    id: 'dia_lancamento_3',
    tipo: 'diaria',
    titulo: 'Registrador do Reino',
    descricao: 'Lance 3 transações hoje',
    icone: '📝',
    xp: 30,
    meta: 3,
  },
  {
    id: 'dia_abrir_app',
    tipo: 'diaria',
    titulo: 'Vigia da Coroa',
    descricao: 'Acesse o dashboard hoje',
    icone: '🏰',
    xp: 10,
    meta: 1,
  },
  {
    id: 'dia_lancamento_1',
    tipo: 'diaria',
    titulo: 'Primeiro Registro',
    descricao: 'Lance ao menos 1 transação hoje',
    icone: '🪙',
    xp: 15,
    meta: 1,
  },
]

export const MISSOES_SEMANAIS: Missao[] = [
  {
    id: 'sem_lancamento_diario',
    tipo: 'semanal',
    titulo: 'Leal ao Livro-Caixa',
    descricao: 'Lance ao menos 1 transação por dia durante a semana',
    icone: '📖',
    xp: 150,
    meta: 7,
  },
  {
    id: 'sem_upload',
    tipo: 'semanal',
    titulo: 'Escriba do Tesouro',
    descricao: 'Faça upload de um extrato bancário esta semana',
    icone: '📄',
    xp: 75,
    meta: 1,
  },
  {
    id: 'sem_10_lancamentos',
    tipo: 'semanal',
    titulo: 'Mão Firme',
    descricao: 'Registre 10 transações nesta semana',
    icone: '⚔️',
    xp: 100,
    meta: 10,
  },
  {
    id: 'sem_meta_progresso',
    tipo: 'semanal',
    titulo: 'Guardião das Metas',
    descricao: 'Tenha ao menos uma meta ativa esta semana',
    icone: '🎯',
    xp: 50,
    meta: 1,
  },
]

export const TODAS_MISSOES = [...MISSOES_DIARIAS, ...MISSOES_SEMANAIS]

export function getMissao(id: string): Missao | undefined {
  return TODAS_MISSOES.find(m => m.id === id)
}

// Retorna o início do dia atual em UTC
export function inicioDia(date = new Date()): string {
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

// Retorna o início da semana (segunda-feira) em UTC
export function inicioSemana(date = new Date()): string {
  const d = new Date(date)
  const dia = d.getUTCDay() // 0=dom, 1=seg...
  const diff = (dia === 0 ? -6 : 1 - dia)
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}
