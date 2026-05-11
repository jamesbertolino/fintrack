'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCores } from '@/components/ThemeProvider'

interface MissaoComProgresso {
  concluida: boolean; xp: number; tipo: 'diaria' | 'semanal'
}

interface DesafioAtivo {
  desafio: { titulo: string; icone: string; xp: number } | null
  pct: number; status_calculado: string
}

export default function TarefasWidget() {
  const router = useRouter()
  const cores  = useCores()

  const [missoesDia, setMissoesDia]   = useState<MissaoComProgresso[]>([])
  const [desafioAtivo, setDesafio]    = useState<DesafioAtivo | null>(null)
  const [conquistas, setConquistas]   = useState({ desbloqueadas: 0, total: 0 })
  const [loading, setLoading]         = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/missoes').then(r => r.ok ? r.json() : null),
      fetch('/api/desafios').then(r => r.ok ? r.json() : null),
      fetch('/api/conquistas').then(r => r.ok ? r.json() : null),
    ]).then(([m, d, c]) => {
      if (m?.diarias) setMissoesDia(m.diarias)
      if (d?.ativos?.length) setDesafio(d.ativos[0])
      if (c) setConquistas({ desbloqueadas: c.desbloqueadas, total: c.total })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const concluidasHoje = missoesDia.filter(m => m.concluida).length
  const totalHoje      = missoesDia.length
  const xpDisp         = missoesDia.filter(m => !m.concluida).reduce((a, m) => a + m.xp, 0)
  const pctMissoes     = totalHoje > 0 ? Math.round((concluidasHoje / totalHoje) * 100) : 0
  const pctConq        = conquistas.total > 0 ? Math.round((conquistas.desbloqueadas / conquistas.total) * 100) : 0

  return (
    <div
      onClick={() => router.push('/dashboard/tarefas')}
      style={{
        background: cores.cardBg,
        border: `1px solid ${cores.cardBorder}`,
        borderRadius: 12,
        padding: '1rem',
        boxShadow: cores.cardShadow,
        cursor: 'pointer',
      }}
    >
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 14 }}>📋</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.07em' }}>
            Tarefas
          </span>
        </div>
        <span style={{ fontSize: 11, color: cores.accent, fontWeight: 600 }}>
          Ver tudo →
        </span>
      </div>

      {loading ? (
        <div style={{ fontSize: 11, color: cores.textFaint, padding: '8px 0' }}>Carregando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Missões do dia */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontSize: 11, color: cores.textMuted }}>☀️ Missões hoje</span>
              <span style={{ fontSize: 10, color: concluidasHoje === totalHoje && totalHoje > 0 ? '#4ade80' : cores.textFaint, fontWeight: 600 }}>
                {concluidasHoje}/{totalHoje}
                {xpDisp > 0 && <span style={{ color: cores.accent }}> · +{xpDisp} XP</span>}
              </span>
            </div>
            <div style={{ height: 5, background: cores.border, borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${pctMissoes}%`,
                background: pctMissoes === 100 ? '#4ade80' : cores.accent,
                borderRadius: 99, transition: 'width .4s',
              }} />
            </div>
          </div>

          {/* Desafio ativo */}
          {desafioAtivo?.desafio ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: cores.surfaceAlt, borderRadius: 8, border: `1px solid ${cores.border}` }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{desafioAtivo.desafio.icone}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {desafioAtivo.desafio.titulo}
                </div>
                <div style={{ height: 3, background: cores.border, borderRadius: 99, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, desafioAtivo.pct)}%`,
                    background: desafioAtivo.status_calculado === 'falhou' ? '#f87171' : '#4ade80',
                    borderRadius: 99,
                  }} />
                </div>
              </div>
              <span style={{ fontSize: 10, color: '#fbbf24', fontWeight: 700, flexShrink: 0 }}>
                {Math.round(desafioAtivo.pct)}%
              </span>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: cores.textFaint, padding: '4px 0' }}>
              ⚔️ Nenhum desafio ativo —{' '}
              <span style={{ color: cores.accent, cursor: 'pointer' }}>aceite um</span>
            </div>
          )}

          {/* Conquistas */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: cores.textMuted }}>🏆 Conquistas</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 60, height: 4, background: cores.border, borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pctConq}%`, background: '#fbbf24', borderRadius: 99 }} />
              </div>
              <span style={{ fontSize: 10, color: cores.textMuted }}>{conquistas.desbloqueadas}/{conquistas.total}</span>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
