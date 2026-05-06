'use client'

import { useEffect, useState } from 'react'
import { useCores } from '@/components/ThemeProvider'

interface MissaoComProgresso {
  id: string
  tipo: 'diaria' | 'semanal'
  titulo: string
  descricao: string
  icone: string
  xp: number
  meta: number
  progresso: number
  concluida: boolean
}

interface DadosMissoes {
  diarias: MissaoComProgresso[]
  semanais: MissaoComProgresso[]
}

export default function MissoesWidget() {
  const [dados, setDados]     = useState<DadosMissoes | null>(null)
  const [abaSel, setAbaSel]   = useState<'diaria' | 'semanal'>('diaria')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/missoes')
      .then(r => r.json())
      .then(d => { setDados(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const cores = useCores()
  const missoes = abaSel === 'diaria' ? dados?.diarias : dados?.semanais
  const concluidas = missoes?.filter(m => m.concluida).length || 0
  const total      = missoes?.length || 0
  const xpDisp    = missoes?.filter(m => !m.concluida).reduce((a, m) => a + m.xp, 0) || 0

  return (
    <div style={{
      background: cores.cardBg,
      border: `1px solid ${cores.cardBorder}`,
      borderRadius: 12,
      padding: '1rem',
      boxShadow: cores.cardShadow,
    }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14 }}>⚔️</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>
            Missões
          </span>
        </div>
        {!loading && (
          <span style={{ fontSize: 10, color: cores.accent, fontWeight: 600 }}>
            +{xpDisp} XP disponível
          </span>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 3, background: cores.surfaceDark, border: `1px solid ${cores.border}`, borderRadius: 6, padding: 2, marginBottom: 12 }}>
        {(['diaria', 'semanal'] as const).map(aba => (
          <button
            key={aba}
            onClick={() => setAbaSel(aba)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 500,
              background: abaSel === aba ? cores.accent : 'transparent',
              color: abaSel === aba ? '#fff' : cores.textMuted,
              transition: 'all .15s',
            }}
          >
            {aba === 'diaria' ? '☀ Diárias' : '📅 Semanais'}
          </button>
        ))}
      </div>

      {/* Progresso geral */}
      {!loading && total > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: cores.textFaint }}>{concluidas}/{total} concluídas</span>
            <span style={{ fontSize: 10, color: cores.accent }}>{Math.round((concluidas / total) * 100)}%</span>
          </div>
          <div style={{ height: 4, background: cores.border, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((concluidas / total) * 100)}%`,
              background: `linear-gradient(90deg, ${cores.accent}, ${cores.accent}cc)`,
              borderRadius: 999,
              transition: 'width .5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem 0', fontSize: 12, color: cores.textFaint }}>
          Convocando missões...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(missoes || []).map(m => (
            <div key={m.id} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              padding: '10px',
              background: m.concluida ? cores.accentGlow : cores.surfaceAlt,
              border: `1px solid ${m.concluida ? cores.accent + '33' : cores.border}`,
              borderRadius: 8,
              opacity: m.concluida ? 0.75 : 1,
            }}>
              {/* Ícone com check */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <span style={{ fontSize: 20 }}>{m.icone}</span>
                {m.concluida && (
                  <div style={{ position: 'absolute', bottom: -2, right: -4, width: 12, height: 12, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="7" height="7" viewBox="0 0 7 7" fill="none"><polyline points="1,3.5 2.8,5.5 6,1.5" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                )}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: m.concluida ? cores.textMuted : cores.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.concluida && <span style={{ textDecoration: 'line-through' }}>{m.titulo}</span>}
                    {!m.concluida && m.titulo}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: m.concluida ? cores.accent + '66' : cores.accent, flexShrink: 0 }}>
                    +{m.xp} XP
                  </span>
                </div>
                <div style={{ fontSize: 11, color: cores.textFaint, marginBottom: m.meta > 1 ? 6 : 0 }}>
                  {m.descricao}
                </div>
                {m.meta > 1 && !m.concluida && (
                  <div>
                    <div style={{ height: 3, background: cores.border, borderRadius: 999, overflow: 'hidden', marginBottom: 2 }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.round((m.progresso / m.meta) * 100)}%`,
                        background: cores.accent,
                        borderRadius: 999,
                        transition: 'width .4s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: 9, color: cores.textFaint }}>{m.progresso}/{m.meta}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
