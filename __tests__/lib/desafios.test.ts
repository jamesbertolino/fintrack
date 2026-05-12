import { CATALOGO_DESAFIOS, getDesafio, CORES_DIFICULDADE, LABEL_DIFICULDADE } from '@/lib/desafios'

describe('CATALOGO_DESAFIOS', () => {
  it('não tem IDs duplicados', () => {
    const ids = CATALOGO_DESAFIOS.map(d => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('todos os desafios têm campos obrigatórios preenchidos', () => {
    for (const d of CATALOGO_DESAFIOS) {
      expect(d.id).toBeTruthy()
      expect(d.titulo).toBeTruthy()
      expect(d.descricao).toBeTruthy()
      expect(d.xp).toBeGreaterThan(0)
      expect(d.duracao_dias).toBeGreaterThan(0)
      expect(d.icone).toBeTruthy()
    }
  })

  it('todos os tipos são válidos', () => {
    const tiposValidos = ['limite_categoria', 'economia', 'habito', 'sem_categoria']
    for (const d of CATALOGO_DESAFIOS) {
      expect(tiposValidos).toContain(d.tipo)
    }
  })

  it('dificuldades têm entradas em CORES_DIFICULDADE e LABEL_DIFICULDADE', () => {
    for (const d of CATALOGO_DESAFIOS) {
      expect(CORES_DIFICULDADE[d.dificuldade]).toBeDefined()
      expect(LABEL_DIFICULDADE[d.dificuldade]).toBeTruthy()
    }
  })

  it('desafios lendários têm XP >= 600', () => {
    const lendarios = CATALOGO_DESAFIOS.filter(d => d.dificuldade === 'lendario')
    expect(lendarios.length).toBeGreaterThan(0)
    for (const d of lendarios) {
      expect(d.xp).toBeGreaterThanOrEqual(600)
    }
  })
})

describe('getDesafio', () => {
  it('retorna o desafio pelo ID', () => {
    const d = getDesafio('sem_lazer_7d')
    expect(d).toBeDefined()
    expect(d!.titulo).toBe('Semana Sem Frescura')
  })

  it('retorna undefined para ID inexistente', () => {
    expect(getDesafio('nao_existe_xyz')).toBeUndefined()
  })
})
