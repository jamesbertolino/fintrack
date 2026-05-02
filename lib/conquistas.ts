export interface Conquista {
  id: string
  nome: string
  descricao: string
  icone: string
  xp: number
  categoria: 'inicio' | 'habito' | 'saldo' | 'metas' | 'grupo' | 'upload' | 'lendario'
}

export const CONQUISTAS: Conquista[] = [
  // ── Início ───────────────────────────────────────────────────────────────────
  {
    id: 'welcome',
    nome: 'Juramento do Escudeiro',
    descricao: 'Criou sua conta e começou a jornada',
    icone: '⚔️',
    xp: 50,
    categoria: 'inicio',
  },
  {
    id: 'first_tx',
    nome: 'Primeiro Moedeiro',
    descricao: 'Registrou a primeira transação no reino',
    icone: '🪙',
    xp: 20,
    categoria: 'inicio',
  },
  {
    id: 'profile_complete',
    nome: 'Identidade do Reino',
    descricao: 'Completou todas as informações do perfil',
    icone: '📜',
    xp: 100,
    categoria: 'inicio',
  },

  // ── Hábito ───────────────────────────────────────────────────────────────────
  {
    id: 'streak_7',
    nome: 'Guardião da Chama',
    descricao: 'Usou o app por 7 dias consecutivos',
    icone: '🔥',
    xp: 100,
    categoria: 'habito',
  },
  {
    id: 'streak_30',
    nome: 'Vigia Eterno',
    descricao: 'Manteve a chama acesa por 30 dias seguidos',
    icone: '🕯️',
    xp: 500,
    categoria: 'habito',
  },
  {
    id: 'tx_50',
    nome: 'Mão de Ferro',
    descricao: 'Registrou 50 transações no livro-caixa real',
    icone: '📖',
    xp: 250,
    categoria: 'habito',
  },
  {
    id: 'tx_100',
    nome: 'Lenda do Tesouro',
    descricao: 'Cem transações catalogadas no grande livro',
    icone: '🏛️',
    xp: 500,
    categoria: 'habito',
  },
  {
    id: 'leveled',
    nome: 'Cavaleiro Ascendente',
    descricao: 'Subiu de nível pela primeira vez',
    icone: '⬆️',
    xp: 100,
    categoria: 'habito',
  },

  // ── Saldo ────────────────────────────────────────────────────────────────────
  {
    id: 'positive_bal',
    nome: 'Cofres do Reino',
    descricao: 'Manteve saldo positivo durante um mês',
    icone: '💰',
    xp: 100,
    categoria: 'saldo',
  },
  {
    id: 'budget_week',
    nome: 'Mestre das Metas',
    descricao: 'Ficou dentro do orçamento por uma semana inteira',
    icone: '🛡️',
    xp: 200,
    categoria: 'saldo',
  },
  {
    id: 'perfect_month',
    nome: 'Mês Dourado',
    descricao: 'Encerrou o mês sem estourar nenhuma meta',
    icone: '👑',
    xp: 300,
    categoria: 'saldo',
  },
  {
    id: 'no_debt',
    nome: 'Caçador de Dívidas',
    descricao: 'Zerou completamente uma categoria de gastos',
    icone: '⚔️',
    xp: 150,
    categoria: 'saldo',
  },

  // ── Metas ────────────────────────────────────────────────────────────────────
  {
    id: 'first_goal',
    nome: 'O Sonhador',
    descricao: 'Criou sua primeira meta no reino',
    icone: '🌟',
    xp: 50,
    categoria: 'metas',
  },
  {
    id: 'goal_done',
    nome: 'Promessa Cumprida',
    descricao: 'Completou uma meta pela primeira vez',
    icone: '✅',
    xp: 200,
    categoria: 'metas',
  },
  {
    id: 'multi_goals',
    nome: 'Estrategista Real',
    descricao: 'Manteve 3 metas ativas ao mesmo tempo',
    icone: '📊',
    xp: 150,
    categoria: 'metas',
  },
  {
    id: 'big_saver',
    nome: 'Guardião do Tesouro',
    descricao: 'Acumulou R$1.000 em metas de poupança',
    icone: '🏰',
    xp: 200,
    categoria: 'metas',
  },
  {
    id: 'investor',
    nome: 'Senhor dos Mercados',
    descricao: 'Registrou R$5.000 em investimentos',
    icone: '📈',
    xp: 500,
    categoria: 'metas',
  },

  // ── Grupo ────────────────────────────────────────────────────────────────────
  {
    id: 'group_invite',
    nome: 'Heraldo Real',
    descricao: 'Convidou um membro para o clã financeiro',
    icone: '📯',
    xp: 100,
    categoria: 'grupo',
  },

  // ── Upload ───────────────────────────────────────────────────────────────────
  {
    id: 'upload_1',
    nome: 'Escriba do Reino',
    descricao: 'Fez o primeiro upload de extrato bancário',
    icone: '📄',
    xp: 75,
    categoria: 'upload',
  },

  // ── Lendário ─────────────────────────────────────────────────────────────────
  {
    id: 'dedicated',
    nome: 'Leal à Coroa',
    descricao: 'Registrou atividade por 10 dias no app',
    icone: '🗡️',
    xp: 300,
    categoria: 'lendario',
  },
]

export function getConquista(id: string): Conquista | undefined {
  return CONQUISTAS.find(c => c.id === id)
}

export const CONQUISTAS_POR_CATEGORIA = CONQUISTAS.reduce((acc, c) => {
  if (!acc[c.categoria]) acc[c.categoria] = []
  acc[c.categoria].push(c)
  return acc
}, {} as Record<string, Conquista[]>)
