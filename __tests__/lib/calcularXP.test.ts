import { calcularXP, calcularNivel, NIVEIS } from '@/lib/calcularXP'

describe('calcularXP', () => {
  it('retorna zeros para dados vazios', () => {
    const r = calcularXP({ transacoes: [], metas: [] })
    expect(r.xpTotal).toBe(0)
    expect(r.saldo).toBe(0)
  })

  it('conta 10 XP por transação', () => {
    const r = calcularXP({
      transacoes: [
        { valor: 100, tipo: 'credito' },
        { valor: 50, tipo: 'debito' },
      ],
      metas: [],
    })
    expect(r.xpTransacoes).toBe(20)
  })

  it('calcula saldo e xpSaldo corretamente', () => {
    const r = calcularXP({
      transacoes: [
        { valor: 1000, tipo: 'credito' },
        { valor: 300, tipo: 'debito' },
      ],
      metas: [],
    })
    expect(r.saldo).toBe(700)
    expect(r.xpSaldo).toBe(70) // Math.round(700 / 10)
  })

  it('não dá xpSaldo negativo quando despesas > receitas', () => {
    const r = calcularXP({
      transacoes: [{ valor: 500, tipo: 'debito' }],
      metas: [],
    })
    expect(r.xpSaldo).toBe(0)
  })

  it('soma 50 XP por meta ativa', () => {
    const r = calcularXP({
      transacoes: [],
      metas: [
        { valor_total: 1000, valor_atual: 0, ativo: true },
        { valor_total: 500, valor_atual: 0, ativo: true },
        { valor_total: 200, valor_atual: 100, ativo: false },
      ],
    })
    expect(r.xpMetas).toBe(100) // 2 ativas × 50
  })

  it('soma 200 XP por meta concluída (valor_atual >= valor_total)', () => {
    const r = calcularXP({
      transacoes: [],
      metas: [
        { valor_total: 500, valor_atual: 500, ativo: true },
        { valor_total: 200, valor_atual: 250, ativo: true },
      ],
    })
    // 2 ativas × 50 + 2 concluídas × 200
    expect(r.xpMetas).toBe(500)
  })

  it('inclui xpBonus no total', () => {
    const r = calcularXP({ transacoes: [], metas: [], xpBonus: 300 })
    expect(r.xpTotal).toBe(300)
  })
})

describe('calcularNivel', () => {
  it('retorna nível 1 (Camponês) para XP 0', () => {
    const r = calcularNivel(0)
    expect(r.nivel).toBe(1)
    expect(r.nome).toBe('Camponês')
  })

  it('sobe para nível 2 com XP >= 500', () => {
    expect(calcularNivel(500).nivel).toBe(2)
    expect(calcularNivel(499).nivel).toBe(1)
  })

  it('sobe para nível máximo (8) com XP >= 35000', () => {
    const r = calcularNivel(35000)
    expect(r.nivel).toBe(8)
    expect(r.proximoNivel).toBeUndefined()
  })

  it('pct nunca passa de 100', () => {
    const r = calcularNivel(999_999)
    expect(r.pct).toBe(100)
  })

  it('calcula pct corretamente dentro de um nível', () => {
    // Nível 1: min=0, próximo=500 → 250 XP = 50%
    const r = calcularNivel(250)
    expect(r.pct).toBe(50)
  })

  it('todos os níveis têm campos obrigatórios', () => {
    for (const n of NIVEIS) {
      expect(n.nivel).toBeGreaterThan(0)
      expect(n.nome).toBeTruthy()
      expect(n.cor).toBeTruthy()
      expect(n.min).toBeGreaterThanOrEqual(0)
    }
  })
})
