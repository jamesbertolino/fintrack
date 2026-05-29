'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import SinoNotificacoes from '@/components/SinoNotificacoes'
import Avatar from '@/components/Avatar'
import TarefasWidget from '@/components/TarefasWidget'
import TourGuiado from '@/components/TourGuiado'
import PushManager from '@/components/PushManager'
import ExtratoXP from '@/components/ExtratoXP'
import PrioridadeWidget, { type PrioridadeComMetrica } from '@/components/PrioridadeWidget'
import { usePerfil } from '@/hooks/usePerfil'
import { useIsMobile as useIsMobileHook } from '@/hooks/useIsMobile'
import { calcularXP, calcularNivel, getNomeNivel } from '@/lib/calcularXP'
import { calcularScore } from '@/lib/calcularScore'
import { useCores, useTema } from '@/components/ThemeProvider'
import { APP_VERSION, APP_BUILD } from '@/lib/version'

interface Transacao {
  id: string
  descricao: string
  valor: number
  tipo: 'debito' | 'credito'
  categoria: string
  data_hora: string
}

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function CalendarioGastos({ transacoes, accentColor, isMobile }: { transacoes: Transacao[]; accentColor: string; isMobile: boolean }) {
  const [diaSel, setDiaSel] = useState<string | null>(null)

  const hoje = new Date()
  const ano  = hoje.getFullYear()
  const mes  = hoje.getMonth()
  const diasNoMes = new Date(ano, mes + 1, 0).getDate()
  const primeiroDia = new Date(ano, mes, 1).getDay()

  // Agrupa débitos do mês por dia
  const porDia: Record<string, number> = {}
  const txPorDia: Record<string, Transacao[]> = {}
  transacoes.forEach(t => {
    const d = new Date(t.data_hora)
    if (d.getFullYear() !== ano || d.getMonth() !== mes) return
    const key = String(d.getDate()).padStart(2, '0')
    if (t.tipo === 'debito') porDia[key] = (porDia[key] || 0) + Math.abs(t.valor)
    txPorDia[key] = txPorDia[key] || []
    txPorDia[key].push(t)
  })

  const maxGasto = Math.max(...Object.values(porDia), 1)
  const CELL = isMobile ? 36 : 40

  const cells: { dia: number | null; key: string }[] = []
  for (let i = 0; i < primeiroDia; i++) cells.push({ dia: null, key: `e${i}` })
  for (let d = 1; d <= diasNoMes; d++) cells.push({ dia: d, key: String(d).padStart(2, '0') })

  const txSel = diaSel ? (txPorDia[diaSel] || []) : []
  const totalSel = txSel.filter(t => t.tipo === 'debito').reduce((s, t) => s + Math.abs(t.valor), 0)

  return (
    <div>
      {/* Cabeçalho dias da semana */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 9, color: 'rgba(255,255,255,.3)', fontWeight: 600, padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Grid de dias */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {cells.map(({ dia, key }) => {
          if (!dia) return <div key={key} />
          const kk       = String(dia).padStart(2, '0')
          const gasto    = porDia[kk] || 0
          const intensidade = gasto > 0 ? 0.15 + (gasto / maxGasto) * 0.75 : 0
          const ehHoje   = dia === hoje.getDate()
          const selecionado = diaSel === kk
          const temTx    = !!txPorDia[kk]
          return (
            <div
              key={key}
              onClick={() => setDiaSel(selecionado ? null : kk)}
              style={{
                height: CELL, borderRadius: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: temTx ? 'pointer' : 'default',
                background: selecionado ? accentColor : gasto > 0 ? `rgba(${hexToRgb(accentColor)},${intensidade.toFixed(2)})` : 'rgba(255,255,255,.03)',
                border: ehHoje ? `1px solid ${accentColor}` : selecionado ? 'none' : '1px solid transparent',
                transition: 'background .15s',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: ehHoje ? 700 : 400, color: selecionado ? '#000' : gasto > 0 ? '#fff' : 'rgba(255,255,255,.4)' }}>{dia}</span>
              {gasto > 0 && !selecionado && (
                <span style={{ fontSize: 8, color: 'rgba(255,255,255,.5)', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                  {gasto >= 1000 ? `${(gasto/1000).toFixed(1)}k` : gasto.toFixed(0)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Painel do dia selecionado */}
      {diaSel && (
        <div style={{ marginTop: 12, background: 'rgba(255,255,255,.03)', border: `1px solid ${accentColor}33`, borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: accentColor }}>
              {parseInt(diaSel)}/{mes + 1}/{ano}
            </span>
            {totalSel > 0 && <span style={{ fontSize: 11, color: '#f87171', fontWeight: 600 }}>-{formatBRL(totalSel)}</span>}
          </div>
          {txSel.length === 0 ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>Nenhuma transação neste dia.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
              {txSel.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</span>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 500, color: t.tipo === 'credito' ? accentColor : '#f87171', flexShrink: 0 }}>
                    {t.tipo === 'credito' ? '+' : '-'}{formatBRL(Math.abs(t.valor))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Legenda */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>menos</span>
        {[0.1, 0.3, 0.55, 0.75, 0.9].map((op, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 3, background: `rgba(${hexToRgb(accentColor)},${op})` }} />
        ))}
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>mais</span>
      </div>
    </div>
  )
}

function ComparativoMes({ transacoes, accentColor, isMobile, m: medieval }: { transacoes: Transacao[]; accentColor: string; isMobile: boolean; m: boolean }) {
  const hoje   = new Date()
  const anoA   = hoje.getFullYear(), mesA = hoje.getMonth()
  const prevD  = new Date(anoA, mesA - 1, 1)
  const anoB   = prevD.getFullYear(), mesB = prevD.getMonth()

  function resumo(ano: number, mes: number) {
    const txs = transacoes.filter(t => { const d = new Date(t.data_hora); return d.getFullYear() === ano && d.getMonth() === mes })
    const receitas  = txs.filter(t => t.tipo === 'credito').reduce((s, t) => s + t.valor, 0)
    const despesas  = txs.filter(t => t.tipo === 'debito').reduce((s, t) => s + Math.abs(t.valor), 0)
    const porCat    = txs.filter(t => t.tipo === 'debito').reduce((acc, t) => { acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor); return acc }, {} as Record<string, number>)
    return { receitas, despesas, saldo: receitas - despesas, porCat }
  }

  const atual = resumo(anoA, mesA)
  const prev  = resumo(anoB, mesB)

  if (prev.receitas === 0 && prev.despesas === 0) return null

  const nomeMes  = (ano: number, mes: number) => new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  const delta    = (a: number, b: number) => b === 0 ? null : ((a - b) / b) * 100
  const seta     = (pct: number | null, inverso = false) => {
    if (pct === null) return null
    const positivo = inverso ? pct < 0 : pct > 0
    return { seta: positivo ? '↑' : '↓', cor: positivo ? '#4ade80' : '#f87171', pct: Math.abs(pct) }
  }

  // Categorias presentes em qualquer um dos dois meses
  const cats = [...new Set([...Object.keys(atual.porCat), ...Object.keys(prev.porCat)])].sort((a, b) => (atual.porCat[b] || 0) - (atual.porCat[a] || 0)).slice(0, 5)

  const metrics = [
    { label: medieval ? 'Tributos' : 'Receitas',   atualV: atual.receitas,  prevV: prev.receitas,  inverso: false },
    { label: medieval ? 'Batalhas' : 'Gastos',     atualV: atual.despesas,  prevV: prev.despesas,  inverso: true  },
    { label: medieval ? 'Tesouro'  : 'Saldo',      atualV: atual.saldo,     prevV: prev.saldo,     inverso: false },
  ]

  return (
    <div>
      {/* Cards de métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
        {metrics.map(({ label, atualV, prevV, inverso }) => {
          const d = seta(delta(atualV, prevV), inverso)
          return (
            <div key={label} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 6 }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{formatBRL(atualV)}</span>
                {d && (
                  <span style={{ fontSize: 11, color: d.cor, fontWeight: 600 }}>{d.seta} {d.pct.toFixed(0)}%</span>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>
                {nomeMes(anoB, mesB)}: {formatBRL(prevV)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparativo por categoria */}
      {cats.length > 0 && (
        <div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 8 }}>Por categoria</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {cats.map(cat => {
              const va = atual.porCat[cat] || 0
              const vb = prev.porCat[cat] || 0
              const maxV = Math.max(va, vb, 1)
              const d = seta(delta(va, vb), true)
              return (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[cat] || '#6b7280', flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.6)' }}>{cat}</span>
                      {d && <span style={{ fontSize: 10, color: d.cor, fontWeight: 600 }}>{d.seta} {d.pct.toFixed(0)}%</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 12, fontSize: 10, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ color: 'rgba(255,255,255,.5)' }}>{nomeMes(anoB, mesB)}: {formatBRL(vb)}</span>
                      <span style={{ color: '#fff', fontWeight: 600 }}>{nomeMes(anoA, mesA)}: {formatBRL(va)}</span>
                    </div>
                  </div>
                  {/* Barra dupla */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(vb / maxV) * 100}%`, background: 'rgba(255,255,255,.2)', borderRadius: 2 }} />
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,.05)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(va / maxV) * 100}%`, background: CORES[cat] || accentColor, borderRadius: 2, opacity: 0.8 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Legenda */}
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 4, borderRadius: 2, background: 'rgba(255,255,255,.2)' }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{nomeMes(anoB, mesB)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 16, height: 4, borderRadius: 2, background: accentColor, opacity: 0.8 }} />
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{nomeMes(anoA, mesA)} (atual)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r},${g},${b}`
}

function GraficoSaldo({ transacoes, accentColor, isMobile }: { transacoes: Transacao[]; accentColor: string; isMobile: boolean }) {
  const dias = 30
  const hoje = new Date()
  hoje.setHours(23, 59, 59, 999)
  const inicio = new Date(hoje)
  inicio.setDate(inicio.getDate() - dias + 1)
  inicio.setHours(0, 0, 0, 0)

  // Saldo acumulado até antes do período (base)
  const base = transacoes
    .filter(t => new Date(t.data_hora) < inicio)
    .reduce((s, t) => s + (t.tipo === 'credito' ? t.valor : -Math.abs(t.valor)), 0)

  // Agrupar por dia
  const porDia: Record<string, number> = {}
  for (let d = 0; d < dias; d++) {
    const dt = new Date(inicio)
    dt.setDate(dt.getDate() + d)
    porDia[dt.toISOString().slice(0, 10)] = 0
  }
  transacoes
    .filter(t => { const dt = new Date(t.data_hora); return dt >= inicio && dt <= hoje })
    .forEach(t => {
      const key = new Date(t.data_hora).toISOString().slice(0, 10)
      if (key in porDia) porDia[key] += t.tipo === 'credito' ? t.valor : -Math.abs(t.valor)
    })

  const keys = Object.keys(porDia).sort()
  const pontos = keys.reduce<{ data: string; saldo: number }[]>((acc, k) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].saldo : base
    acc.push({ data: k, saldo: prev + porDia[k] })
    return acc
  }, [])

  if (pontos.length < 2) return null

  const W = isMobile ? 340 : 560
  const H = 80
  const pad = { l: 48, r: 8, t: 8, b: 20 }
  const cw = W - pad.l - pad.r
  const ch = H - pad.t - pad.b

  const vals = pontos.map(p => p.saldo)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1

  const px = (i: number) => pad.l + (i / (pontos.length - 1)) * cw
  const py = (v: number) => pad.t + ch - ((v - minV) / range) * ch

  const path = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.saldo).toFixed(1)}`).join(' ')
  const area = `${path} L${px(pontos.length - 1).toFixed(1)},${(pad.t + ch).toFixed(1)} L${pad.l.toFixed(1)},${(pad.t + ch).toFixed(1)} Z`

  // Labels: início, meio, fim
  const labelIdxs = [0, Math.floor(pontos.length / 2), pontos.length - 1]
  const fmtLbl = (iso: string) => { const d = new Date(iso + 'T12:00:00'); return `${d.getDate()}/${d.getMonth() + 1}` }

  // Y ticks
  const yTicks = [minV, (minV + maxV) / 2, maxV]

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="saldo-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accentColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Y grid lines */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} y1={py(v)} x2={W - pad.r} y2={py(v)} stroke="rgba(255,255,255,.06)" strokeWidth="1" />
          <text x={pad.l - 4} y={py(v) + 3.5} textAnchor="end" fontSize="8" fill="rgba(255,255,255,.3)">
            {Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)}
          </text>
        </g>
      ))}
      {/* Area fill */}
      <path d={area} fill="url(#saldo-grad)" />
      {/* Line */}
      <path d={path} fill="none" stroke={accentColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Last point dot */}
      <circle cx={px(pontos.length - 1)} cy={py(pontos[pontos.length - 1].saldo)} r="3" fill={accentColor} />
      {/* X labels */}
      {labelIdxs.map(i => (
        <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,.3)">
          {fmtLbl(pontos[i].data)}
        </text>
      ))}
    </svg>
  )
}

interface Meta {
  id: string
  nome: string
  valor_total: number
  valor_atual: number
  ativo?: boolean
}

interface OrcamentoItem {
  id: string
  categoria: string
  valor_planejado: number
}

interface Profile {
  nome: string
  plano: string
  avatar_url?: string | null
  setup_completo?: boolean
  prioridades?: PrioridadeComMetrica[]
  xp_bonus?: number
  is_admin?: boolean
}

interface Conta {
  id: string
  nome: string
  saldo: number
  mostrar_saldo: boolean
  bancos: { nome_curto: string; cor: string | null } | null
}

const CORES: Record<string, string> = {
  'Alimentação': '#4ade80', 'Transporte': '#22d3ee', 'Lazer': '#f97316',
  'Saúde': '#a78bfa', 'Moradia': '#fbbf24', 'Educação': '#60a5fa',
  'Receita': '#4ade80', 'Outros': '#6b7280',
}

const LogoPoupaUp = ({ collapsed }: { collapsed: boolean }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: 8, overflow: 'hidden' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/velocimetro.png" alt="PoupaUp" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </div>
    {!collapsed && (
      <div style={{ lineHeight: 1 }}>
        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #fff 40%, #4ade80 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Poupa<span style={{ background: 'linear-gradient(135deg, #4ade80, #a3e635)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Up</span>
        </div>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,.3)', letterSpacing: '.1em', marginTop: 2, textTransform: 'uppercase' }}>
          Poupar · Evoluir · Conquistar
        </div>
      </div>
    )}
  </div>
)

