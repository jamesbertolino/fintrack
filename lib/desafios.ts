export type TipoDesafio = 'limite_categoria' | 'economia' | 'habito' | 'sem_categoria' | 'familia_poupanca'
export type Dificuldade = 'facil' | 'medio' | 'dificil' | 'lendario'

export interface Desafio {
  id: string
  titulo: string
  descricao: string
  tipo: TipoDesafio
  categoria?: string   // categoria alvo (limite_categoria / sem_categoria)
  valor_meta: number   // R$ (economia/limite) ou dias (habito)
  duracao_dias: number
  xp: number
  dificuldade: Dificuldade
  icone: string
}

export const CATALOGO_DESAFIOS: Desafio[] = [
  {
    id: 'sem_lazer_7d',
    titulo: 'Semana Sem Frescura',
    descricao: 'Passe 7 dias sem nenhum gasto em Lazer. Entretenimento gratuito existe!',
    tipo: 'sem_categoria',
    categoria: 'Lazer',
    valor_meta: 0,
    duracao_dias: 7,
    xp: 150,
    dificuldade: 'facil',
    icone: '🎭',
  },
  {
    id: 'alimentacao_300_15d',
    titulo: 'Comedido no Garfo',
    descricao: 'Gaste no máximo R$300 em Alimentação nos próximos 15 dias.',
    tipo: 'limite_categoria',
    categoria: 'Alimentação',
    valor_meta: 300,
    duracao_dias: 15,
    xp: 250,
    dificuldade: 'medio',
    icone: '🍽️',
  },
  {
    id: 'economize_500_30d',
    titulo: 'Mês do Tesouro',
    descricao: 'Economize pelo menos R$500 em 30 dias (receitas - despesas ≥ 500).',
    tipo: 'economia',
    valor_meta: 500,
    duracao_dias: 30,
    xp: 500,
    dificuldade: 'dificil',
    icone: '💰',
  },
  {
    id: 'registro_7d',
    titulo: 'Registro Fiel',
    descricao: 'Lance pelo menos 1 transação por dia durante 7 dias seguidos.',
    tipo: 'habito',
    valor_meta: 7,
    duracao_dias: 7,
    xp: 200,
    dificuldade: 'facil',
    icone: '📝',
  },
  {
    id: 'transporte_100_7d',
    titulo: 'Transporte Consciente',
    descricao: 'Limite seus gastos com Transporte a R$100 nos próximos 7 dias.',
    tipo: 'limite_categoria',
    categoria: 'Transporte',
    valor_meta: 100,
    duracao_dias: 7,
    xp: 150,
    dificuldade: 'facil',
    icone: '🚌',
  },
  {
    id: 'sem_restaurante_14d',
    titulo: 'Cozinheiro do Reino',
    descricao: 'Nenhum gasto com Alimentação fora de casa por 14 dias. Cozinhe em casa!',
    tipo: 'sem_categoria',
    categoria: 'Alimentação',
    valor_meta: 0,
    duracao_dias: 14,
    xp: 350,
    dificuldade: 'medio',
    icone: '👨‍🍳',
  },
  {
    id: 'registro_28d',
    titulo: 'Disciplina de Ferro',
    descricao: 'Lance transações todos os dias por 28 dias consecutivos. A consistência é poder.',
    tipo: 'habito',
    valor_meta: 28,
    duracao_dias: 28,
    xp: 600,
    dificuldade: 'dificil',
    icone: '⚔️',
  },
  {
    id: 'economize_1000_30d',
    titulo: 'Poupador Lendário',
    descricao: 'O desafio máximo: economize R$1.000 em 30 dias. Para os verdadeiros Reis.',
    tipo: 'economia',
    valor_meta: 1000,
    duracao_dias: 30,
    xp: 800,
    dificuldade: 'lendario',
    icone: '👑',
  },
  {
    id: 'saude_200_30d',
    titulo: 'Corpo e Bolso Saudáveis',
    descricao: 'Invista até R$200 em Saúde em 30 dias — cuide de você sem exagerar.',
    tipo: 'limite_categoria',
    categoria: 'Saúde',
    valor_meta: 200,
    duracao_dias: 30,
    xp: 300,
    dificuldade: 'medio',
    icone: '🏥',
  },
  {
    id: 'sem_lazer_30d',
    titulo: 'O Grande Jejum',
    descricao: '30 dias sem Lazer. Silêncio, foco e crescimento. Poucos chegam até o fim.',
    tipo: 'sem_categoria',
    categoria: 'Lazer',
    valor_meta: 0,
    duracao_dias: 30,
    xp: 800,
    dificuldade: 'lendario',
    icone: '🧘',
  },
  // ── Desafios de família ────────────────────────────────────────────────────
  {
    id: 'familia_poupa_500_30d',
    titulo: 'Cofre da Família',
    descricao: 'Juntos, depositem R$500 nas metas compartilhadas em 30 dias. Cada centavo conta!',
    tipo: 'familia_poupanca',
    valor_meta: 500,
    duracao_dias: 30,
    xp: 600,
    dificuldade: 'medio',
    icone: '🏦',
  },
  {
    id: 'familia_poupa_1500_30d',
    titulo: 'Aliança dos Poupadores',
    descricao: 'A família une forças: R$1.500 depositados em metas compartilhadas em 30 dias.',
    tipo: 'familia_poupanca',
    valor_meta: 1500,
    duracao_dias: 30,
    xp: 1000,
    dificuldade: 'dificil',
    icone: '🤝',
  },
  {
    id: 'familia_poupa_5000_60d',
    titulo: 'Tesouro do Clã',
    descricao: 'O desafio lendário: R$5.000 somados por toda a família em 60 dias. Apenas os mais unidos chegam lá.',
    tipo: 'familia_poupanca',
    valor_meta: 5000,
    duracao_dias: 60,
    xp: 2000,
    dificuldade: 'lendario',
    icone: '👑',
  },
]

export function getDesafio(id: string): Desafio | undefined {
  return CATALOGO_DESAFIOS.find(d => d.id === id)
}

export const CORES_DIFICULDADE: Record<Dificuldade, { bg: string; text: string; border: string }> = {
  facil:    { bg: 'rgba(74,222,128,.12)',  text: '#4ade80', border: 'rgba(74,222,128,.3)' },
  medio:    { bg: 'rgba(251,191,36,.12)',  text: '#fbbf24', border: 'rgba(251,191,36,.3)' },
  dificil:  { bg: 'rgba(249,115,22,.12)',  text: '#f97316', border: 'rgba(249,115,22,.3)' },
  lendario: { bg: 'rgba(167,139,250,.12)', text: '#a78bfa', border: 'rgba(167,139,250,.3)' },
}

export const LABEL_DIFICULDADE: Record<Dificuldade, string> = {
  facil: 'Fácil', medio: 'Médio', dificil: 'Difícil', lendario: 'Lendário',
}
