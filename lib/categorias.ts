export interface Categoria {
  nome:  string
  cor:   string
  icone: string
  tipo:  'debito' | 'credito' | 'ambos'
}

export const CATEGORIAS_PADRAO: Categoria[] = [
  { nome: 'Alimentação',   cor: '#4ade80', icone: '🍽️',  tipo: 'debito'  },
  { nome: 'Transporte',    cor: '#22d3ee', icone: '🚗',  tipo: 'debito'  },
  { nome: 'Lazer',         cor: '#f97316', icone: '🎮',  tipo: 'debito'  },
  { nome: 'Saúde',         cor: '#a78bfa', icone: '🏥',  tipo: 'debito'  },
  { nome: 'Moradia',       cor: '#fbbf24', icone: '🏠',  tipo: 'debito'  },
  { nome: 'Educação',      cor: '#60a5fa', icone: '📚',  tipo: 'debito'  },
  { nome: 'Vestuário',     cor: '#f472b6', icone: '👗',  tipo: 'debito'  },
  { nome: 'Assinatura',    cor: '#818cf8', icone: '📱',  tipo: 'debito'  },
  { nome: 'Salário',       cor: '#4ade80', icone: '💼',  tipo: 'credito' },
  { nome: 'Freelance',     cor: '#34d399', icone: '💻',  tipo: 'credito' },
  { nome: 'Investimento',  cor: '#818cf8', icone: '📈',  tipo: 'credito' },
  { nome: 'Presente',      cor: '#fb923c', icone: '🎁',  tipo: 'credito' },
  { nome: 'Outros',        cor: '#6b7280', icone: '📌',  tipo: 'ambos'   },
]

export const NOME_PARA_COR: Record<string, string> = Object.fromEntries(
  CATEGORIAS_PADRAO.map(c => [c.nome, c.cor])
)
export const NOME_PARA_ICONE: Record<string, string> = Object.fromEntries(
  CATEGORIAS_PADRAO.map(c => [c.nome, c.icone])
)

export const PALETA_CORES = [
  '#4ade80','#34d399','#22d3ee','#60a5fa','#818cf8',
  '#a78bfa','#f472b6','#fb923c','#fbbf24','#f87171',
  '#6b7280','#94a3b8','#e2e8f0','#16a34a','#0ea5e9',
]

export const EMOJIS_SUGERIDOS = [
  '🍽️','🚗','🎮','🏥','🏠','📚','👗','📱','💼','💻',
  '📈','🎁','📌','✈️','🎵','🏋️','🐶','⚡','🛒','💊',
  '🏦','💰','🎓','🍺','☕','🎯','🛠️','🌱','🎨','🏖️',
]