const OFFLINE_CACHE_KEY = 'poupaup_offline_snapshot'

function useOffline() {
  const [offline, setOffline] = useState(false)
  useEffect(() => {
    const set = () => setOffline(!navigator.onLine) // eslint-disable-line react-hooks/set-state-in-effect
    set()
    window.addEventListener('online',  set)
    window.addEventListener('offline', set)
    return () => { window.removeEventListener('online', set); window.removeEventListener('offline', set) }
  }, [])
  return offline
}

// Alias do hook global — lê a classe is-mobile do DOM, sem flash
const useIsMobile = useIsMobileHook

// Componente isolado para usar useSearchParams dentro de Suspense
function UpgradeBanner({ onDetect }: { onDetect: (v: 'success' | 'cancelled' | null) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const v = searchParams.get('upgrade')
    if (v === 'success' || v === 'cancelled') onDetect(v)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtData, timezone, idioma } = usePerfil()
  const isMobile = useIsMobile()
  const isOffline = useOffline()
  const cores = useCores()
  const { tema } = useTema()
  const m = tema === 'medieval'

  const [upgradeBanner, setUpgradeBanner] = useState<'success' | 'cancelled' | null>(null)

  const [profile, setProfile]       = useState<Profile | null>(null)
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  const [metas, setMetas]           = useState<Meta[]>([])
  const [contas, setContas]         = useState<Conta[]>([])
  const [orcamentos, setOrcamentos] = useState<OrcamentoItem[]>([])
  const [orcRealizado, setOrcReal]  = useState<Record<string, number>>({})
  const [dividas, setDividas]       = useState<{ saldo: number; taxa_juros: number }[]>([])
  const [loading, setLoading]       = useState(true)
  const [paginaAtiva, setPagina]    = useState('inicio')
  const [buscaQuery, setBuscaQuery] = useState('')
  const [buscaAberta, setBuscaAb]   = useState(false)
  const [iaAnalisando, setIaAnalisando]   = useState(false)
  const [extratoXPAberto, setExtratoXP]   = useState(false)
  const [relatorioAberto, setRelAb]       = useState(false)
  const [relatorioTexto, setRelTxt]       = useState('')
  const [relatorioMes, setRelMes]         = useState('')
  const [relatorioLoad, setRelLoad]       = useState(false)
  const [relatorioErro, setRelErro]       = useState('')

  // Em mobile sidebar começa fechada, em desktop aberta
  const [sidebarAberta, setSidebar]   = useState(true)
  const [openGroups,   setOpenGroups] = useState<Set<string>>(new Set(['principal']))
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

useEffect(() => { setMounted(true) }, []) // eslint-disable-line react-hooks/set-state-in-effect

useEffect(() => {
  setSidebar(!isMobile) // eslint-disable-line react-hooks/set-state-in-effect
}, [isMobile])

useEffect(() => {
  const groups = [
    { id: 'principal', ids: ['inicio','lancamento','gastos'] },
    { id: 'financas',  ids: ['orcamento','metas','contas','dividas','planejamento'] },
    { id: 'insights',  ids: ['score','evolucao','ia','relatorio'] },
    { id: 'gestao',    ids: ['tarefas','notificacoes','familia','categorias','admin'] },
  ]
  const gid = groups.find(g => g.ids.includes(paginaAtiva))?.id
  if (gid) setOpenGroups(prev => new Set([...prev, gid])) // eslint-disable-line react-hooks/set-state-in-effect
}, [paginaAtiva])

useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setBuscaAb(true) }
    if (e.key === 'Escape') { setBuscaAb(false); setBuscaQuery('') }
  }
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}, [])

  const xp           = calcularXP({ transacoes, metas, xpBonus: profile?.xp_bonus || 0 })
  const { receitas, despesas, saldo } = xp

  // Range de datas para link do card (primeira e última transação)
  const gastosHref = (() => {
    if (!transacoes.length) return '/dashboard/gastos'
    const datas = transacoes.map(t => t.data_hora).sort()
    const de  = datas[0].slice(0, 10)
    const ate = new Date().toISOString().slice(0, 10)
    return `/dashboard/gastos?tipo=debito&de=${de}&ate=${ate}`
  })()
  const receitasHref = (() => {
    if (!transacoes.length) return '/dashboard/gastos'
    const datas = transacoes.map(t => t.data_hora).sort()
    const de  = datas[0].slice(0, 10)
    const ate = new Date().toISOString().slice(0, 10)
    return `/dashboard/gastos?tipo=credito&de=${de}&ate=${ate}`
  })()
  const xpTotal      = xp.xpTotal
  const nivel        = calcularNivel(xpTotal)
  const nomeNivel    = getNomeNivel(nivel, m)
  const proxNomeNivel = nivel.proximoNivel ? getNomeNivel(nivel.proximoNivel, m) : null

  const nome = profile?.nome || (m ? 'Nobre Guerreiro' : 'usuário')
  const tx = {
    navSep1:      m ? 'Câmara Real'            : 'Menu',
    navSep2:      m ? 'Salão do Herói'         : 'Ferramentas',
    tituloInicio: m ? '🏰 Salão do Reino'      : '🏠 Início',
    tituloEvol:   m ? '⚡ Jornada do Herói'    : '📈 Evolução',
    saudacao:     m ? `⚔ Saudações, ${nome}`   : `Olá, ${nome} 👋`,
    xpIcone:      m ? '⚔'                      : '★',
    metLabels:    m ? ['Tesouro','Tributos','Batalhas','Glória']   as const : ['Saldo','Receitas','Gastos','Score']   as const,
    metIcones:    m ? ['💰','📈','⚔️','👑']    as const           : ['💰','📈','💸','⭐']   as const,
    secContas:    m ? '💰 Cofres do Reino'      : '🏦 Contas',
    btnContas:    m ? 'explorar →'              : 'ver contas',
    secInsights:  m ? '🔮 Profecias do Oráculo' : '💡 Análise Financeira',
    secCats:      m ? '📊 Crônicas por Ordem'   : '📊 Por Categoria',
    secTx:        m ? '⚔️ Crônicas de Batalha'  : '📋 Últimas Transações',
    btnTx:        m ? 'ver crônicas'             : 'ver todas',
    emptyTx:      m ? 'As crônicas estão vazias.' : 'Nenhuma transação ainda.',
    emptyTxCta:   m ? 'Registrar no Livro →'    : 'Adicionar transação →',
    secMetas:     m ? '🎯 Quests Ativas'         : '🎯 Metas Ativas',
    btnMetas:     m ? 'ver quests'               : 'ver todas',
    emptyMeta:    m ? 'Nenhuma meta.'            : 'Nenhuma meta cadastrada.',
    emptyMetaCta: m ? 'Declarar Quest →'         : 'Nova meta →',
    secConq:      m ? '🏅 Brasões de Honra'      : '🏅 Conquistas',
    evolTitulo:   m ? 'Título'                   : 'Nível',
    evolXP:       m ? 'Glória'                   : 'Score',
    accentColor:  m ? '#D4AF37'                  : cores.accent,
    accentMuted:  m ? 'rgba(212,175,55,.6)'      : `${cores.accent}99`,
    fontDisplay:  m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit',
  }

  const porCategoria = transacoes.filter(t => t.tipo === 'debito').reduce((acc, t) => {
    acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor); return acc
  }, {} as Record<string, number>)
  const maxCategoria = Math.max(...Object.values(porCategoria), 1)
  const insights     = gerarInsights(transacoes, saldo)

  const carregarDados = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const [{ data: prof }, { data: tx }, { data: mt }] = await Promise.all([
      supabase.from('profiles').select('nome, plano, avatar_url, setup_completo, xp_bonus, is_admin').eq('id', user.id).single(),
      supabase.from('transactions').select('*').eq('user_id', user.id).order('data_hora', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', user.id).eq('ativo', true).limit(4),
    ])

    if (prof) {
      if (prof.setup_completo === false) { router.push('/setup'); return }
      setProfile(prof)
    }
    if (tx)   setTransacoes(tx)
    if (mt)   setMetas(mt)

    const mesAtual = new Date().toISOString().slice(0, 7)
    const [contasRes, orcRes, dividasRes] = await Promise.all([
      fetch('/api/contas'),
      fetch(`/api/orcamento?mes=${mesAtual}`),
      fetch('/api/dividas'),
    ])
    const contasDados = await contasRes.json()
    const orcDados    = await orcRes.json()
    const dividasDados = await dividasRes.json()
    setContas(contasDados.contas || [])
    setOrcamentos(orcDados.orcamentos || [])
    setOrcReal(orcDados.realizado || {})
    setDividas(dividasDados.dividas || [])
    setLoading(false)

    // Salva snapshot offline
    try {
      const snap = {
        ts: Date.now(),
        nome: prof?.nome || '',
        contas: (contasDados.contas || []).map((c: { nome: string; saldo: number; mostrar_saldo: boolean; bancos?: { nome_curto: string } | null }) => ({ nome: c.nome, saldo: c.saldo, mostrar_saldo: c.mostrar_saldo, banco: c.bancos?.nome_curto })),
      }
      localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(snap))
    } catch { /* quota exceeded, ignore */ }

    // Auto-trigger IA notification (máx 2x/dia, aleatório)
    const hoje = new Date().toISOString().slice(0, 10)
    const key  = `poupaup_ia_notif_${hoje}`
    const count = parseInt(localStorage.getItem(key) || '0', 10)
    if (count < 2 && Math.random() < 0.4) {
      const delay = 8000 + Math.random() * 12000 // 8-20s após carregar
      setTimeout(async () => {
        setIaAnalisando(true)
        try {
          const r = await fetch('/api/notificacoes/ia', { method: 'POST' })
          const d = await r.json()
          if (d.ok) localStorage.setItem(key, String(count + 1))
        } finally {
          setIaAnalisando(false)
        }
      }, delay)
    }
  }, [supabase, router])

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel>
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      carregarDados()
      channel = supabase
        .channel('dashboard-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, () => { carregarDados() })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => { carregarDados() })
        .subscribe()
    }
    init()
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [carregarDados, supabase])

  // Recarrega dados ao voltar online
  useEffect(() => {
    const onOnline = () => { if (!loading) carregarDados() }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [carregarDados, loading])

  async function sair() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'system-ui, sans-serif' }}>
      <PoupaUpLogo mode="compact" />
      <div style={{ fontSize: 13, color: m ? 'rgba(212,175,55,.5)' : cores.textMuted, fontFamily: m ? 'var(--font-cinzel, Georgia, serif)' : 'system-ui, sans-serif', letterSpacing: m ? '0.1em' : 0 }}>
        {m ? 'Convocando o Reino...' : 'Carregando seu painel...'}
      </div>
    </div>
  )

  type NavItem = { id: string; label: string; icon: string; href?: string; tour?: string }
  type NavGroup = { id: string; label: string; icon: string; items: NavItem[] }

  const NAV_GROUPS: NavGroup[] = [
    {
      id: 'principal', label: m ? 'Salão' : 'Principal', icon: m ? '🏰' : '🏠',
      items: [
        { id: 'inicio',     label: m ? 'Salão do Reino'   : 'Início',      icon: m ? '🏰' : '🏠' },
        { id: 'lancamento', label: m ? 'Livro do Tesouro' : 'Lançamentos', icon: m ? '📜' : '📝', href: '/dashboard/lancamento', tour: 'tour-nav-lancamento' },
        { id: 'gastos',     label: m ? 'Batalhas'         : 'Gastos',      icon: m ? '⚔️' : '💸', href: '/dashboard/gastos',     tour: 'tour-nav-gastos' },
      ],
    },
    {
      id: 'financas', label: m ? 'Finanças' : 'Finanças', icon: m ? '💰' : '💰',
      items: [
        { id: 'orcamento',    label: m ? 'Edito do Reino'      : 'Orçamento',   icon: m ? '⚖️' : '📊', href: '/dashboard/orcamento',    tour: 'tour-nav-orcamento' },
        { id: 'metas',        label: m ? 'Quests'              : 'Metas',        icon: m ? '🎯' : '🎯', href: '/dashboard/metas',         tour: 'tour-nav-metas' },
        { id: 'contas',       label: m ? 'Cofres do Reino'     : 'Contas',       icon: m ? '🏦' : '🏦', href: '/dashboard/contas' },
        { id: 'dividas',      label: m ? 'Batalha das Dívidas' : 'Dívidas',      icon: m ? '⚔️' : '💳', href: '/dashboard/dividas' },
        { id: 'planejamento', label: m ? 'Visão do Oráculo'    : 'Planejamento', icon: m ? '🔭' : '📅', href: '/dashboard/planejamento' },
      ],
    },
    {
      id: 'insights', label: 'Insights', icon: m ? '🔮' : '📊',
      items: [
        { id: 'score',    label: m ? 'Honra do Cavaleiro' : 'Score',        icon: m ? '⭐' : '⭐', href: '/dashboard/score' },
        { id: 'evolucao', label: m ? 'Jornada do Herói'  : 'Evolução',     icon: m ? '⚡' : '📈', href: '/dashboard/evolucao' },
        { id: 'ia',       label: m ? 'Oráculo'           : 'Assistente IA',icon: m ? '🔮' : '🤖', href: '/dashboard/ia', tour: 'tour-nav-ia' },
        { id: 'relatorio',label: m ? 'Pergaminho Real'   : 'Relatório PDF',icon: m ? '📜' : '📄', href: '/dashboard/relatorio' },
      ],
    },
    {
      id: 'gestao', label: m ? 'Gestão' : 'Gestão', icon: m ? '⚙️' : '⚙️',
      items: [
        { id: 'tarefas',      label: m ? 'Missões & Desafios'        : 'Tarefas',       icon: '📋',  href: '/dashboard/tarefas' },
        { id: 'notificacoes', label: m ? 'Pergaminhos'               : 'Notificações',  icon: m ? '📯' : '🔔', href: '/dashboard/notificacoes', tour: 'tour-nav-notificacoes' },
        { id: 'familia',      label: m ? 'Reino Familiar'            : 'Família',       icon: m ? '👑' : '👨‍👩‍👧', href: '/dashboard/familia' },
        { id: 'categorias',   label: m ? 'Pergaminho de Categorias'  : 'Categorias',    icon: '🏷️', href: '/dashboard/categorias' },
        ...(profile?.is_admin ? [{ id: 'admin', label: 'Painel Admin', icon: '🛠️', href: '/dashboard/admin' }] : []),
      ],
    },
  ]


  // largura do sidebar — em mobile sempre 200 quando aberto (drawer), em desktop colapsa para 56
  const sidebarWidth = isMobile ? 200 : (sidebarAberta ? 200 : 56)
  const collapsed    = !isMobile && !sidebarAberta

  return (
    <div className="dashboard-page-root" style={{ display: 'flex', minHeight: '100vh', background: cores.pageBg, fontFamily: 'system-ui, sans-serif', fontSize: isMobile ? 15 : 'clamp(13px, 0.9vw, 17px)', position: 'relative', color: cores.text }}>

      {/* Overlay IA analisando */}
      {iaAnalisando && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, backdropFilter: 'blur(6px) brightness(0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
          <div style={{ position: 'relative', width: 64, height: 64 }}>
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${m ? '#D4AF37' : cores.accent}33` }} />
            <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid transparent`, borderTopColor: m ? '#D4AF37' : cores.accent, animation: 'ia-spin 0.9s linear infinite' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{m ? '🔮' : '🤖'}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', fontFamily: m ? 'var(--font-cinzel, Georgia, serif)' : 'inherit', marginBottom: 6 }}>
              {m ? 'O Oráculo consulta os astros…' : 'IA analisando seus dados…'}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)' }}>
              {m ? 'Aguarde as profecias do reino' : 'Criando notificações personalizadas para você'}
            </div>
          </div>
          <style>{`@keyframes ia-spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* ── Modal busca global ── */}
      {buscaAberta && (() => {
        const q = buscaQuery.trim().toLowerCase()
        const resultados = q.length < 1 ? [] : transacoes.filter(t =>
          t.descricao.toLowerCase().includes(q) ||
          t.categoria.toLowerCase().includes(q) ||
          Math.abs(t.valor).toFixed(2).includes(q) ||
          formatBRL(Math.abs(t.valor)).toLowerCase().includes(q)
        ).slice(0, 12)
        return (
          <div
            onClick={() => { setBuscaAb(false); setBuscaQuery('') }}
            style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: isMobile ? 60 : 80 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, margin: '0 1rem', background: '#111', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}>
              {/* Input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.07)' }}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0, color: 'rgba(255,255,255,.4)' }}><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/><path d="M10 10l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                <input
                  autoFocus
                  value={buscaQuery}
                  onChange={e => setBuscaQuery(e.target.value)}
                  placeholder="Buscar por descrição, categoria ou valor…"
                  style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 14, color: '#fff', caretColor: tx.accentColor }}
                />
                {buscaQuery && (
                  <button onClick={() => setBuscaQuery('')} title="Limpar busca" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.35)', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}>×</button>
                )}
                <kbd onClick={() => { setBuscaAb(false); setBuscaQuery('') }} style={{ fontSize: 10, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 5, padding: '2px 7px', color: 'rgba(255,255,255,.4)', cursor: 'pointer' }}>ESC</kbd>
              </div>
              {/* Resultados */}
              {q.length > 0 && (
                <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                  {resultados.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', fontSize: 13, color: 'rgba(255,255,255,.3)' }}>Nenhum resultado para &ldquo;{buscaQuery}&rdquo;</div>
                  ) : (
                    <>
                      <div style={{ padding: '6px 16px 4px', fontSize: 10, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase' as const, letterSpacing: '.08em' }}>
                        {resultados.length} resultado{resultados.length !== 1 ? 's' : ''}
                      </div>
                      {resultados.map(t => (
                        <div
                          key={t.id}
                          onClick={() => { router.push('/dashboard/gastos'); setBuscaAb(false); setBuscaQuery('') }}
                          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,.04)', transition: 'background .1s' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.04)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: `${CORES[t.categoria] || '#6b7280'}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280' }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div title={t.descricao} style={{ fontSize: 13, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>
                              {t.categoria} · {fmtData(t.data_hora)}
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? tx.accentColor : '#f87171', flexShrink: 0 }}>
                            {t.tipo === 'credito' ? '+' : '-'}{formatBRL(Math.abs(t.valor))}
                          </div>
                        </div>
                      ))}
                      {transacoes.filter(t => t.descricao.toLowerCase().includes(q) || t.categoria.toLowerCase().includes(q)).length > 12 && (
                        <div
                          onClick={() => { router.push('/dashboard/gastos'); setBuscaAb(false); setBuscaQuery('') }}
                          style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, color: tx.accentColor, cursor: 'pointer', borderTop: '1px solid rgba(255,255,255,.05)' }}>
                          Ver todos os resultados em Gastos →
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {q.length === 0 && (
                <div style={{ padding: '1.25rem 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 4 }}>Atalhos rápidos</div>
                  {[
                    { label: m ? 'Livro do Tesouro' : 'Lançamentos', href: '/dashboard/lancamento', icon: m ? '📜' : '📝' },
                    { label: m ? 'Batalhas' : 'Gastos', href: '/dashboard/gastos', icon: m ? '⚔️' : '💸' },
                    { label: m ? 'Edito do Reino' : 'Orçamento', href: '/dashboard/orcamento', icon: m ? '⚖️' : '📊' },
                    { label: m ? 'Quests' : 'Metas', href: '/dashboard/metas', icon: m ? '🎯' : '🎯' },
                  ].map(item => (
                    <div key={item.href} onClick={() => { router.push(item.href); setBuscaAb(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: 'pointer', transition: 'background .1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span style={{ fontSize: 14 }}>{item.icon}</span>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,.6)' }}>{item.label}</span>
                      <svg style={{ marginLeft: 'auto', color: 'rgba(255,255,255,.2)' }} width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* ── Modal relatório IA ── */}
      {relatorioAberto && (
        <div onClick={() => setRelAb(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '2rem 1rem', overflowY: 'auto' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 600, background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>✨ Relatório IA</div>
                {relatorioMes && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{relatorioMes}</div>}
              </div>
              <button onClick={() => setRelAb(false)} style={{ background: 'rgba(255,255,255,.07)', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', color: 'rgba(255,255,255,.6)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {relatorioLoad && (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: 'rgba(255,255,255,.4)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                Analisando seu mês com IA...
              </div>
            )}

            {relatorioErro && !relatorioLoad && (
              <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '12px', fontSize: 13, color: '#f87171' }}>
                {relatorioErro}
              </div>
            )}

            {relatorioTexto && !relatorioLoad && (() => {
              const secoes = relatorioTexto.split('---').map(s => s.trim()).filter(Boolean)
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {secoes.map((sec, i) => {
                    const lines  = sec.split('\n').filter(Boolean)
                    const titulo = lines[0]?.replace(/^##\s*/, '') || ''
                    const corpo  = lines.slice(1).join('\n').trim()
                    const bgMap  = ['rgba(74,222,128,.05)', 'rgba(96,165,250,.05)', 'rgba(251,191,36,.05)', 'rgba(167,139,250,.05)']
                    const bdMap  = ['rgba(74,222,128,.12)', 'rgba(96,165,250,.12)', 'rgba(251,191,36,.12)', 'rgba(167,139,250,.12)']
                    return (
                      <div key={i} style={{ background: bgMap[i] || 'rgba(255,255,255,.03)', border: `1px solid ${bdMap[i] || 'rgba(255,255,255,.08)'}`, borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{titulo}</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{corpo}</div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            <div style={{ marginTop: '1rem', fontSize: 11, color: 'rgba(255,255,255,.25)', textAlign: 'center' }}>
              Gerado por IA com base nos seus lançamentos reais · Não é aconselhamento financeiro
            </div>
          </div>
        </div>
      )}

      {/* Overlay escuro em mobile quando sidebar aberta */}
      {isMobile && sidebarAberta && (
        <div
          onClick={() => setSidebar(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 140 }}
        />
      )}

      {/* ── Tour guiado (primeira vez) ── */}
      <TourGuiado />
      {/* ── Banner push (aparece após 5s se não ativado) ── */}
      <PushManager />

      {/* ── Extrato de XP ── */}
      {extratoXPAberto && (
        <ExtratoXP
          xpTotal={xpTotal}
          xpSaldo={xp.xpSaldo}
          xpBonus={profile?.xp_bonus || 0}
          saldo={saldo}
          transacoes={transacoes}
          metas={metas}
          onFechar={() => setExtratoXP(false)}
        />
      )}

      {/* ── Sidebar — inline display:none garante oculto no mobile sem depender de JS ── */}
      {true ? <aside data-tour="tour-sidebar" style={{
        width: sidebarWidth,
        background: cores.sidebarBg,
        borderRight: `1px solid ${cores.border}`,
        display: 'none', // CSS desktop-sidebar-show sobrescreve em telas grandes
        flexDirection: 'column',
        transition: 'width .2s',
        flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: '1rem', borderBottom: `1px solid ${cores.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <LogoPoupaUp collapsed={collapsed} />
        </div>


        <nav style={{ flex: 1, padding: '0.5rem 0', overflowY: 'auto' }}>
          {NAV_GROUPS.map(group => {
            const isOpen    = openGroups.has(group.id)
            const hasActive = group.items.some(i => i.id === paginaAtiva)
            const isHovered = hoveredGroup === group.id

            function navItemBtn(item: NavItem) {
              return (
                <button key={item.id}
                  {...(item.tour ? { 'data-tour': item.tour } : {})}
                  onClick={() => {
                    if (item.href) router.push(item.href)
                    else setPagina(item.id)
                    if (isMobile) setSidebar(false)
                    setHoveredGroup(null)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 1rem 6px 2rem',
                    width: '100%',
                    background: paginaAtiva === item.id ? cores.sidebarActive : 'transparent',
                    border: 'none',
                    borderLeft: paginaAtiva === item.id ? `2px solid ${cores.sidebarActiveColor}` : '2px solid transparent',
                    cursor: 'pointer',
                    color: paginaAtiva === item.id ? cores.sidebarActiveColor : cores.sidebarTextMuted,
                    fontSize: 12, fontWeight: paginaAtiva === item.id ? 600 : 400,
                    transition: 'all .15s', textAlign: 'left', whiteSpace: 'nowrap',
                  }}>
                  <span style={{ fontSize: 14, flexShrink: 0, lineHeight: 1, opacity: 0.75 }}>{item.icon}</span>
                  {item.label}
                </button>
              )
            }

            if (collapsed) {
              // collapsed: group icon with hover flyout
              return (
                <div key={group.id} style={{ position: 'relative' }}
                  onMouseEnter={() => setHoveredGroup(group.id)}
                  onMouseLeave={() => setHoveredGroup(null)}>
                  <button
                    title={group.label}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '100%', padding: '9px 14px',
                      background: hasActive ? cores.sidebarActive : 'transparent',
                      border: 'none',
                      borderLeft: hasActive ? `2px solid ${cores.sidebarActiveColor}` : '2px solid transparent',
                      cursor: 'pointer',
                      color: hasActive ? cores.sidebarActiveColor : cores.sidebarTextMuted,
                      fontSize: 16, transition: 'all .15s',
                    }}>
                    {group.icon}
                  </button>
                  {isHovered && (
                    <div style={{
                      position: 'absolute', left: '100%', top: 0, zIndex: 200,
                      background: cores.surface, border: `1px solid ${cores.border}`,
                      borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.35)',
                      minWidth: 180, padding: '6px 0', marginLeft: 4,
                    }}>
                      <div style={{ padding: '4px 14px 8px', fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.12em', color: cores.textMuted, fontFamily: tx.fontDisplay }}>
                        {group.label}
                      </div>
                      {group.items.map(item => (
                        <button key={item.id}
                          onClick={() => {
                            if (item.href) router.push(item.href)
                            else setPagina(item.id)
                            setHoveredGroup(null)
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '7px 14px', width: '100%',
                            background: paginaAtiva === item.id ? cores.sidebarActive : 'transparent',
                            border: 'none',
                            borderLeft: paginaAtiva === item.id ? `2px solid ${cores.sidebarActiveColor}` : '2px solid transparent',
                            cursor: 'pointer',
                            color: paginaAtiva === item.id ? cores.sidebarActiveColor : cores.text,
                            fontSize: 12, fontWeight: paginaAtiva === item.id ? 600 : 400,
                            whiteSpace: 'nowrap', textAlign: 'left',
                          }}>
                          <span style={{ fontSize: 14 }}>{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            // expanded: collapsible group
            return (
              <div key={group.id}>
                <button
                  onClick={() => setOpenGroups(prev => {
                    const next = new Set(prev)
                    if (next.has(group.id)) next.delete(group.id)
                    else next.add(group.id)
                    return next
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 9,
                    padding: '7px 1rem', width: '100%',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: hasActive ? cores.sidebarActiveColor : cores.sidebarTextMuted,
                    fontSize: 11, fontWeight: 600, textAlign: 'left',
                    textTransform: 'uppercase' as const, letterSpacing: '.08em',
                    fontFamily: tx.fontDisplay,
                    borderTop: `1px solid ${cores.sidebarBorder}`,
                    marginTop: 2,
                  }}>
                  <span style={{ fontSize: 14 }}>{group.icon}</span>
                  <span style={{ flex: 1 }}>{group.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.5, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>▶</span>
                </button>
                {isOpen && group.items.map(item => navItemBtn(item))}
              </div>
            )
          })}
        </nav>

        {!collapsed && (
          <div
            onClick={() => router.push('/dashboard/evolucao')}
            style={{ margin: '0 .75rem 1rem', background: 'rgba(0,0,0,.25)', border: `1px solid ${nivel.cor}33`, borderRadius: 10, padding: '10px 12px', cursor: 'pointer', transition: 'border-color .2s' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 9, color: nivel.cor, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.1em', fontFamily: tx.fontDisplay }}>{tx.xpIcone} {nomeNivel}</span>
              <span style={{ fontSize: 9, color: cores.sidebarTextFaint, fontVariantNumeric: 'tabular-nums' }}>Nv.{nivel.nivel}</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,.1)', borderRadius: 999, overflow: 'hidden', border: `1px solid ${nivel.cor}22` }}>
              <div style={{
                height: '100%', width: `${nivel.pct}%`, borderRadius: 999,
                background: m ? `linear-gradient(90deg, ${nivel.cor}88, ${nivel.cor}, #D4AF37)` : `linear-gradient(90deg, ${nivel.cor}88, ${nivel.cor})`,
                backgroundSize: '200% 100%',
                animation: 'xp-shimmer 3s linear infinite',
                transition: 'width .8s cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
              <span style={{ fontSize: 9, color: cores.sidebarTextFaint, fontVariantNumeric: 'tabular-nums' }}>{nivel.xpNoNivel.toLocaleString()} pts</span>
              {proxNomeNivel
                ? <span style={{ fontSize: 9, color: cores.sidebarTextFaint }}>falta {(nivel.xpParaProximo - nivel.xpNoNivel).toLocaleString()} p/ {proxNomeNivel}</span>
                : <span style={{ fontSize: 9, color: nivel.cor }}>{tx.xpIcone} {nomeNivel}</span>
              }
            </div>
          </div>
        )}

        {!collapsed && (
          <div style={{ padding: '0 .75rem .75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 9, color: cores.sidebarTextFaint,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${cores.sidebarBorder}`,
              borderRadius: 6, padding: '3px 8px',
              letterSpacing: '.04em', fontVariantNumeric: 'tabular-nums',
              userSelect: 'none' as const,
            }}>
              v{APP_VERSION} · {APP_BUILD}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/privacidade" target="_blank" style={{ fontSize: 9, color: cores.sidebarTextFaint, textDecoration: 'none', opacity: 0.6 }}>Privacidade</a>
              <span style={{ fontSize: 9, color: cores.sidebarTextFaint, opacity: 0.3 }}>·</span>
              <a href="/privacidade#termos" target="_blank" style={{ fontSize: 9, color: cores.sidebarTextFaint, textDecoration: 'none', opacity: 0.6 }}>Termos</a>
            </div>
          </div>
        )}

        <button onClick={sair} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: !collapsed ? '10px 1rem' : '10px 14px',
          background: 'transparent', border: 'none', borderTop: `1px solid ${cores.sidebarBorder}`,
          color: cores.sidebarTextFaint, cursor: 'pointer', fontSize: 12, width: '100%',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 7h7M10 4l3 3-3 3M6 3H3a1 1 0 00-1 1v6a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {!collapsed && 'Sair'}
        </button>
      </aside> : null /* never null, always renders hidden */}

      {/* ── Conteúdo principal ── */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        // Em mobile o main ocupa tudo (sidebar está por cima)
        marginLeft: isMobile ? 0 : undefined,
        minWidth: 0,
      }}>

        {/* Topbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '.875rem 1rem', borderBottom: `1px solid ${cores.border}`, background: cores.topbarBg, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isMobile && (
              <button onClick={() => setSidebar(!sidebarAberta)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              </button>
            )}
            <div>
              <span style={{ fontSize: 15, fontWeight: 600, color: m ? '#F5E6C8' : cores.text, fontFamily: tx.fontDisplay, letterSpacing: m ? '0.04em' : 0 }}>
                {{ inicio: tx.tituloInicio, evolucao: tx.tituloEvol }[paginaAtiva] || 'PoupaUp'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Busca global */}
            <button
              onClick={() => setBuscaAb(true)}
              title="Buscar (Ctrl+K)"
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '5px 10px', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 12 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.3"/><path d="M8.5 8.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              {!isMobile && <span style={{ fontSize: 11 }}>Buscar</span>}
              {!isMobile && <kbd style={{ fontSize: 9, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 4, padding: '1px 5px', color: 'rgba(255,255,255,.35)' }}>⌘K</kbd>}
            </button>
            {/* Modo TV */}
            {!isMobile && (
              <button
                onClick={() => router.push('/dashboard/tv')}
                title="Modo TV / Kiosk"
                style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, padding: '5px 10px', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 12 }}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 10.5h4M6.5 10v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 11 }}>TV</span>
              </button>
            )}
            {/* Badge webhook — oculto em telas muito pequenas */}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 20, padding: '4px 10px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
                <span style={{ fontSize: 11, color: '#4ade80' }}>webhook ativo</span>
              </div>
            )}
            <SinoNotificacoes />
            <Avatar
              url={profile?.avatar_url}
              nome={profile?.nome || 'U'}
              size={30}
              nivel={nivel.nivel}
              onClick={() => router.push('/dashboard/perfil')}
            />
          </div>
        </div>

        {/* Conteúdo das páginas */}
        <div className="dashboard-content" style={{ flex: 1, overflow: 'auto', padding: isMobile ? '.875rem' : '1.25rem 1.5rem' }}>

          {/* Banner offline */}
          {isOffline && (() => {
            let snap: { ts: number; nome: string; contas: { nome: string; saldo: number; mostrar_saldo: boolean; banco?: string }[] } | null = null
            try { snap = JSON.parse(localStorage.getItem(OFFLINE_CACHE_KEY) || 'null') } catch { /* ignore */ }
            const sincAgo = snap ? (() => {
              const mins = Math.round((Date.now() - snap.ts) / 60000)
              if (mins < 1) return 'agora mesmo'
              if (mins < 60) return `há ${mins} min`
              const hrs = Math.round(mins / 60)
              return hrs < 24 ? `há ${hrs}h` : `há ${Math.round(hrs / 24)}d`
            })() : null
            const totalSnap = snap ? snap.contas.filter(c => c.mostrar_saldo).reduce((s, c) => s + c.saldo, 0) : null
            return (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(251,191,36,.08)', border: '1px solid rgba(251,191,36,.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📡</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fbbf24' }}>Você está offline</div>
                    {snap && sincAgo && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>
                        Última sincronização {sincAgo}
                        {totalSnap !== null && <> · Saldo: <strong style={{ color: '#fbbf24' }}>{formatBRL(totalSnap)}</strong></>}
                      </div>
                    )}
                    {!snap && <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>Sem dados em cache disponíveis.</div>}
                  </div>
                </div>
                {snap && snap.contas.length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {snap.contas.slice(0, 3).map((c, i) => (
                      <div key={i} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: 'rgba(251,191,36,.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,.2)' }}>
                        {c.banco || c.nome}: {c.mostrar_saldo ? formatBRL(c.saldo) : '••••'}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          {/* Banner upgrade Stripe */}
          <Suspense>
            <UpgradeBanner onDetect={setUpgradeBanner} />
          </Suspense>
          {upgradeBanner && (
            <div style={{
              marginBottom: 16,
              padding: '12px 16px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: upgradeBanner === 'success' ? 'rgba(251,191,36,.12)' : 'rgba(239,68,68,.08)',
              border: `1px solid ${upgradeBanner === 'success' ? 'rgba(251,191,36,.35)' : 'rgba(239,68,68,.25)'}`,
            }}>
              <span style={{ fontSize: 13, color: upgradeBanner === 'success' ? '#fbbf24' : '#f87171' }}>
                {upgradeBanner === 'success'
                  ? '⭐ Upgrade realizado com sucesso! Bem-vindo ao plano Pro.'
                  : '❌ Upgrade cancelado. Seu plano não foi alterado.'}
              </span>
              <button onClick={() => setUpgradeBanner(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* INÍCIO */}
          {paginaAtiva === 'inicio' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: isMobile ? 16 : 'clamp(18px, 1.3vw, 26px)', fontWeight: 600, color: m ? '#F5E6C8' : cores.text, marginBottom: 2, fontFamily: tx.fontDisplay, letterSpacing: m ? '0.03em' : 0 }}>
                  {tx.saudacao}
                </div>
                <div style={{ fontSize: 'clamp(12px, 0.85vw, 15px)', color: 'rgba(255,255,255,.4)' }}>
                  {new Intl.DateTimeFormat(idioma, { weekday: 'long', day: 'numeric', month: 'long', timeZone: timezone }).format(new Date())}
                </div>
              </div>

              {/* Cards métricas — 1 coluna em mobile, 4 em desktop */}
              <div data-tour="tour-metricas" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4,minmax(0,1fr))', gap: isMobile ? 10 : 'clamp(8px, 0.8vw, 16px)', marginBottom: '1rem' }}>
                {([
                  { label: tx.metLabels[0], val: formatBRL(saldo),    cor: saldo >= 0 ? tx.accentColor : '#c0392b', icone: tx.metIcones[0], href: undefined },
                  { label: tx.metLabels[1], val: formatBRL(receitas), cor: m ? '#5A8A4A' : cores.accent,            icone: tx.metIcones[1], href: receitasHref },
                  { label: tx.metLabels[2], val: formatBRL(despesas), cor: m ? '#8B0000' : '#f87171',               icone: tx.metIcones[2], href: gastosHref },
                  { label: tx.metLabels[3], val: `${xpTotal.toLocaleString()} XP`, cor: tx.accentColor,           icone: tx.metIcones[3], href: undefined },
                ] as const).map(card => (
                  <div key={card.label}
                    onClick={card.label === tx.metLabels[3] ? () => setExtratoXP(true) : card.href ? () => router.push(card.href!) : undefined}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-3px)'
                      e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,.35), 0 0 0 1px ${card.cor}55`
                      e.currentTarget.style.borderColor = card.cor + '66'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = ''
                      e.currentTarget.style.boxShadow = cores.cardShadow
                      e.currentTarget.style.borderColor = card.label === tx.metLabels[3] ? tx.accentColor + '44' : card.href ? card.cor + '33' : cores.cardBorder
                    }}
                    style={{
                      background: cores.cardBg,
                      border: `1px solid ${card.label === tx.metLabels[3] ? tx.accentColor + '44' : card.href ? card.cor + '33' : cores.cardBorder}`,
                      borderRadius: isMobile ? 14 : 10,
                      padding: isMobile ? '16px 18px' : 'clamp(10px, 1vw, 20px) clamp(12px, 1.2vw, 24px)',
                      boxShadow: cores.cardShadow,
                      cursor: card.label === tx.metLabels[3] || card.href ? 'pointer' : 'default',
                      transition: 'transform .18s, box-shadow .18s, border-color .18s',
                      display: isMobile ? 'flex' : undefined,
                      alignItems: isMobile ? 'center' : undefined,
                      justifyContent: isMobile ? 'space-between' : undefined,
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isMobile ? 'flex-start' : 'space-between', gap: isMobile ? 10 : 0, marginBottom: isMobile ? 0 : 5 }}>
                      <span style={{ fontSize: isMobile ? 22 : 'clamp(14px, 1.1vw, 22px)' }}>{card.icone}</span>
                      <span style={{ fontSize: isMobile ? 13 : 'clamp(10px, 0.75vw, 14px)', color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>{card.label}</span>
                    </div>
                    <div style={{ fontSize: isMobile ? 20 : 'clamp(22px, 2vw, 36px)', fontWeight: 700, color: card.cor, wordBreak: 'break-all' as const, fontVariantNumeric: 'tabular-nums', textAlign: isMobile ? 'right' : 'left' }}>{card.val}</div>
                    {card.label === tx.metLabels[3] && (
                      <div style={{ fontSize: 'clamp(11px, 0.8vw, 14px)', color: cores.textFaint, marginTop: 3 }}>Nv.{nivel.nivel} · {nivel.pct}% · <span style={{ color: tx.accentColor }}>ver extrato</span></div>
                    )}
                  </div>
                ))}
              </div>

              {/* Widget Score Financeiro */}
              {(() => {
                const sc = calcularScore({
                  transacoes: transacoes as Parameters<typeof calcularScore>[0]['transacoes'],
                  metas:      metas.map(mt => ({ valor_total: mt.valor_total, valor_atual: mt.valor_atual, ativo: true })),
                  orcamentos: orcamentos.map(o => ({ categoria: o.categoria, limite: o.valor_planejado })),
                  dividas,
                  saldoTotal: contas.filter(c => c.mostrar_saldo).reduce((a, c) => a + c.saldo, 0),
                })
                return (
                  <div
                    onClick={() => router.push('/dashboard/score')}
                    style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow, marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <svg width="52" height="52" viewBox="0 0 52 52">
                        <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,.07)" strokeWidth="5" />
                        <circle cx="26" cy="26" r="22" fill="none" stroke={sc.corNivel} strokeWidth="5"
                          strokeDasharray={`${(sc.total / 1000) * 138.2} 138.2`}
                          strokeLinecap="round"
                          transform="rotate(-90 26 26)" />
                        <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill={sc.corNivel} fontFamily="system-ui">{sc.total}</text>
                      </svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>
                        {m ? '⭐ Honra do Cavaleiro' : '⭐ Score Financeiro'}
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: sc.corNivel, marginTop: 2 }}>{sc.nivel}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' as const }}>
                        {sc.dimensoes.map(d => {
                          const p = d.pontos / d.maximo
                          const c = p >= 0.80 ? '#4ade80' : p >= 0.55 ? '#fbbf24' : '#f87171'
                          return <span key={d.id} title={`${d.nome}: ${d.pontos}/${d.maximo}`} style={{ fontSize: 11, background: `${c}18`, border: `1px solid ${c}33`, borderRadius: 4, padding: '2px 6px', color: c }}>{d.emoji} {d.pontos}</span>
                        })}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: cores.textMuted, flexShrink: 0 }}>Ver detalhes →</div>
                  </div>
                )
              })()}

              {/* Gráfico saldo ao longo do tempo */}
              {transacoes.length > 1 && (
                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>
                      {m ? '📈 Tesouro — últimos 30 dias' : '📈 Saldo — últimos 30 dias'}
                    </span>
                    <span style={{ fontSize: 10, color: saldo >= 0 ? tx.accentColor : '#f87171', fontWeight: 600 }}>
                      {formatBRL(saldo)}
                    </span>
                  </div>
                  <GraficoSaldo transacoes={transacoes} accentColor={tx.accentColor} isMobile={isMobile} />
                </div>
              )}

              {/* Saldos por conta */}
              {contas.length > 0 && (
                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>{tx.secContas}</span>
                    <button onClick={() => router.push('/dashboard/contas')} style={{ fontSize: 11, color: tx.accentColor, background: 'none', border: 'none', cursor: 'pointer' }}>{tx.btnContas}</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {contas.slice(0, 4).map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.bancos?.cor || '#4ade80', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nome}</span>
                        <span style={{ fontSize: 12, fontWeight: 500, color: c.saldo >= 0 ? tx.accentColor : '#c0392b', flexShrink: 0 }}>
                          {c.mostrar_saldo ? `R$ ${c.saldo.toFixed(2).replace('.', ',')}` : '••••••'}
                        </span>
                      </div>
                    ))}
                    {contas.length > 4 && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>+{contas.length - 4} contas</div>
                    )}
                    <div style={{ borderTop: `1px solid ${cores.divider}`, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Total</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: tx.accentColor }}>
                        R$ {contas.reduce((a, c) => a + (c.mostrar_saldo ? c.saldo : 0), 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Widget orçamento por categoria */}
              {orcamentos.length > 0 && (() => {
                const excedidas = orcamentos.filter(o => (orcRealizado[o.categoria] || 0) > o.valor_planejado)
                return (
                  <div style={{ background: cores.cardBg, border: `1px solid ${excedidas.length > 0 ? 'rgba(248,113,113,.35)' : cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>
                        {m ? '⚖️ Edito do Reino' : '📊 Orçamento do mês'}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {excedidas.length > 0 && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600, background: 'rgba(248,113,113,.15)', color: '#f87171' }}>
                            {excedidas.length} excedida{excedidas.length !== 1 ? 's' : ''} ⚠️
                          </span>
                        )}
                        <button onClick={() => router.push('/dashboard/orcamento')} style={{ fontSize: 11, color: tx.accentColor, background: 'none', border: 'none', cursor: 'pointer' }}>
                          {m ? 'gerenciar →' : 'gerenciar →'}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {orcamentos.slice(0, 5).map(o => {
                        const real = orcRealizado[o.categoria] || 0
                        const pct  = o.valor_planejado > 0 ? Math.min((real / o.valor_planejado) * 100, 100) : 0
                        const over = real > o.valor_planejado
                        const barColor = over ? '#f87171' : pct >= 80 ? '#fbbf24' : tx.accentColor
                        return (
                          <div key={o.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[o.categoria] || '#6b7280', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, color: over ? '#f87171' : 'rgba(255,255,255,.7)' }}>{o.categoria}</span>
                                {over && <span style={{ fontSize: 9, color: '#f87171' }}>+{formatBRL(real - o.valor_planejado)}</span>}
                              </div>
                              <span style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontVariantNumeric: 'tabular-nums' }}>
                                {formatBRL(real)} / {formatBRL(o.valor_planejado)}
                              </span>
                            </div>
                            <div style={{ height: 5, background: 'rgba(255,255,255,.07)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct.toFixed(1)}%`, background: barColor, borderRadius: 3, transition: 'width .4s' }} />
                            </div>
                          </div>
                        )
                      })}
                      {orcamentos.length > 5 && (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>+{orcamentos.length - 5} mais</div>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* Calendário de calor de gastos */}
              {transacoes.length > 0 && (
                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>
                      {m ? '🗓️ Crônicas do Mês' : '🗓️ Gastos do mês'}
                    </span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>
                      {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <CalendarioGastos transacoes={transacoes} accentColor={tx.accentColor} isMobile={isMobile} />
                </div>
              )}

              {/* Comparativo mês a mês */}
              {transacoes.length > 0 && (() => {
                const comp = <ComparativoMes transacoes={transacoes} accentColor={tx.accentColor} isMobile={isMobile} m={m} />
                if (!comp) return null
                const hoje = new Date()
                const prev = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1)
                const nomePrev = prev.toLocaleDateString('pt-BR', { month: 'long' })
                return (
                  <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>
                        {m ? '⚔️ Batalha vs. mês anterior' : '📊 vs. mês anterior'}
                      </span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>comparado a {nomePrev}</span>
                    </div>
                    {comp}
                  </div>
                )
              })()}

              {/* Relatório IA */}
              {(() => {
                const mesAtual = new Date().toISOString().slice(0, 7)
                async function gerarRelatorio() {
                  setRelLoad(true); setRelErro(''); setRelAb(true)
                  try {
                    const res  = await fetch('/api/relatorio-ia', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mes: mesAtual }) })
                    const data = await res.json()
                    if (!res.ok) throw new Error(data.error || 'Erro ao gerar relatório')
                    setRelTxt(data.relatorio); setRelMes(data.mes)
                  } catch (e) { setRelErro(e instanceof Error ? e.message : 'Erro desconhecido') }
                  finally { setRelLoad(false) }
                }
                return (
                  <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow, marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay, marginBottom: 2 }}>
                          {m ? '🔮 Análise do Mago' : '✨ Relatório IA'}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Resumo inteligente do mês com recomendações personalizadas</div>
                      </div>
                      <button
                        onClick={gerarRelatorio}
                        disabled={relatorioLoad}
                        style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: tx.accentColor, color: '#fff', fontSize: 12, fontWeight: 600, cursor: relatorioLoad ? 'default' : 'pointer', opacity: relatorioLoad ? 0.6 : 1, flexShrink: 0, marginLeft: 12 }}
                      >
                        {relatorioLoad ? '⏳ Gerando...' : relatorioTexto ? '↻ Regenerar' : '✨ Analisar mês'}
                      </button>
                    </div>
                    {relatorioTexto && !relatorioLoad && (
                      <button onClick={() => setRelAb(true)} style={{ marginTop: 10, width: '100%', padding: '8px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 8, color: 'rgba(255,255,255,.6)', fontSize: 12, cursor: 'pointer' }}>
                        Ver relatório de {relatorioMes} →
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* Insights + Por categoria — coluna única em mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 220px', gap: 10, marginBottom: 10 }}>
                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>{tx.secInsights}</span>
                    <span style={{ fontSize: 10, background: `${tx.accentColor}1a`, color: tx.accentColor, padding: '2px 8px', borderRadius: 2 }}>{insights.length} novos</span>
                  </div>
                  {insights.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '1rem 0' }}>Lance transações para ver insights personalizados</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {insights.map((ins, i) => (
                        <div key={i} style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,.03)', border: '1px solid #1e2d1e', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ width: 18, height: 18, borderRadius: 5, background: ins.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                            <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d={ins.icon} stroke={ins.cor} strokeWidth="1.3" strokeLinecap="round"/></svg>
                          </div>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 }} dangerouslySetInnerHTML={{ __html: ins.texto }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 12, fontFamily: tx.fontDisplay }}>{tx.secCats}</div>
                  {Object.keys(porCategoria).length === 0 ? (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', textAlign: 'center', paddingTop: '1rem' }}>Nenhum gasto ainda</div>
                  ) : (
                    Object.entries(porCategoria).sort((a,b) => b[1]-a[1]).slice(0,5).map(([cat, val]) => (
                      <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[cat] || '#6b7280', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</span>
                        <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                          <div style={{ height: '100%', width: `${Math.round((val/maxCategoria)*100)}%`, background: CORES[cat] || '#6b7280', borderRadius: 2 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 500, color: '#fff', minWidth: 48, textAlign: 'right', flexShrink: 0 }}>{formatBRL(val)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tarefas — missões, desafios e conquistas unificados */}
              <div style={{ marginBottom: 10 }}>
                <TarefasWidget />
              </div>

              {/* Últimas transações + Metas — coluna única em mobile */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>{tx.secTx}</span>
                    <button onClick={() => router.push('/dashboard/gastos')} style={{ fontSize: 11, color: tx.accentColor, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, padding: '0 4px', margin: '0 -4px' }}>{tx.btnTx}</button>
                  </div>
                  {transacoes.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '1rem 0' }}>
                      {tx.emptyTx}{' '}
                      <span style={{ color: tx.accentColor, cursor: 'pointer' }} onClick={() => router.push('/dashboard/lancamento')}>{tx.emptyTxCta}</span>
                    </div>
                  ) : transacoes.slice(0, 5).map(t => (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${cores.divider}` }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{t.categoria} · {fmtData(t.data_hora)}</div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: t.tipo === 'credito' ? tx.accentColor : (m ? '#c0392b' : '#f87171'), whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {t.tipo === 'credito' ? '+' : '-'}{formatBRL(Math.abs(t.valor))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', fontFamily: tx.fontDisplay }}>{tx.secMetas}</span>
                    <button onClick={() => router.push('/dashboard/metas')} style={{ fontSize: 11, color: tx.accentColor, background: 'none', border: 'none', cursor: 'pointer', minHeight: 44, padding: '0 4px', margin: '0 -4px' }}>{tx.btnMetas}</button>
                  </div>
                  {metas.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)', textAlign: 'center', padding: '1rem 0' }}>
                      {tx.emptyMeta}{' '}
                      <span style={{ color: tx.accentColor, cursor: 'pointer' }} onClick={() => router.push('/dashboard/metas')}>{tx.emptyMetaCta}</span>
                    </div>
                  ) : metas.map(m => {
                    const pct = Math.min(Math.round((m.valor_atual / m.valor_total) * 100), 100)
                    return (
                      <div key={m.id} style={{ marginBottom: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{m.nome}</span>
                          <span style={{ fontSize: 10, color: '#D4AF37' }}>{pct}%</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(255,255,255,.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: m ? 'linear-gradient(90deg, #8B6914, #D4AF37)' : `linear-gradient(90deg, ${cores.accent}88, ${cores.accent})`, borderRadius: 3 }} />
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 3 }}>{formatBRL(m.valor_atual)} de {formatBRL(m.valor_total)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* EVOLUÇÃO */}
          {paginaAtiva === 'evolucao' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,minmax(0,1fr))', gap: 8, marginBottom: '1.25rem' }}>
                {[
                  { label: tx.evolTitulo, val: `Nv.${nivel.nivel}`,      cor: tx.accentColor },
                  { label: tx.evolXP,     val: String(xpTotal) + ' pts', cor: m ? '#F0C040' : cores.accent },
                  { label: 'Ranking',     val: 'top 30%',                cor: '#a78bfa' },
                  { label: nomeNivel,     val: `${nivel.pct}%`,          cor: nivel.cor },
                ].map(card => (
                  <div key={card.label} style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 'clamp(10px, 0.75vw, 14px)', color: cores.textMuted, marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>{card.label}</div>
                    <div style={{ fontSize: isMobile ? 16 : 'clamp(18px, 1.4vw, 26px)', fontWeight: 500, color: card.cor }}>{card.val}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: cores.cardBg, border: `1px solid ${cores.cardBorder}`, borderRadius: 12, padding: '1rem', boxShadow: cores.cardShadow }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: tx.accentMuted, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 14, fontFamily: tx.fontDisplay }}>{tx.secConq}</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,minmax(0,1fr))', gap: 10 }}>
                  {[
                    { nome: 'Primeira conta', desc: 'Cadastrou-se',        conquistado: true,                   cor: '#D4AF37', bg: 'rgba(212,175,55,.15)' },
                    { nome: 'Primeiro gasto', desc: 'Registrou transação', conquistado: transacoes.length > 0,  cor: '#fbbf24', bg: 'rgba(251,191,36,.15)' },
                    { nome: 'Tesoureiro',      desc: 'Saldo positivo',      conquistado: saldo > 0,              cor: '#5A8A4A', bg: 'rgba(90,138,74,.15)' },
                    { nome: '5 transações',   desc: '5 registros',         conquistado: transacoes.length >= 5, cor: '#22d3ee', bg: 'rgba(34,211,238,.15)' },
                    { nome: 'Meta criada',    desc: 'Criou 1 meta',        conquistado: metas.length > 0,       cor: '#a78bfa', bg: 'rgba(167,139,250,.15)' },
                  ].map(c => (
                    <div key={c.nome} style={{ background: c.conquistado ? c.bg : 'rgba(255,255,255,.03)', border: `1px solid ${c.conquistado ? c.cor+'44' : '#1a3a1a'}`, borderRadius: 10, padding: 12, textAlign: 'center', opacity: c.conquistado ? 1 : 0.4 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: c.conquistado ? c.bg : 'rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l1.5 4.5H14L10 9l1.5 4.5L8 11l-3.5 2.5L6 9 2 6.5h4.5L8 2z" stroke={c.conquistado ? c.cor : '#6b7280'} strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 500, color: c.conquistado ? '#fff' : 'rgba(255,255,255,.3)' }}>{c.nome}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>{c.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Bottom nav removido — renderizado pelo dashboard/layout.tsx via MobileBottomNav */}

      {/* Widget de prioridades — flutua sobre tudo */}
      {profile?.prioridades && profile.prioridades.length > 0 && (() => {
        const mediaMensal = receitas > 0
          ? Math.max(0, (receitas - despesas) / Math.max(1, new Set(transacoes.map(t => t.data_hora.slice(0, 7))).size))
          : 0
        return <PrioridadeWidget prioridades={profile.prioridades!} mediaMensalPoupada={mediaMensal} />
      })()}
    </div>
  )
}

function formatBRL(val: number) {
  return 'R$ ' + Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function gerarInsights(transacoes: Transacao[], saldo: number) {
  const insights: { texto: string; icon: string; cor: string; bg: string }[] = []
  if (transacoes.length === 0) return insights

  const despesas = transacoes.filter(t => t.tipo === 'debito')
  const porCat   = despesas.reduce((acc, t) => { acc[t.categoria] = (acc[t.categoria] || 0) + Math.abs(t.valor); return acc }, {} as Record<string,number>)
  const topCat   = Object.entries(porCat).sort((a,b) => b[1]-a[1])[0]

  if (topCat)               insights.push({ texto: `Maior batalha: <strong>${topCat[0]}</strong> — ${formatBRL(topCat[1])} gastos.`, icon: 'M4.5 7.5l4 4', cor: '#c0392b', bg: 'rgba(139,0,0,.15)' })
  if (saldo > 0)            insights.push({ texto: `Tesouro positivo de <strong>${formatBRL(saldo)}</strong>. O reino prospera!`, icon: 'M1 7.5l3 3 6-6', cor: '#5A8A4A', bg: 'rgba(90,138,74,.15)' })
  if (despesas.length >= 3) insights.push({ texto: `<strong>${despesas.length} batalhas</strong> registradas nas crônicas do reino.`, icon: 'M1 4h8M1 7h5', cor: '#8B6914', bg: 'rgba(139,105,20,.15)' })

  return insights
}