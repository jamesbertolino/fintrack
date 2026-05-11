'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCores } from '@/components/ThemeProvider'
import { Conquista, CONQUISTAS_POR_CATEGORIA } from '@/lib/conquistas'

interface ConquistaComStatus extends Conquista {
  desbloqueada: boolean
  desbloqueada_em: string | null
  nova: boolean
}

interface DadosConquistas {
  conquistas: ConquistaComStatus[]
  total: number
  desbloqueadas: number
}

const NOMES_CATEGORIA: Record<string, string> = {
  inicio:   'Início da Jornada',
  habito:   'Hábitos do Reino',
  saldo:    'Cofres e Saldo',
  metas:    'Metas e Sonhos',
  grupo:    'Clã Real',
  upload:   'Escribas',
  lendario: 'Lendário',
}

export default function ConquistasPage() {
  const router = useRouter()
  const cores  = useCores()
  const [dados, setDados]     = useState<DadosConquistas | null>(null)
  const [loading, setLoading] = useState(true)
  const [novas, setNovas]     = useState<ConquistaComStatus[]>([])
  const [mostrarNovas, setMostrarNovas] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    // POST verifica condições e desbloqueia novas; GET apenas lista
    const res = await fetch('/api/conquistas', { method: 'POST' })
    if (res.status === 401) { router.push('/login'); return }
    if (res.ok) {
      const d = await res.json()
      setDados(d)
      const novasList = (d.conquistas as ConquistaComStatus[]).filter(c => c.nova)
      if (novasList.length > 0) {
        setNovas(novasList)
        setMostrarNovas(true)
      }
    }
    setLoading(false)
  }, [router])

  // eslint-disable-next-line react-hooks/exhaustive-deps,react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [])

  const pct = dados ? Math.round((dados.desbloqueadas / dados.total) * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, color: cores.text, padding: '1.5rem', maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: cores.textMuted, cursor: 'pointer', fontSize: 20 }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>🏆 Conquistas</h1>
          <p style={{ margin: 0, fontSize: 12, color: cores.textMuted }}>Desbloqueie medalhas completando desafios do reino</p>
        </div>
      </div>

      {/* Modal novas conquistas */}
      {mostrarNovas && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 16, padding: '2rem', maxWidth: 380, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>
              {novas.length === 1 ? 'Nova conquista!' : `${novas.length} novas conquistas!`}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: '16px 0' }}>
              {novas.map(c => (
                <div key={c.id} style={{ background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left' }}>
                  <span style={{ fontSize: 28 }}>{c.icone}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</div>
                    <div style={{ fontSize: 11, color: cores.textMuted }}>{c.descricao}</div>
                    <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 3 }}>+{c.xp} XP</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setMostrarNovas(false)} style={{ width: '100%', padding: '10px', background: '#fbbf24', border: 'none', borderRadius: 8, color: '#0a0a0a', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
              Incrível!
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: cores.textMuted }}>Carregando conquistas...</div>
      ) : (
        <>
          {/* Progresso geral */}
          <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 12, padding: '1.25rem', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>Progresso total</span>
              <span style={{ color: cores.textMuted }}>{dados?.desbloqueadas} / {dados?.total}</span>
            </div>
            <div style={{ height: 8, background: cores.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: '#fbbf24', borderRadius: 4, transition: 'width .4s' }} />
            </div>
            <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 6 }}>{pct}% desbloqueado</div>
          </div>

          {/* Por categoria */}
          {Object.entries(CONQUISTAS_POR_CATEGORIA).map(([cat, lista]) => {
            const comStatus = (dados?.conquistas || []).filter(c => c.categoria === cat)
            const desbCat   = comStatus.filter(c => c.desbloqueada).length
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {NOMES_CATEGORIA[cat] || cat}
                  </h2>
                  <span style={{ fontSize: 11, color: cores.textMuted }}>{desbCat}/{lista.length}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {comStatus.map(c => (
                    <div key={c.id} style={{
                      background: c.desbloqueada ? (c.nova ? 'rgba(251,191,36,.1)' : cores.surface) : 'rgba(0,0,0,.3)',
                      border: `1px solid ${c.desbloqueada ? (c.nova ? 'rgba(251,191,36,.4)' : cores.border) : 'rgba(255,255,255,.05)'}`,
                      borderRadius: 10,
                      padding: '12px 14px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      opacity: c.desbloqueada ? 1 : 0.45,
                      position: 'relative',
                    }}>
                      <span style={{ fontSize: 28, filter: c.desbloqueada ? 'none' : 'grayscale(1)' }}>{c.icone}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{c.nome}</div>
                        <div style={{ fontSize: 11, color: cores.textMuted, lineHeight: 1.3 }}>{c.descricao}</div>
                        <div style={{ fontSize: 10, color: c.desbloqueada ? '#fbbf24' : cores.textMuted, marginTop: 4 }}>
                          {c.desbloqueada
                            ? (c.desbloqueada_em ? new Date(c.desbloqueada_em).toLocaleDateString('pt-BR') : 'Desbloqueado')
                            : `+${c.xp} XP ao desbloquear`}
                        </div>
                      </div>
                      {c.nova && (
                        <div style={{ position: 'absolute', top: 6, right: 6, fontSize: 9, background: '#fbbf24', color: '#0a0a0a', padding: '2px 5px', borderRadius: 6, fontWeight: 700 }}>NOVO</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}
