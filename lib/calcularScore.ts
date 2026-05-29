export interface ScoreInput {
  transacoes: { valor: number; tipo: 'debito' | 'credito'; data_hora: string; categoria?: string }[]
  metas:      { valor_total: number; valor_atual: number; ativo: boolean }[]
  orcamentos: { categoria: string; limite: number }[]
  dividas:    { saldo: number; taxa_juros: number }[]
  saldoTotal: number
}

export interface ScoreDimensao {
  id:        string
  nome:      string
  emoji:     string
  pontos:    number
  maximo:    number
  descricao: string
  dica:      string
}

export interface ScoreResult {
  total:      number
  maximo:     number
  nivel:      string
  corNivel:   string
  dimensoes:  ScoreDimensao[]
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }

export function calcularScore(input: ScoreInput): ScoreResult {
  const { transacoes, metas, orcamentos, dividas, saldoTotal } = input
  const hoje = new Date()

  // ── 1. Taxa de poupança (0-250) ─────────────────────────────────────────
  // Média dos últimos 3 meses
  let totalRec = 0, totalDesp = 0, mesesComDados = 0
  for (let i = 1; i <= 3; i++) {
    const ref   = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
    const chave = ref.toISOString().slice(0, 7)
    const txMes = transacoes.filter(t => t.data_hora.startsWith(chave))
    if (!txMes.length) continue
    totalRec  += txMes.filter(t => t.tipo === 'credito').reduce((a, t) => a + t.valor, 0)
    totalDesp += txMes.filter(t => t.tipo === 'debito').reduce((a, t) => a + Math.abs(t.valor), 0)
    mesesComDados++
  }
  const taxaPoupanca = mesesComDados && totalRec > 0
    ? Math.max(0, (totalRec - totalDesp) / totalRec)
    : 0
  const poupancaPts = clamp(Math.round((taxaPoupanca / 0.20) * 250), 0, 250)

  // ── 2. Controle de orçamentos (0-200) ───────────────────────────────────
  let orcScore = 0 // sem orçamentos cadastrados = 0, não 200
  if (orcamentos.length > 0) {
    const inicioMes = `${hoje.toISOString().slice(0, 7)}-01`
    const porCat: Record<string, number> = {}
    transacoes
      .filter(t => t.tipo === 'debito' && t.data_hora >= inicioMes)
      .forEach(t => {
        const cat = t.categoria || 'Outros'
        porCat[cat] = (porCat[cat] || 0) + Math.abs(t.valor)
      })

    const estourados = orcamentos.filter(o => (porCat[o.categoria] || 0) > o.limite).length
    const excesso = orcamentos.reduce((a, o) => {
      const gasto = porCat[o.categoria] || 0
      return a + Math.max(0, gasto - o.limite)
    }, 0)
    const totalLimite = orcamentos.reduce((a, o) => a + o.limite, 0)
    const pctExcesso  = totalLimite > 0 ? excesso / totalLimite : 0
    orcScore = clamp(Math.round(200 - estourados * 30 - pctExcesso * 100), 0, 200)
  }

  // ── 3. Progresso nas metas (0-200) ──────────────────────────────────────
  const metasAtivas = metas.filter(m => m.ativo && m.valor_total > 0)
  const metaPts = metasAtivas.length > 0
    ? clamp(Math.round(
        (metasAtivas.reduce((a, m) => a + Math.min(1, m.valor_atual / m.valor_total), 0) / metasAtivas.length) * 200
      ), 0, 200)
    : 0 // sem metas cadastradas = 0

  // ── 4. Consistência de lançamentos (0-150) ──────────────────────────────
  const diaAtual   = hoje.getDate()
  const inicioMesStr = hoje.toISOString().slice(0, 7)
  const diasComTx  = new Set(
    transacoes
      .filter(t => t.data_hora.startsWith(inicioMesStr))
      .map(t => t.data_hora.slice(0, 10))
  ).size
  const consistenciaPts = clamp(Math.round((diasComTx / Math.max(diaAtual, 1)) * 150), 0, 150)

  // ── 5. Situação de dívidas (0-150) ──────────────────────────────────────
  let dividaPts = 150
  if (dividas.length > 0) {
    const saldoDividas  = dividas.reduce((a, d) => a + d.saldo, 0)
    const mediaJuros    = dividas.reduce((a, d) => a + d.taxa_juros, 0) / dividas.length
    // Penaliza dívidas altas e juros altos
    const ratioDivida   = saldoTotal > 0 ? saldoDividas / (saldoTotal + saldoDividas) : 1
    dividaPts = clamp(Math.round(150 - ratioDivida * 100 - mediaJuros * 500), 0, 150)
  }

  // ── 6. Reserva de emergência (0-50) ─────────────────────────────────────
  const despMes    = mesesComDados > 0 ? totalDesp / mesesComDados : 0
  const mesesReserva = despMes > 0 ? saldoTotal / despMes : 0
  const reservaPts = clamp(Math.round((mesesReserva / 6) * 50), 0, 50)  // 6 meses = máximo

  const total = poupancaPts + orcScore + metaPts + consistenciaPts + dividaPts + reservaPts

  const nivel = total >= 900 ? 'Excelente'
    : total >= 750 ? 'Muito bom'
    : total >= 600 ? 'Bom'
    : total >= 450 ? 'Regular'
    : total >= 300 ? 'Atenção'
    : 'Crítico'

  const corNivel = total >= 900 ? '#4ade80'
    : total >= 750 ? '#86efac'
    : total >= 600 ? '#fbbf24'
    : total >= 450 ? '#fb923c'
    : '#f87171'

  const dimensoes: ScoreDimensao[] = [
    {
      id: 'poupanca', nome: 'Taxa de poupança', emoji: '💰', pontos: poupancaPts, maximo: 250,
      descricao: `${Math.round(taxaPoupanca * 100)}% de poupança média nos últimos 3 meses`,
      dica: taxaPoupanca >= 0.20 ? 'Ótimo! Continue poupando mais de 20% da renda.'
        : taxaPoupanca >= 0.10 ? 'Tente chegar a 20% de poupança para maximizar a pontuação.'
        : 'Reduza gastos ou aumente receitas para poupar ao menos 10% da renda.',
    },
    {
      id: 'orcamento', nome: 'Controle de orçamentos', emoji: '📊', pontos: orcScore, maximo: 200,
      descricao: orcamentos.length === 0 ? 'Nenhum orçamento cadastrado' : `${orcamentos.length} orçamento${orcamentos.length > 1 ? 's' : ''} configurado${orcamentos.length > 1 ? 's' : ''}`,
      dica: orcamentos.length === 0 ? 'Configure orçamentos por categoria para controlar seus gastos e ganhar pontos aqui.'
        : orcScore >= 180 ? 'Excelente controle! Todos os orçamentos dentro do limite.'
        : orcScore >= 120 ? 'Alguns orçamentos ultrapassados. Revise seus gastos por categoria.'
        : 'Orçamentos frequentemente estourados. Ajuste os limites ou reduza gastos.',
    },
    {
      id: 'metas', nome: 'Progresso das metas', emoji: '🎯', pontos: metaPts, maximo: 200,
      descricao: metasAtivas.length === 0 ? 'Nenhuma meta ativa' : `${metasAtivas.length} meta${metasAtivas.length > 1 ? 's' : ''} ativa${metasAtivas.length > 1 ? 's' : ''}`,
      dica: metaPts >= 180 ? 'Suas metas estão quase concluídas. Ótimo progresso!'
        : metasAtivas.length === 0 ? 'Cadastre metas financeiras para ganhar pontos nessa dimensão.'
        : 'Contribua mensalmente para suas metas para avançar mais rápido.',
    },
    {
      id: 'consistencia', nome: 'Consistência de registros', emoji: '📅', pontos: consistenciaPts, maximo: 150,
      descricao: `${diasComTx} dia${diasComTx !== 1 ? 's' : ''} com lançamentos este mês`,
      dica: consistenciaPts >= 120 ? 'Você registra suas finanças com regularidade. Parabéns!'
        : 'Lance transações diariamente para ter uma visão precisa das suas finanças.',
    },
    {
      id: 'dividas', nome: 'Situação das dívidas', emoji: '💳', pontos: dividaPts, maximo: 150,
      descricao: dividas.length === 0 ? 'Sem dívidas cadastradas' : `${dividas.length} dívida${dividas.length > 1 ? 's' : ''} ativa${dividas.length > 1 ? 's' : ''}`,
      dica: dividas.length === 0 ? 'Cadastre suas dívidas para um score mais preciso.'
        : dividaPts >= 120 ? 'Dívidas sob controle. Continue pagando regularmente.'
        : 'Priorize quitar dívidas com juros altos usando o Simulador de Dívidas.',
    },
    {
      id: 'reserva', nome: 'Reserva de emergência', emoji: '🏦', pontos: reservaPts, maximo: 50,
      descricao: mesesReserva >= 1 ? `${mesesReserva.toFixed(1)} meses de despesas em reserva` : 'Reserva insuficiente',
      dica: reservaPts >= 40 ? 'Boa reserva! Mantenha ao menos 6 meses de despesas guardados.'
        : 'Construa uma reserva de emergência de pelo menos 3-6 meses de despesas.',
    },
  ]

  return { total, maximo: 1000, nivel, corNivel, dimensoes }
}
