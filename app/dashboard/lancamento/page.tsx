'use client'

import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { usePerfil } from '@/hooks/usePerfil'

// ─── Sistema de tips ──────────────────────────────────────────────────────────
const TIPS_KEY = 'poupaup_tips_v1'

function useTips() {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({})

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setDismissed(JSON.parse(localStorage.getItem(TIPS_KEY) || '{}')) } catch { /* ignore */ }
  }, [])

  function dismiss(id: string) {
    const next = { ...dismissed, [id]: true }
    setDismissed(next)
    try { localStorage.setItem(TIPS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  function isVisible(id: string) {
    return !dismissed[id]
  }

  return { isVisible, dismiss }
}

function TipCard({ id, icon, text, tips, accent = '#4ade80' }: {
  id: string
  icon: string
  text: string
  tips: ReturnType<typeof useTips>
  accent?: string
}) {
  if (!tips.isVisible(id)) return null
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px',
      background: `${accent}08`,
      border: `1px solid ${accent}22`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      marginBottom: 12,
      animation: 'tipFadeIn .3s ease',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12, color: 'rgba(255,255,255,.65)', lineHeight: 1.55 }}
        dangerouslySetInnerHTML={{ __html: text }} />
      <button
        onClick={() => tips.dismiss(id)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: '8px', margin: '-8px -8px -8px 0', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        title="Dispensar dica"
      >×</button>
      <style>{`@keyframes tipFadeIn { from { opacity:0; transform:translateY(-4px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}

interface Transacao {
  id: string
  descricao: string
  valor: number
  tipo: 'debito' | 'credito'
  categoria: string
  data_hora: string
  origem: string
  conta_id?: string
  importacao_id?: string | null
}

interface TransacaoDetectada {
  descricao: string
  tipo_pagamento?: string
  valor: number
  tipo: string
  categoria: string
  data_hora: string
  nao_categorizado?: boolean
  potencial_duplicata?: boolean
  duplicata_origem?: 'historico' | 'lote'
  confirmada_duplicata?: boolean  // já existe no banco com mesma ref_externa
  ref_externa?: string
  origem_categoria?: 'aprendido' | 'padrao' | 'ia'
  e_pagamento_fatura?: boolean
  conciliacao_id?: string
  conciliacao_descricao?: string
  conflito_data?: string          // data da transação existente que causou o potencial_duplicata
  conflito_descricao?: string
}

const CATEGORIAS_DESPESA = ['Alimentação','Transporte','Lazer','Saúde','Moradia','Educação','Outros']
const CATEGORIAS_RECEITA = ['Salário','Freelance','Investimento','Presente','Outros']
const TODAS_CATEGORIAS = [...new Set([...CATEGORIAS_DESPESA, ...CATEGORIAS_RECEITA])]

const CORES: Record<string, string> = {
  'Alimentação': '#4ade80', 'Transporte': '#22d3ee', 'Lazer': '#f97316',
  'Saúde': '#a78bfa', 'Moradia': '#fbbf24', 'Educação': '#60a5fa',
  'Salário': '#4ade80', 'Freelance': '#34d399', 'Investimento': '#818cf8',
  'Presente': '#f472b6', 'Outros': '#6b7280',
}

const ATALHOS = [
  { label: 'iFood',        cat: 'Alimentação', tipo: 'debito'  },
  { label: 'Uber',         cat: 'Transporte',  tipo: 'debito'  },
  { label: 'Mercado',      cat: 'Alimentação', tipo: 'debito'  },
  { label: 'Salário',      cat: 'Salário',     tipo: 'credito' },
  { label: 'Farmácia',     cat: 'Saúde',       tipo: 'debito'  },
  { label: 'Netflix',      cat: 'Lazer',       tipo: 'debito'  },
  { label: 'Luz/Água/Gás', cat: 'Moradia',     tipo: 'debito'  },
  { label: 'Freelance',    cat: 'Freelance',   tipo: 'credito' },
]

function fmtBRL(v: number) {
  return 'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function dataLocalParaInput(timezone: string): string {
  const agora = new Date()
  const local = new Intl.DateTimeFormat('sv-SE', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(agora)
  return local.replace(' ', 'T').slice(0, 16)
}

function inputParaUTC(dataLocal: string, timezone: string): string {
  const [data, hora] = dataLocal.split('T')
  const [ano, mes, dia] = data.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  const dataObj = new Date(Date.UTC(ano, mes - 1, dia, h, min))
  const formatter = new Intl.DateTimeFormat('en', { timeZone: timezone, timeZoneName: 'shortOffset' })
  const parts = formatter.formatToParts(dataObj)
  const offset = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT+0'
  const match = offset.match(/GMT([+-]\d+)(?::(\d+))?/)
  const horas = match ? parseInt(match[1]) : 0
  const mins  = match ? parseInt(match[2] || '0') : 0
  const offsetMs = (horas * 60 + (horas < 0 ? -mins : mins)) * 60000
  return new Date(dataObj.getTime() - offsetMs).toISOString()
}

// ─── Tipos compartilhados ────────────────────────────────────────────────────
type ImportacaoItem = {
  id: string; arquivo_nome: string | null; formato: string | null; banco_nome: string | null
  total_detectadas: number; total_inseridas: number; total_duplicatas: number; created_at: string
  contas?: { nome: string; bancos?: { nome_curto: string; cor: string | null } | null } | null
}

type TransacaoLote = {
  id: string; descricao: string; valor: number; tipo: string; categoria: string; data_hora: string
}

// ─── Componente: Histórico de importações compacto ──────────────────────────
function ImportacoesHistorico({ importacoes, loading, filtroAtivo, onFiltrar, onExcluir }: {
  importacoes: ImportacaoItem[]; loading: boolean
  filtroAtivo: string | null
  onFiltrar: (id: string | null) => void
  onExcluir: (id: string) => void
}) {
  const [secaoAberta, setSecaoAberta] = useState(false)
  const [expandido, setExpandido]     = useState<string | null>(null)
  const [lotes, setLotes]             = useState<Record<string, TransacaoLote[]>>({})
  const [carregandoLote, setCarregandoLote] = useState<string | null>(null)
  const [excluindoLote, setExcluindoLote]   = useState<string | null>(null)
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null)
  const [mostrarTodos, setMostrarTodos] = useState(false)

  async function excluirLote(id: string, total: number) {
    if (confirmExcluir !== id) { setConfirmExcluir(id); return }
    setConfirmExcluir(null)
    setExcluindoLote(id)
    const res = await fetch(`/api/importacoes/${id}`, { method: 'DELETE' })
    setExcluindoLote(null)
    if (res.ok) {
      setExpandido(null)
      onExcluir(id)
    }
    void total
  }

  async function toggleExpand(id: string) {
    if (expandido === id) { setExpandido(null); return }
    setExpandido(id)
    if (lotes[id]) return
    setCarregandoLote(id)
    const res = await fetch(`/api/importacoes/${id}`)
    const d = await res.json()
    setLotes(prev => ({ ...prev, [id]: d.transacoes || [] }))
    setCarregandoLote(null)
  }

  const FORMATO_ICON: Record<string, string> = { csv: '📊', ofx: '🏦', pdf: '📄', imagem: '🖼️' }
  const CATEGORIA_COR: Record<string, string> = {
    'Alimentação': '#4ade80', 'Transporte': '#22d3ee', 'Lazer': '#f97316',
    'Saúde': '#a78bfa', 'Moradia': '#fbbf24', 'Educação': '#60a5fa',
    'Salário': '#4ade80', 'Freelance': '#34d399', 'Investimento': '#818cf8',
    'Presente': '#f472b6', 'Outros': '#6b7280',
  }

  const visiveis = mostrarTodos ? importacoes : importacoes.slice(0, 5)

  return (
    <div style={{ marginBottom: '1rem', borderRadius: 10, border: '1px solid #1a3a1a', overflow: 'hidden' }}>
      {/* ── Cabeçalho da seção ── */}
      <button
        onClick={() => setSecaoAberta(v => !v)}
        style={{ width: '100%', background: '#0a1a0a', border: 'none', cursor: 'pointer', padding: '9px 12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, color: 'rgba(255,255,255,.4)' }}>
          <path d="M1 2h10M3 5h6M5 8h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>
          Importações recentes
          {!loading && importacoes.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(255,255,255,.3)' }}>({importacoes.length})</span>
          )}
          {filtroAtivo && (
            <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', borderRadius: 5, background: 'rgba(129,140,248,.15)', color: '#818cf8', border: '1px solid rgba(129,140,248,.3)' }}>filtro ativo</span>
          )}
        </span>
        {loading && <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>...</span>}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transition: 'transform .2s', transform: secaoAberta ? 'rotate(180deg)' : 'none' }}>
          <path d="M2 3.5l3 3 3-3" stroke="rgba(255,255,255,.3)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {/* ── Lista de lotes (só quando aberta) ── */}
      {secaoAberta && (
        <div style={{ borderTop: '1px solid #1a3a1a' }}>
          {loading ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', padding: '10px 12px' }}>Carregando...</div>
          ) : importacoes.length === 0 ? (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', padding: '10px 12px' }}>Nenhuma importação encontrada.</div>
          ) : (
            <>
              {visiveis.map((imp, idx) => {
                const icon = FORMATO_ICON[imp.formato || ''] || '📁'
                const nome = imp.arquivo_nome || imp.banco_nome || 'Importação'
                const dataStr = new Date(imp.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
                const pct = imp.total_detectadas > 0 ? Math.round((imp.total_inseridas / imp.total_detectadas) * 100) : 0
                const pctDup = imp.total_detectadas > 0 ? Math.round((imp.total_duplicatas / imp.total_detectadas) * 100) : 0
                const aberto = expandido === imp.id
                const transacoes = lotes[imp.id] || []
                const ativo = filtroAtivo === imp.id

                return (
                  <div key={imp.id} style={{ borderBottom: idx < visiveis.length - 1 || mostrarTodos ? '1px solid #111' : 'none' }}>
                    {/* Linha compacta */}
                    <button
                      onClick={() => toggleExpand(imp.id)}
                      style={{ width: '100%', background: aberto ? 'rgba(255,255,255,.03)' : 'none', border: 'none', cursor: 'pointer', padding: '7px 12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, minHeight: 36 }}
                    >
                      <span style={{ fontSize: 13, flexShrink: 0 }}>{icon}</span>
                      <span style={{ flex: 1, fontSize: 11, color: 'rgba(255,255,255,.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={nome}>{nome}</span>
                      <span style={{ fontSize: 10, color: '#4ade80', flexShrink: 0, whiteSpace: 'nowrap' }}>{imp.total_inseridas} lç</span>
                      {imp.total_duplicatas > 0 && <span style={{ fontSize: 10, color: 'rgba(239,68,68,.6)', flexShrink: 0 }}>·{imp.total_duplicatas}d</span>}
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,.25)', flexShrink: 0 }}>{dataStr}</span>
                      {ativo && <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 4, background: 'rgba(129,140,248,.15)', color: '#818cf8', flexShrink: 0 }}>●</span>}
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transition: 'transform .15s', transform: aberto ? 'rotate(180deg)' : 'none' }}>
                        <path d="M2 3.5l3 3 3-3" stroke="rgba(255,255,255,.25)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {/* Painel expandido */}
                    {aberto && (
                      <div style={{ padding: '6px 12px 10px', background: 'rgba(0,0,0,.2)', borderTop: '1px solid #111' }}>
                        {/* Barra de progresso */}
                        {imp.total_detectadas > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: 'flex', height: 3, borderRadius: 3, overflow: 'hidden', background: 'rgba(255,255,255,.06)', marginBottom: 4 }}>
                              <div style={{ width: `${pct}%`, background: '#16a34a' }} />
                              {imp.total_duplicatas > 0 && <div style={{ width: `${pctDup}%`, background: 'rgba(239,68,68,.4)' }} />}
                            </div>
                            <div style={{ display: 'flex', gap: 10 }}>
                              <span style={{ fontSize: 10, color: '#4ade80' }}>✓ {imp.total_inseridas} lançados</span>
                              {imp.total_duplicatas > 0 && <span style={{ fontSize: 10, color: 'rgba(239,68,68,.6)' }}>⊘ {imp.total_duplicatas} dup.</span>}
                              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.25)', marginLeft: 'auto' }}>{imp.total_detectadas} total</span>
                            </div>
                          </div>
                        )}
                        {/* Transações */}
                        {carregandoLote === imp.id ? (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', padding: '4px 0' }}>Carregando...</div>
                        ) : transacoes.length === 0 ? (
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', padding: '4px 0' }}>
                            {imp.total_inseridas === 0 ? 'Nenhuma transação inserida.' : 'Lote anterior ao vínculo por importação.'}
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflowY: 'auto', marginBottom: 8 }}>
                            {transacoes.map(t => (
                              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', borderBottom: '1px solid rgba(255,255,255,.03)' }}>
                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: CATEGORIA_COR[t.categoria] || '#6b7280', flexShrink: 0 }} />
                                <div style={{ flex: 1, fontSize: 10, color: 'rgba(255,255,255,.65)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.descricao}</div>
                                <div style={{ fontSize: 10, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                  {t.tipo === 'credito' ? '+' : '-'}{fmtBRL(t.valor)}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Botões filtrar + excluir */}
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => onFiltrar(ativo ? null : imp.id)}
                            style={{ flex: 1, padding: '5px', background: ativo ? 'rgba(129,140,248,.12)' : 'rgba(255,255,255,.03)', border: `1px solid ${ativo ? 'rgba(129,140,248,.3)' : 'rgba(255,255,255,.08)'}`, borderRadius: 6, color: ativo ? '#818cf8' : 'rgba(255,255,255,.35)', fontSize: 10, cursor: 'pointer' }}
                          >
                            {ativo ? '✕ Remover filtro' : '↓ Filtrar por este lote'}
                          </button>
                          <button
                            onClick={() => excluirLote(imp.id, imp.total_inseridas)}
                            disabled={excluindoLote === imp.id}
                            style={{
                              padding: '5px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                              background: confirmExcluir === imp.id ? 'rgba(239,68,68,.15)' : 'rgba(239,68,68,.06)',
                              border: `1px solid ${confirmExcluir === imp.id ? 'rgba(239,68,68,.5)' : 'rgba(239,68,68,.2)'}`,
                              color: confirmExcluir === imp.id ? '#f87171' : 'rgba(239,68,68,.5)',
                              opacity: excluindoLote === imp.id ? 0.5 : 1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {excluindoLote === imp.id ? '...' : confirmExcluir === imp.id ? `⚠ Confirmar (${imp.total_inseridas} lç)` : '🗑 Excluir lote'}
                          </button>
                        </div>
                        {confirmExcluir === imp.id && (
                          <button onClick={() => setConfirmExcluir(null)} style={{ width: '100%', marginTop: 4, padding: '3px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 9, color: 'rgba(255,255,255,.25)' }}>
                            cancelar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
              {importacoes.length > 5 && (
                <button
                  onClick={() => setMostrarTodos(v => !v)}
                  style={{ width: '100%', padding: '7px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, color: 'rgba(255,255,255,.3)', borderTop: '1px solid #111' }}
                >
                  {mostrarTodos ? '↑ mostrar menos' : `↓ ver mais ${importacoes.length - 5} importações`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Componente separado para isolar useSearchParams no Suspense boundary
function ShareTargetLoader({ onShare, onErro }: { onShare: (path: string) => void; onErro: (msg: string) => void }) {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const sharePath = searchParams.get('share')
    const shareErro = searchParams.get('share_erro')
    if (shareErro) {
      onErro(shareErro === 'tamanho' ? 'Arquivo muito grande. Máx 15MB.' : 'Erro ao receber arquivo compartilhado.')
      router.replace('/dashboard/lancamento')
    } else if (sharePath) {
      onShare(sharePath)
      router.replace('/dashboard/lancamento')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default function LancamentoPage() {
  const router = useRouter()
  const supabase = createClient()
  const { fmtDataHora } = usePerfil()

  // ─── form ───
  const [tipo, setTipo]             = useState<'debito' | 'credito'>('debito')
  const [valor, setValor]           = useState('')
  const [descricao, setDescricao]   = useState('')
  const [categoria, setCategoria]   = useState('Alimentação')
  const [categoriasCustom, setCategoriasCustom] = useState<string[]>([])
  const [novaCategInput, setNovaCategInput] = useState('')
  const [adicionandoCateg, setAdicionandoCateg] = useState(false)
  const [dataHora, setDataHora]     = useState('')
  const [timezone, setTimezone]     = useState('America/Sao_Paulo')
  const [recorrente, setRecorrente] = useState(false)
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [sucesso, setSucesso]       = useState(false)
  const [alertaOrcamento, setAlertaOrcamento] = useState<{ limite: number; gasto: number; percentual: number; excedido: boolean } | null>(null)
  const [userId, setUserId]         = useState('')
  const [contas, setContas]         = useState<Array<{ id: string; nome: string; tipo: string; bancos: { id: string; nome_curto: string; cor: string | null } | null }>>([])
  const [contaSelecionada, setConta] = useState('')

  // ─── histórico ───
  const [historico, setHistorico]   = useState<Transacao[]>([])
  const [deletando, setDeletando]   = useState<string | null>(null)

  // ─── filtro de conta no histórico ───
  const [filtroContaId, setFiltroContaId] = useState('')

  // ─── filtro por importação ───
  const [filtroImportacaoId, setFiltroImportacaoId] = useState<string | null>(null)

  // ─── seleção em lote ───
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [movendo, setMovendo]           = useState(false)
  const [contaDestino, setContaDestino] = useState('')
  const [excluindoLote, setExcluindoLote] = useState(false)

  // ─── modal nova conta (inline) ───
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [bancosLista, setBancosLista]       = useState<Array<{ id: string; nome: string; nome_curto: string; cor: string | null; codigo: string }>>([])
  const [buscaBancoModal, setBuscaBancoModal] = useState('')
  const [salvandoConta, setSalvandoConta]   = useState(false)
  const [erroNovaConta, setErroNovaConta]   = useState('')
  const [formNovaConta, setFormNovaConta]   = useState({
    banco_id: '', nome: '', tipo: 'corrente', numero: '', agencia: '', mostrar_saldo: true, saldo_inicial: '',
  })

  // ─── reconhecimento de voz ───
  const [vozGravando, setVozGravando]       = useState(false)
  const [vozProcessando, setVozProcessando] = useState(false)
  const [vozTranscricao, setVozTranscricao] = useState('')
  const [vozErro, setVozErro]               = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vozRecRef = useRef<any>(null)

  function iniciarVoz() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (typeof window !== 'undefined') && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
    if (!SR) { setVozErro('Navegador não suporta reconhecimento de voz. Use Chrome.'); return }
    setVozErro(''); setVozTranscricao('')
    const rec = new SR()
    rec.lang = 'pt-BR'
    rec.interimResults = false
    rec.maxAlternatives = 1
    vozRecRef.current = rec
    rec.onstart  = () => setVozGravando(true)
    rec.onend    = () => setVozGravando(false)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror  = (e: any) => { setVozGravando(false); setVozErro(`Microfone: ${e.error === 'not-allowed' ? 'permissão negada' : e.error}`) }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = async (e: any) => {
      const transcript = e.results[0][0].transcript
      setVozTranscricao(transcript)
      setVozProcessando(true)
      try {
        const res  = await fetch('/api/ia/voz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript }) })
        const data = await res.json()
        if (!res.ok || data.error) { setVozErro(data.error || 'Não entendi a frase'); return }
        setTipo(data.tipo)
        setValor(data.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
        setDescricao(data.descricao.toUpperCase())
        setCategoria(data.categoria)
        setVozErro('')
      } catch { setVozErro('Erro ao processar. Tente novamente.') }
      finally   { setVozProcessando(false) }
    }
    rec.start()
  }

  function pararVoz() {
    vozRecRef.current?.stop()
    setVozGravando(false)
  }

  // ─── modal edição ───
  const [modalAberto, setModalAberto]       = useState(false)
  const [transacaoEditando, setTransacaoEditando] = useState<Transacao | null>(null)
  const [editDescricao, setEditDescricao]   = useState('')
  const [editCategoria, setEditCategoria]   = useState('')
  const [editContaId, setEditContaId]       = useState('')
  const [editDataHora, setEditDataHora]     = useState('')
  const [editValor, setEditValor]           = useState('')
  const [editTipo, setEditTipo]             = useState<'debito' | 'credito'>('debito')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  // ─── upload ───
  const inputRef                    = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver]     = useState(false)
  const [processando, setProcessan] = useState(false)
  const [etapaUpload, setEtapa]     = useState('')
  const [confirmando, setConfirman] = useState(false)
  const [maisOpcoes, setMaisOpcoes]   = useState(false)
  const [uploadAberto, setUploadAberto] = useState(false)
  const [transacoesDetectadas, setTransacoesDetectadas] = useState<TransacaoDetectada[]>([])
  const [resumoDetectado, setResumo] = useState('')
  const [importacaoOrigemId, setImportacaoOrigemId] = useState<string | null>(null)
  const [csvDebug, setCsvDebug]       = useState('')
  const [lacunasDetectadas, setLacunas] = useState<string[]>([])
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [bancoDetectado, setBancoDetectado] = useState<{ id: string; nome_curto: string; cor: string | null } | null>(null)
  const [contaUpload, setContaUpload] = useState('')
  // Controle de edição inline de categoria (índice do item em edição)
  const [editandoCategoriaIdx, setEditandoCategoriaIdx] = useState<number | null>(null)

  // ─── cadastro inline de conta (no upload) ───
  const [contaInlineAberta, setContaInlineAberta] = useState(false)

  // ─── confirmação de conta destino antes de importar ───
  const [etapaConfirmacao, setEtapaConfirmacao] = useState(false)

  // ─── modal conta não encontrada ───
  const [modalContaNaoEncontrada, setModalContaNaoEncontrada] = useState(false)
  const [bancoNaoEncontrado, setBancoNaoEncontrado] = useState('')

  // ─── modal confirmação de potenciais duplicatas ───
  const [modalDuplicatas, setModalDuplicatas] = useState(false)

  // ─── metadados do arquivo atual (para histórico de importações) ───
  const [uploadMeta, setUploadMeta] = useState<{ arquivo_nome: string; formato: string } | null>(null)

  // ─── toast pós-importação ───
  const [toastImport, setToastImport] = useState<{ lancados: number; duplicatas: number; dataInicio?: string; dataFim?: string } | null>(null)

  // ─── histórico de importações ───
  const [importacoes, setImportacoes] = useState<ImportacaoItem[]>([])
  const [loadingImportacoes, setLoadingImportacoes] = useState(false)
  const isMobile = useIsMobile(640)

  const carregarImportacoes = useCallback(async () => {
    setLoadingImportacoes(true)
    const res = await fetch('/api/importacoes')
    const d = await res.json()
    setImportacoes(d.importacoes || [])
    setLoadingImportacoes(false)
  }, [setImportacoes, setLoadingImportacoes])

  useEffect(() => {
    const client = createClient()
    client.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      client.from('profiles').select('timezone').eq('id', user.id).single().then(({ data }) => {
        const tz = data?.timezone || 'America/Sao_Paulo'
        setTimezone(tz)
        setDataHora(dataLocalParaInput(tz))
      })
    })
  }, [])

  useEffect(() => {
    fetch('/api/contas').then(r => r.json()).then(d => setContas(d.contas || []))
  }, [])

  useEffect(() => {
    fetch('/api/categorias')
      .then(r => r.json())
      .then(d => {
        const nomes = (d.categorias || []).map((c: { nome: string }) => c.nome) as string[]
        setCategoriasCustom(nomes)
      })
  }, [])

  // ─── Web Share Target — callback chamado pelo ShareTargetLoader ───────────
  async function processarArquivoCompartilhado(sharePath: string) {
    const client = createClient()
    const { data: { user } } = await client.auth.getUser()
    if (!user) return

    const { data, error } = await client.storage.from('uploads').download(sharePath)
    if (error || !data) { setErro('Não foi possível carregar o arquivo compartilhado.'); return }

    const nomeOriginal = sharePath.split('/').pop() || 'arquivo'
    const arquivo = new File([data], nomeOriginal, { type: data.type })
    setUploadAberto(true)
    handleUpload(arquivo)
    client.storage.from('uploads').remove([sharePath]).then(() => null)
  }

  const carregarHistorico = useCallback(async (contaFiltro?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUserId(user.id)
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('data_hora', { ascending: false })
      .limit(50)
    if (contaFiltro === '__sem_conta__') query = query.is('conta_id', null)
    else if (contaFiltro) query = query.eq('conta_id', contaFiltro)
    const { data } = await query
    if (data) setHistorico(data)
  }, [supabase, router])

useEffect(() => {
  // eslint-disable-next-line react-hooks/set-state-in-effect
  carregarHistorico(filtroContaId || undefined)
}, [carregarHistorico, filtroContaId])

// eslint-disable-next-line react-hooks/set-state-in-effect
useEffect(() => { carregarImportacoes() }, [carregarImportacoes])

  useEffect(() => {
    if (!userId) return
    const channel = supabase
      .channel('lancamento-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${userId}` }, () => { carregarHistorico() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tipo !== 'debito') { setAlertaOrcamento(null); return }
    const mes = new Date().toISOString().slice(0, 7)
    fetch(`/api/orcamento/check?categoria=${encodeURIComponent(categoria)}&mes=${mes}`)
      .then(r => r.json())
       
      .then(d => setAlertaOrcamento(d.limite != null ? d : null))
       
      .catch(() => setAlertaOrcamento(null))
   
  }, [categoria, tipo])

  function handleSetTipo(t: 'debito' | 'credito') {
    setTipo(t)
    setCategoria(t === 'debito' ? 'Alimentação' : 'Salário')
  }

  function aplicarAtalho(atalho: typeof ATALHOS[0]) {
    handleSetTipo(atalho.tipo as 'debito' | 'credito')
    setDescricao(atalho.label)
    setCategoria(atalho.cat)
  }

  function formatarValor(raw: string) {
    const numeros = raw.replace(/\D/g, '')
    if (!numeros) return ''
    const numero = parseInt(numeros) / 100
    return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function valorNumerico() {
    return parseFloat(valor.replace(/\./g, '').replace(',', '.')) || 0
  }

  async function abrirModalNovaConta() {
    if (bancosLista.length === 0) {
      const res = await fetch('/api/bancos')
      const d = await res.json()
      setBancosLista(d.bancos || [])
    }
    setErroNovaConta('')
    setFormNovaConta({ banco_id: '', nome: '', tipo: 'corrente', numero: '', agencia: '', mostrar_saldo: true, saldo_inicial: '' })
    setBuscaBancoModal('')
    setModalNovaConta(true)
  }

  async function criarContaRapida() {
    if (!formNovaConta.banco_id) return
    setSalvandoConta(true)
    const nome = formNovaConta.nome || (bancoNaoEncontrado ? `Conta ${bancoNaoEncontrado}` : 'Minha Conta')
    const res = await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formNovaConta, nome }),
    })
    const data = await res.json()
    setSalvandoConta(false)
    if (!data.ok) { setErroNovaConta(data.error || 'Erro ao salvar'); return }
    const contasRes = await fetch('/api/contas')
    const contasDados = await contasRes.json()
    setContas(contasDados.contas || [])
    setContaUpload(data.conta.id)
    setModalContaNaoEncontrada(false)
    // Auto-categoriza não categorizados como Outros e avança direto para confirmação
    setTransacoesDetectadas(prev => prev.map(t =>
      t.nao_categorizado ? { ...t, categoria: 'Outros', nao_categorizado: false } : t
    ))
    setEtapaConfirmacao(true)
  }

  async function salvarNovaConta(e: React.FormEvent) {
    e.preventDefault()
    if (!formNovaConta.banco_id) { setErroNovaConta('Selecione um banco'); return }
    if (!formNovaConta.nome.trim()) { setErroNovaConta('Nome da conta obrigatório'); return }
    setSalvandoConta(true); setErroNovaConta('')
    const res = await fetch('/api/contas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formNovaConta),
    })
    const data = await res.json()
    setSalvandoConta(false)
    if (!data.ok) { setErroNovaConta(data.error || 'Erro ao salvar'); return }
    const contasRes = await fetch('/api/contas')
    const contasDados = await contasRes.json()
    setContas(contasDados.contas || [])
    setContaUpload(data.conta.id)
    setModalNovaConta(false)
    setContaInlineAberta(false)
  }

  async function salvarInterno(opts?: { tipoOv?: string; valorOv?: number; descricaoOv?: string; categoriaOv?: string }) {
    setErro('')
    const v = opts?.valorOv ?? valorNumerico()
    const desc = opts?.descricaoOv ?? descricao
    const tip  = (opts?.tipoOv ?? tipo) as 'debito' | 'credito'
    const cat  = opts?.categoriaOv ?? categoria
    if (!v || v <= 0) { setErro('Digite um valor válido'); return false }
    if (!desc.trim()) { setErro('Digite uma descrição'); return false }
    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSalvando(false); return false }
    const { error } = await supabase.from('transactions').insert({
      user_id: user.id,
      descricao: desc.trim().toUpperCase(),
      valor: tip === 'debito' ? -v : v,
      tipo: tip,
      categoria: cat,
      data_hora: inputParaUTC(dataHora, timezone),
      origem: 'manual',
      conta_id: contaSelecionada || null,
    })
    if (error) { setErro('Erro ao salvar: ' + error.message); setSalvando(false); return false }
    setSalvando(false)
    setSucesso(true)
    setValor('')
    setDescricao('')
    setDataHora(dataLocalParaInput(timezone))
    return true
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (dataHora && new Date(dataHora) > new Date()) {
      const ok = confirm('A data informada é no futuro. Deseja continuar?')
      if (!ok) return
    }
    await salvarInterno()
    carregarHistorico()
    setTimeout(() => setSucesso(false), 2500)
  }

  async function handleUpload(arquivo: File) {
    if (!arquivo) return
    if (arquivo.size > 15 * 1024 * 1024) { setErro('Arquivo muito grande. Máx 15MB'); return }
    setProcessan(true)
    setTransacoesDetectadas([])
    setEditandoCategoriaIdx(null)
    setErro('')

    const nomeArq = arquivo.name.toLowerCase()
    const isPDF = nomeArq.endsWith('.pdf')
    const isOFX = nomeArq.endsWith('.ofx') || nomeArq.endsWith('.ofc')
    const formato = isPDF ? 'pdf' : isOFX ? 'ofx' : nomeArq.endsWith('.csv') ? 'csv' : 'imagem'
    setUploadMeta({ arquivo_nome: arquivo.name, formato })
    const uploadForm = new FormData()
    uploadForm.append('arquivo', arquivo)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any
    try {
      setEtapa(isPDF ? '📄 Enviando PDF para a IA...' : isOFX ? '🏦 Lendo arquivo OFX...' : '🤖 Analisando com IA...')
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 90_000) // 90s timeout cliente
      try {
        const res = await fetch('/api/lancamento/upload', { method: 'POST', body: uploadForm, signal: ctrl.signal })
        clearTimeout(timer)
        data = await res.json()
      } finally {
        clearTimeout(timer)
      }
    } catch (err) {
      setProcessan(false)
      setEtapa('')
      const msg = err instanceof Error ? err.message : 'falha na conexão'
      if (msg.includes('abort') || msg.includes('timeout')) {
        setErro('O processamento demorou muito. Tente um arquivo menor ou aguarde e tente novamente.')
      } else {
        setErro(`Erro ao enviar arquivo: ${msg}`)
      }
      return
    }
    setProcessan(false)
    setEtapa('')
    setCsvDebug(data._csv_debug || '')
    setLacunas(data.lacunas || [])
    if (!data.ok || !data.transacoes?.length) {
      setErro(data.error || 'Não foi possível extrair transações do documento')
      return
    }
    const comDuplicatas = detectarDuplicatas(data.transacoes, historico)
    setTransacoesDetectadas(comDuplicatas)
    setResumo(data.resumo || `${data.transacoes.length} transações encontradas`)
    setTipoDocumento(data.tipo_documento || '')
    setImportacaoOrigemId(data.importacao_origem_id || null)

    // Conta exata encontrada (match por número ou banco+agência)
    if (data.conta_id) {
      setContaUpload(data.conta_id)
      const contaEncontrada = contas.find(c => c.id === data.conta_id)
      if (contaEncontrada?.bancos) setBancoDetectado(contaEncontrada.bancos)
    }
    // Conta não encontrada, mas banco identificado → pré-preenche form de nova conta
    else if (data.conta_sugerida) {
      const sug = data.conta_sugerida
      if (bancosLista.length === 0) {
        const d = await (await fetch('/api/bancos')).json()
        setBancosLista(d.bancos || [])
      }
      setFormNovaConta(prev => ({
        ...prev,
        banco_id: sug.banco_id || '',
        agencia:  sug.agencia  || '',
        numero:   sug.numero   || '',
        nome:     sug.titular  || (sug.banco_nome ? `Conta ${sug.banco_nome}` : ''),
      }))
      setBancoNaoEncontrado(sug.banco_nome || 'Banco detectado')
      setModalContaNaoEncontrada(true)
    }
    // Fallback legado (CSV sem conta_sugerida)
    else if (data.banco_nao_encontrado) {
      setBancoNaoEncontrado(data.banco_nome || 'Desconhecido')
      setModalContaNaoEncontrada(true)
    }
    else if (data.banco_id && !data.conta_id) {
      const bancoDados = await (await fetch('/api/bancos')).json()
      const banco = bancoDados.bancos?.find((b: { id: string }) => b.id === data.banco_id)
      if (banco) {
        setBancoDetectado(banco)
        const contasBanco = contas.filter(c => c.bancos?.id === banco.id)
        if (contasBanco.length === 1) setContaUpload(contasBanco[0].id)
      }
    }
  }

  function editarTransacao(i: number, campo: string, val: string) {
    setTransacoesDetectadas(prev => prev.map((t, idx) =>
      idx === i ? { ...t, [campo]: val, ...(campo === 'categoria' ? { nao_categorizado: false } : {}) } : t
    ))
  }

  function removerTransacao(i: number) {
    if (!confirm('Remover esta transação do lote?')) return
    setTransacoesDetectadas(prev => prev.filter((_, idx) => idx !== i))
    setEditandoCategoriaIdx(null)
  }

  function categorizarNaoCategorizadosComoOutros() {
    setTransacoesDetectadas(prev => prev.map(t =>
      t.nao_categorizado ? { ...t, categoria: 'Outros', nao_categorizado: false } : t
    ))
  }

  function detectarDuplicatas(detectadas: TransacaoDetectada[], existentes: Transacao[]): TransacaoDetectada[] {
    return detectadas.map(t => {
      // Confirmada pelo servidor via ref_externa — não precisa checar mais nada
      if (t.confirmada_duplicata) return t

      // Importadas (OFX/CSV/PDF) têm ref_externa — datas são definitivas, não aplicar fuzzy.
      // Parcelas com mesmo valor mas datas diferentes são sempre lançamentos distintos.
      // O servidor já fez a verificação exata para esses casos.
      if (t.ref_externa) return t

      const valorAbs = Math.abs(t.valor)
      const dataT = new Date(t.data_hora)

      // Fuzzy só para lançamentos manuais (sem ref_externa): mesmo valor+descrição ±1 dia (fuso)
      const matchHistorico = existentes.find(e => {
        if (e.origem !== 'manual') return false
        const diff = Math.abs(new Date(e.data_hora).getTime() - dataT.getTime())
        return Math.abs(e.valor) === valorAbs && diff <= 1 * 24 * 60 * 60 * 1000 &&
          e.descricao.toLowerCase().trim() === t.descricao.toLowerCase().trim()
      })
      if (matchHistorico) return {
        ...t, potencial_duplicata: true, duplicata_origem: 'historico' as const,
        conflito_data: matchHistorico.data_hora,
        conflito_descricao: matchHistorico.descricao,
      }
      // Potencial duplicata dentro do próprio lote (mesmo segundo — entrada duplicada)
      const duplicataLote = detectadas.some((other) =>
        other !== t &&
        Math.abs(other.valor) === valorAbs &&
        other.descricao.toLowerCase().trim() === t.descricao.toLowerCase().trim() &&
        Math.abs(new Date(other.data_hora).getTime() - dataT.getTime()) < 60 * 1000
      )
      if (duplicataLote) return { ...t, potencial_duplicata: true, duplicata_origem: 'lote' as const }
      return t
    })
  }

  function descartarDuplicatas() {
    setTransacoesDetectadas(prev => prev.filter(t => !t.potencial_duplicata))
  }

  function desmarcarDuplicata(i: number) {
    setTransacoesDetectadas(prev => prev.map((t, idx) =>
      idx === i ? { ...t, potencial_duplicata: false, duplicata_origem: undefined } : t
    ))
  }

  async function confirmarLancamentos(forcarDuplicatas = false) {
    // Se ainda há potenciais duplicatas e o usuário não confirmou, abre modal
    if (!forcarDuplicatas && transacoesDetectadas.some(t => t.potencial_duplicata)) {
      setModalDuplicatas(true)
      return
    }
    setConfirman(true)
    const res = await fetch('/api/lancamento/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transacoes: transacoesDetectadas,
        conta_id: contaUpload || null,
        arquivo_nome: uploadMeta?.arquivo_nome || null,
        formato: uploadMeta?.formato || null,
        banco_nome: bancoDetectado?.nome_curto || null,
        total_detectadas: transacoesDetectadas.length,
      }),
    })
    const data = await res.json()
    setConfirman(false)
    // DEBUG TEMPORÁRIO — mostra na tela
    if (data._debug) {
      alert('DEBUG CONFIRMAR:\n' + JSON.stringify(data._debug, null, 2))
    }
    if (data.ok) {
      setTransacoesDetectadas([])
      // Calcula intervalo de datas das transações importadas para o toast
      const datas = transacoesDetectadas
        .filter(t => !t.confirmada_duplicata)
        .map(t => t.data_hora)
        .sort()
      const dataInicio = datas[0]?.slice(0, 10)
      const dataFim    = datas[datas.length - 1]?.slice(0, 10)

      setTransacoesDetectadas([])
      setResumo('')
      setBancoDetectado(null)
      setContaUpload('')
      setUploadMeta(null)
      setEtapaConfirmacao(false)
      setContaInlineAberta(false)
      setImportacaoOrigemId(null)
      carregarHistorico()
      carregarImportacoes()
      setToastImport({ lancados: data.lançados ?? 0, duplicatas: data.duplicatas_ignoradas ?? 0, dataInicio, dataFim })
      setTimeout(() => setToastImport(null), 12000)
    } else {
      setErro(data.error || 'Erro ao confirmar')
    }
  }

  async function deletar(id: string) {
    setDeletando(id)
    await fetch(`/api/lancamento/${id}`, { method: 'DELETE' })
    setDeletando(null)
    carregarHistorico()
  }

  // ─── seleção em lote ───
  function toggleSelecionado(id: string) {
    setSelecionados(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  function toggleTodos() {
    setSelecionados(prev => prev.length === historico.length ? [] : historico.map(t => t.id))
  }

  async function excluirSelecionados() {
    if (!selecionados.length) return
    if (!confirm(`Excluir ${selecionados.length} transaç${selecionados.length > 1 ? 'ões' : 'ão'}? Esta ação não pode ser desfeita.`)) return
    setExcluindoLote(true)
    await Promise.all(selecionados.map(id => fetch(`/api/lancamento/${id}`, { method: 'DELETE' })))
    setSelecionados([])
    setExcluindoLote(false)
    carregarHistorico()
  }

  async function moverParaConta() {
    if (!selecionados.length || !contaDestino) return
    setMovendo(true)
    await Promise.all(
      selecionados.map(id =>
        fetch(`/api/lancamento/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conta_id: contaDestino }),
        })
      )
    )
    setSelecionados([])
    setContaDestino('')
    setMovendo(false)
    carregarHistorico()
  }

  // ─── modal edição ───
  function abrirEdicao(t: Transacao) {
    setTransacaoEditando(t)
    setEditDescricao(t.descricao)
    setEditCategoria(t.categoria)
    setEditContaId(t.conta_id || '')
    setEditDataHora(t.data_hora ? new Date(t.data_hora).toISOString().slice(0, 16) : '')
    setEditValor(Math.abs(t.valor).toFixed(2).replace('.', ','))
    setEditTipo(t.tipo as 'debito' | 'credito')
    setModalAberto(true)
  }

  async function salvarEdicao() {
    if (!transacaoEditando) return
    setSalvandoEdicao(true)
    await fetch(`/api/lancamento/${transacaoEditando.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        descricao: editDescricao.toUpperCase(),
        categoria: editCategoria,
        conta_id: editContaId || null,
        data_hora: editDataHora ? new Date(editDataHora).toISOString() : transacaoEditando.data_hora,
        valor: editTipo === 'debito'
          ? -Math.abs(parseFloat(editValor.replace(',', '.')) || 0)
          : Math.abs(parseFloat(editValor.replace(',', '.')) || 0),
        tipo: editTipo,
      }),
    })
    setSalvandoEdicao(false)
    setModalAberto(false)
    setTransacaoEditando(null)
    carregarHistorico()
  }

  async function salvarNovaCategoria() {
    const nova = novaCategInput.trim()
    if (!nova || nova.length < 2) return
    if (!categoriasCustom.includes(nova)) {
      await fetch('/api/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nova, cor: '#6b7280', icone: '📌', tipo: 'ambos' }),
      })
      setCategoriasCustom(prev => [...prev, nova])
    }
    setCategoria(nova)
    setNovaCategInput('')
    setAdicionandoCateg(false)
  }

  const categorias = [...(tipo === 'debito' ? CATEGORIAS_DESPESA : CATEGORIAS_RECEITA), ...categoriasCustom.filter(c => !TODAS_CATEGORIAS.includes(c))]
  const todasCategorias = [...TODAS_CATEGORIAS, ...categoriasCustom.filter(c => !TODAS_CATEGORIAS.includes(c))]
  const tips = useTips()

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', fontFamily: 'system-ui, sans-serif', fontSize: 15, color: '#fff' }}>

      <Suspense fallback={null}>
        <ShareTargetLoader onShare={processarArquivoCompartilhado} onErro={setErro} />
      </Suspense>

      {/* ─── Modal: confirmação de potenciais duplicatas ─── */}
      {modalDuplicatas && (() => {
        const qtd = transacoesDetectadas.filter(t => t.potencial_duplicata).length
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{ background: '#0f1f0f', border: '1px solid rgba(249,115,22,.35)', borderRadius: 14, padding: 24, maxWidth: 420, width: '100%' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>🔁 Possíveis duplicatas detectadas</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6, marginBottom: 20 }}>
                {qtd} lançamento{qtd > 1 ? 's têm' : ' tem'} o mesmo valor e data próxima de registros já existentes no histórico.
                <br />Deseja lançar mesmo assim?
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => { setModalDuplicatas(false); descartarDuplicatas() }}
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid rgba(249,115,22,.4)', borderRadius: 8, color: '#f97316', fontSize: 13, cursor: 'pointer' }}>
                  Descartar {qtd} duplicata{qtd > 1 ? 's' : ''}
                </button>
                <button
                  onClick={() => { setModalDuplicatas(false); confirmarLancamentos(true) }}
                  style={{ flex: 1, padding: '10px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  Lançar mesmo assim
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ─── Toast pós-importação ─── */}
      {toastImport && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', right: 24, zIndex: 1100,
          background: '#0f1f0f', border: '1px solid rgba(74,222,128,.35)',
          borderRadius: 12, padding: '14px 18px', minWidth: 260, maxWidth: 340,
          boxShadow: '0 8px 32px rgba(0,0,0,.6)',
          animation: 'toastIn .25s ease',
        }}>
          <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(12px) } to { opacity:1; transform:translateY(0) } }`}</style>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(74,222,128,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polyline points="2,8 6,12 14,4" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', marginBottom: 4 }}>Importação concluída</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', lineHeight: 1.5 }}>
                <span style={{ color: '#fff', fontWeight: 500 }}>{toastImport.lancados}</span> lançamento{toastImport.lancados !== 1 ? 's' : ''} inserido{toastImport.lancados !== 1 ? 's' : ''}
                {toastImport.duplicatas > 0 && (
                  <> · <span style={{ color: 'rgba(239,68,68,.8)', fontWeight: 500 }}>{toastImport.duplicatas}</span> duplicata{toastImport.duplicatas !== 1 ? 's' : ''} ignorada{toastImport.duplicatas !== 1 ? 's' : ''}</>
                )}
              </div>
              {toastImport.dataInicio && toastImport.dataFim && toastImport.lancados > 0 && (
                <button
                  onClick={() => {
                    setToastImport(null)
                    router.push(`/dashboard/gastos?de=${toastImport.dataInicio}&ate=${toastImport.dataFim}`)
                  }}
                  style={{ marginTop: 8, fontSize: 11, color: '#4ade80', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left' }}
                >
                  Ver no extrato ({new Date(toastImport.dataInicio + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → {new Date(toastImport.dataFim + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}) →
                </button>
              )}
            </div>
            <button onClick={() => setToastImport(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)', fontSize: 16, lineHeight: 1, flexShrink: 0, padding: 0 }}>×</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '.875rem 1.5rem', borderBottom: '1px solid #1a3a1a', background: '#0a1a0a', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, minHeight: 44, padding: '0 8px', margin: '0 -8px' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </button>
        <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Lançamento</span>
      </div>

      <div className="lancamento-grid" style={{ display: 'grid', gridTemplateColumns: '420px 1fr', minHeight: 'calc(100vh - 53px)' }}>

        {/* ─── Formulário ─── */}
        <div style={{ borderRight: '1px solid #1a3a1a', padding: '1.5rem', overflowY: 'auto' }}>

          <div style={{ display: 'flex', background: 'rgba(0,0,0,.4)', border: '1px solid #1a3a1a', borderRadius: 12, padding: 4, marginBottom: '1.5rem' }}>
            {(['debito', 'credito'] as const).map(t => (
              <button key={t} onClick={() => handleSetTipo(t)} style={{
                flex: 1, padding: '10px', minHeight: 44, borderRadius: 9, border: 'none', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, transition: 'all .2s',
                background: tipo === t ? (t === 'debito' ? 'rgba(239,68,68,.2)' : 'rgba(22,163,74,.2)') : 'transparent',
                color: tipo === t ? (t === 'debito' ? '#f87171' : '#4ade80') : 'rgba(255,255,255,.3)',
                borderBottom: tipo === t ? `2px solid ${t === 'debito' ? '#f87171' : '#4ade80'}` : '2px solid transparent',
              }}>
                {t === 'debito' ? '↓ Despesa' : '↑ Receita'}
              </button>
            ))}
          </div>

          {/* ── Voz (inline abaixo do toggle) ── */}
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'rgba(255,255,255,.02)', border: '1px solid rgba(74,222,128,.1)', borderRadius: 10 }}>
            <button
              type="button"
              onClick={vozGravando ? pararVoz : iniciarVoz}
              disabled={vozProcessando}
              title={vozGravando ? 'Parar gravação' : 'Lançar por voz'}
              style={{
                width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: vozProcessando ? 'default' : 'pointer', flexShrink: 0,
                background: vozGravando ? 'rgba(239,68,68,.2)' : 'rgba(74,222,128,.12)',
                outline: vozGravando ? '3px solid rgba(239,68,68,.4)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all .2s',
                animation: vozGravando ? 'vozPulse 1s ease-in-out infinite' : 'none',
                opacity: vozProcessando ? 0.6 : 1,
              }}
            >
              {vozProcessando
                ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeOpacity=".3"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur=".8s" repeatCount="indefinite"/></path></svg>
                : vozGravando
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="#f87171"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 19v4M8 23h8"/></svg>
              }
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: vozGravando ? '#f87171' : vozProcessando ? '#4ade80' : 'rgba(255,255,255,.5)' }}>
                {vozGravando ? '🔴 Ouvindo... fale agora' : vozProcessando ? 'Processando...' : 'Falar para lançar'}
              </div>
              {vozTranscricao && !vozErro && (
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  &ldquo;{vozTranscricao}&rdquo;
                </div>
              )}
              {vozErro && <div style={{ fontSize: 10, color: '#f87171' }}>{vozErro}</div>}
            </div>
            <style>{`@keyframes vozPulse { 0%,100%{outline-width:2px;outline-color:rgba(239,68,68,.4)} 50%{outline-width:5px;outline-color:rgba(239,68,68,.12)} }`}</style>
          </div>

          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Valor</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ fontSize: 22, color: 'rgba(255,255,255,.3)', fontWeight: 300 }}>R$</span>
              <input type="text" inputMode="numeric" value={valor}
                onChange={e => setValor(formatarValor(e.target.value))} placeholder="0,00"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 42, fontWeight: 700, textAlign: 'center', color: tipo === 'debito' ? '#f87171' : '#4ade80', width: 220 }}
              />
            </div>
            <div style={{ height: 2, background: tipo === 'debito' ? 'rgba(248,113,113,.3)' : 'rgba(74,222,128,.3)', borderRadius: 1, margin: '8px auto 0', width: 200 }} />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Atalhos rápidos</div>
            <TipCard id="tip-atalhos" icon="⚡" tips={tips}
              text="Clique num atalho para preencher descrição e categoria automaticamente. Seus favoritos aparecem aqui." />
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 4 : 0 }}>
              {ATALHOS.filter(a => a.tipo === tipo).map(a => (
                <button key={a.label} onClick={() => aplicarAtalho(a)} style={{
                  padding: '5px 12px', borderRadius: 20, border: `1px solid ${CORES[a.cat] || '#1a3a1a'}22`,
                  background: descricao === a.label ? `${CORES[a.cat]}22` : 'rgba(255,255,255,.04)',
                  color: descricao === a.label ? CORES[a.cat] || '#fff' : 'rgba(255,255,255,.5)',
                  fontSize: 11, cursor: 'pointer', transition: 'all .15s', flexShrink: 0,
                }}>{a.label}</button>
              ))}
            </div>
          </div>

          <form onSubmit={salvar}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Descrição</label>
              <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex: Almoço, Gasolina, Netflix..." required
                style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Categoria</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto', flexWrap: isMobile ? 'nowrap' : 'wrap', paddingBottom: isMobile ? 4 : 0 }}>
                {categorias.map(c => (
                  <button key={c} type="button" onClick={() => setCategoria(c)} style={{
                    padding: isMobile ? '6px 12px' : '8px 14px', minHeight: 36, borderRadius: 20, border: `1px solid ${categoria === c ? CORES[c] || '#4ade80' : '#1a3a1a'}`,
                    background: categoria === c ? `${CORES[c] || '#4ade80'}18` : 'transparent',
                    color: categoria === c ? CORES[c] || '#4ade80' : 'rgba(255,255,255,.4)',
                    fontSize: 12, cursor: 'pointer', transition: 'all .15s', fontWeight: categoria === c ? 500 : 400, flexShrink: 0,
                  }}>{c}</button>
                ))}
                {adicionandoCateg ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      autoFocus
                      value={novaCategInput}
                      onChange={e => setNovaCategInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarNovaCategoria() } if (e.key === 'Escape') { setAdicionandoCateg(false); setNovaCategInput('') } }}
                      placeholder="Nova categoria..."
                      style={{ padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.06)', color: '#fff', fontSize: 11, outline: 'none', width: 130 }}
                    />
                    <button type="button" onClick={salvarNovaCategoria} style={{ padding: '4px 8px', borderRadius: 20, border: '1px solid #4ade80', background: 'rgba(74,222,128,.12)', color: '#4ade80', fontSize: 11, cursor: 'pointer' }}>✓</button>
                    <button type="button" onClick={() => { setAdicionandoCateg(false); setNovaCategInput('') }} style={{ padding: '4px 8px', borderRadius: 20, border: '1px solid rgba(255,255,255,.1)', background: 'transparent', color: 'rgba(255,255,255,.3)', fontSize: 11, cursor: 'pointer' }}>✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAdicionandoCateg(true)} style={{
                    padding: '5px 12px', borderRadius: 20, border: '1px dashed rgba(255,255,255,.15)',
                    background: 'transparent', color: 'rgba(255,255,255,.3)', fontSize: 11, cursor: 'pointer',
                  }}>+ Nova</button>
                )}
              </div>
            </div>

            {/* ── Mais opções (conta, data, recorrente) ── */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setMaisOpcoes(v => !v)}
                style={{ width: '100%', marginBottom: 12, padding: '8px 12px', background: 'rgba(255,255,255,.03)', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.45)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span>
                  {contaSelecionada ? `🏦 ${contas.find(c => c.id === contaSelecionada)?.nome || 'Conta selecionada'}` : recorrente ? '🔁 Recorrente · Mais opções' : '+ Conta, data e opções'}
                </span>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform .2s', transform: maisOpcoes ? 'rotate(180deg)' : 'none' }}>
                  <path d="M2 3.5l3 3 3-3" stroke="rgba(255,255,255,.3)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}

            {(!isMobile || maisOpcoes) && (<>
            {contas.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Conta (opcional)</label>
                <TipCard id="tip-conta-manual" icon="🏦" tips={tips} accent="#22d3ee"
                  text="Vincule o lançamento a uma conta para manter os <strong>saldos sempre atualizados</strong>. Sem vínculo, a transação fica no histórico geral." />
                <select value={contaSelecionada} onChange={e => setConta(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                  <option value="">Sem conta específica</option>
                  {contas.map(c => (
                    <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome} ({c.tipo})</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.05em' }}>Data e hora</label>
              <input type="datetime-local" value={dataHora} onChange={e => setDataHora(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            <div onClick={() => setRecorrente(!recorrente)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem', padding: '10px 12px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, cursor: 'pointer' }}>
              <div style={{ width: 18, height: 18, borderRadius: 4, border: `1.5px solid ${recorrente ? '#16a34a' : '#1a3a1a'}`, background: recorrente ? '#16a34a' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                {recorrente && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Lançamento recorrente</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>Marcar como gasto fixo mensal</div>
              </div>
            </div>
            </>)}

            {alertaOrcamento && (
              <div style={{
                background: alertaOrcamento.excedido ? 'rgba(239,68,68,.1)' : 'rgba(251,191,36,.08)',
                border: `1px solid ${alertaOrcamento.excedido ? 'rgba(239,68,68,.35)' : 'rgba(251,191,36,.35)'}`,
                borderLeft: `3px solid ${alertaOrcamento.excedido ? '#f87171' : '#fbbf24'}`,
                borderRadius: 8, padding: '8px 12px', fontSize: 12,
                color: alertaOrcamento.excedido ? '#f87171' : '#fbbf24',
                marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 15 }}>{alertaOrcamento.excedido ? '🚨' : '⚠️'}</span>
                <span>
                  {alertaOrcamento.excedido
                    ? <>Orçamento de <strong>{categoria}</strong> estourado! Gasto R$ {alertaOrcamento.gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ {alertaOrcamento.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.</>
                    : <>Orçamento de <strong>{categoria}</strong>: {Math.round(alertaOrcamento.percentual * 100)}% usado (R$ {alertaOrcamento.gasto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de R$ {alertaOrcamento.limite.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).</>
                  }
                </span>
              </div>
            )}
            {erro && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}
            {sucesso && (
              <div style={{ background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#4ade80', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Lançamento salvo com sucesso!
              </div>
            )}

            <button type="submit" disabled={salvando} style={{
              width: '100%', padding: 13,
              background: tipo === 'debito' ? 'rgba(239,68,68,.2)' : '#16a34a',
              border: `1px solid ${tipo === 'debito' ? 'rgba(239,68,68,.4)' : '#16a34a'}`,
              borderRadius: 10, color: tipo === 'debito' ? '#f87171' : '#fff',
              fontSize: 14, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1, transition: 'all .15s',
            }}>
              {salvando ? 'Salvando...' : `Lançar ${tipo === 'debito' ? 'despesa' : 'receita'}${valor ? ' de R$ ' + valor : ''}`}
            </button>
          </form>

          {/* Upload */}
          <div data-tour="tour-importar" style={{ marginTop: '1.5rem', borderTop: '1px solid #1a3a1a', paddingTop: '1rem' }}>

            {/* Cabeçalho da seção — no mobile vira botão toggle */}
            <button
              type="button"
              onClick={() => isMobile ? setUploadAberto(v => !v) : undefined}
              style={{ width: '100%', background: 'none', border: 'none', cursor: isMobile ? 'pointer' : 'default', padding: 0, textAlign: 'left', marginBottom: isMobile ? (uploadAberto ? 12 : 0) : 4 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 600 }}>📎 Importar extrato ou fatura</div>
                  <span style={{ fontSize: 10, background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', color: '#4ade80', padding: '2px 8px', borderRadius: 10 }}>IA</span>
                </div>
                {isMobile && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transition: 'transform .2s', transform: uploadAberto ? 'rotate(180deg)' : 'none' }}>
                    <path d="M2 3.5l3 3 3-3" stroke="rgba(255,255,255,.3)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              {!isMobile && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 4, marginBottom: 10 }}>
                  A IA lê o documento e lança todas as transações automaticamente — sem digitar nada.
                </div>
              )}
            </button>

            {/* No mobile, o conteúdo só aparece quando expandido; no desktop sempre visível */}
            {(!isMobile || uploadAberto) && (<>

            {/* Tip principal do upload — mostrada apenas antes do primeiro uso */}
            <TipCard id="tip-upload-intro" icon="✨" tips={tips} accent="#a78bfa"
              text="<strong>Dica de primeiro uso:</strong> Vá ao app do seu banco → Extrato → Baixar OFX ou PDF, depois arraste o arquivo aqui. OFX é nativo (sem IA), PDF usa IA para detectar banco, datas e categorias." />

            {/* 4 passos — só no desktop e quando não há transações detectadas */}
            {transacoesDetectadas.length === 0 && !processando && !isMobile && (
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 6, marginBottom: 14 }}>
                {[
                  { n: '1', label: 'Envie', desc: 'PDF, imagem ou CSV', icon: '📤' },
                  { n: '2', label: 'IA analisa', desc: 'Detecta e categoriza', icon: '🤖' },
                  { n: '3', label: 'Revise', desc: 'Edite ou remova', icon: '✏️' },
                  { n: '4', label: 'Confirme', desc: 'Lança tudo de uma vez', icon: '✅' },
                ].map((step, i) => (
                  <div key={step.n} style={{
                    textAlign: 'center', padding: '10px 6px',
                    background: 'rgba(255,255,255,.02)',
                    border: '1px solid #1a3a1a',
                    borderRadius: 10,
                    position: 'relative',
                  }}>
                    {i < 3 && (
                      <div style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'rgba(255,255,255,.2)', zIndex: 1 }}>›</div>
                    )}
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{step.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', marginBottom: 2, letterSpacing: '.03em' }}>{step.label}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', lineHeight: 1.3 }}>{step.desc}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Drop zone */}
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files[0]) }}
              style={{
                border: `2px dashed ${dragOver ? '#4ade80' : '#1e3a1e'}`,
                borderRadius: 14,
                padding: dragOver ? '2rem 1.5rem' : '1.5rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: dragOver ? 'rgba(74,222,128,.06)' : 'rgba(255,255,255,.01)',
                transition: 'all .2s',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Glow de fundo animado quando hovering */}
              {dragOver && (
                <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(74,222,128,.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
              )}
              <div style={{ fontSize: dragOver ? 40 : 34, marginBottom: 10, transition: 'font-size .2s' }}>
                {dragOver ? '📂' : '📄'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: dragOver ? '#4ade80' : 'rgba(255,255,255,.6)', marginBottom: 4, transition: 'color .2s' }}>
                {dragOver ? 'Solte para enviar' : 'Clique ou arraste o arquivo aqui'}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginBottom: 10 }}>
                PDF · OFX · CSV · JPG · PNG — máx 15MB
              </div>
              {/* Tipos de documento */}
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { label: 'Extrato', icon: '🏦' },
                  { label: 'Fatura', icon: '💳' },
                  { label: 'Holerite', icon: '📋' },
                  { label: 'Nota fiscal', icon: '🧾' },
                  { label: 'Cupom', icon: '🏷️' },
                  { label: 'Recibo', icon: '📝' },
                ].map(t => (
                  <span key={t.label} style={{
                    fontSize: 10, padding: '3px 9px', borderRadius: 20,
                    background: 'rgba(255,255,255,.04)',
                    border: '1px solid rgba(255,255,255,.08)',
                    color: 'rgba(255,255,255,.45)',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 11 }}>{t.icon}</span>{t.label}
                  </span>
                ))}
              </div>
              <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.csv,.ofx,.ofc" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) { handleUpload(e.target.files[0]); e.target.value = '' } }} />
            </div>

            {/* Processando */}
            {processando && (
              <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(167,139,250,.06)', border: '1px solid rgba(167,139,250,.2)', borderRadius: 10 }}>
                <style>{`
                  @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
                  @keyframes pulse { 0%,100% { transform: scale(1); opacity:.8 } 50% { transform: scale(1.12); opacity:1 } }
                  @keyframes blink { 0%,100% { opacity: 1 } 50% { opacity: .4 } }
                `}</style>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: etapaUpload ? 10 : 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(167,139,250,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: 'pulse 1.5s ease-in-out infinite' }}>
                    🤖
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#a78bfa' }}>
                      {etapaUpload || 'Analisando com IA...'}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>Aguarde, este processo pode levar alguns segundos</div>
                  </div>
                </div>
                {/* Barra de progresso animada */}
                <div style={{ height: 3, background: 'rgba(167,139,250,.15)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #7c3aed, #a78bfa, #7c3aed)', backgroundSize: '200% 100%', animation: 'slide 1.8s linear infinite', borderRadius: 2 }} />
                </div>
                <style>{`@keyframes slide { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
              </div>
            )}

            {/* Erro de upload — exibido diretamente na área de upload */}
            {erro && !processando && transacoesDetectadas.length === 0 && (
              <div style={{ marginTop: 10, background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171' }}>
                ⚠️ {erro}
              </div>
            )}

            {/* Debug CSV — visível mesmo sem transações para diagnóstico */}
            {csvDebug && !processando && (
              <details style={{ marginTop: 10, marginBottom: 4 }}>
                <summary style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', cursor: 'pointer', userSelect: 'none', marginBottom: 6 }}>
                  🔍 CSV bruto gerado pela IA ({csvDebug.split('\n').length - 1} linhas) — clique para expandir
                </summary>
                <pre style={{
                  fontSize: 10, color: 'rgba(255,255,255,.6)', background: 'rgba(0,0,0,.35)',
                  border: '1px solid rgba(255,255,255,.08)', borderRadius: 6,
                  padding: '8px 10px', overflowX: 'auto', maxHeight: 320,
                  overflowY: 'auto', whiteSpace: 'pre', lineHeight: 1.6,
                }}>{csvDebug}</pre>
              </details>
            )}

            {lacunasDetectadas.length > 0 && !processando && (
              <div style={{ marginTop: 10, background: 'rgba(255,165,0,.12)', border: '1px solid rgba(255,165,0,.35)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#ffb347', marginBottom: 6 }}>
                  ⚠️ {lacunasDetectadas.length} possível{lacunasDetectadas.length > 1 ? 'is lacuna' : ' lacuna'} detectada{lacunasDetectadas.length > 1 ? 's' : ''} — revise o extrato original
                </div>
                {lacunasDetectadas.map((msg, i) => (
                  <div key={i} style={{ fontSize: 11, color: 'rgba(255,179,71,.8)', marginTop: 3 }}>{msg}</div>
                ))}
              </div>
            )}

            {transacoesDetectadas.length > 0 && !processando && (
              <div style={{ marginTop: 14 }}>

                {/* Aviso: arquivo já importado anteriormente */}
                {importacaoOrigemId && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24', marginBottom: 4 }}>
                        Este arquivo já foi importado anteriormente
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', marginBottom: 8, lineHeight: 1.5 }}>
                        A maioria dos lançamentos já existe no sistema. Veja o lote original antes de importar novamente.
                      </div>
                      <button
                        onClick={() => {
                          setFiltroImportacaoId(importacaoOrigemId)
                          setTransacoesDetectadas([])
                          setResumo('')
                          setImportacaoOrigemId(null)
                          document.getElementById('historico-lancamentos')?.scrollIntoView({ behavior: 'smooth' })
                        }}
                        style={{ fontSize: 11, padding: '5px 12px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 6, color: '#fbbf24', cursor: 'pointer' }}
                      >
                        Ver lote original →
                      </button>
                    </div>
                  </div>
                )}

                {/* Banner de sucesso da detecção */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 10, marginBottom: 14 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(74,222,128,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✅</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>{resumoDetectado}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>Revise, edite categorias e confirme a conta destino antes de lançar</div>
                  </div>
                </div>


                {/* Banco detectado + tipo de documento */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  {bancoDetectado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8 }}>
                      <div style={{ width: 18, height: 18, borderRadius: 3, background: bancoDetectado.cor || '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {bancoDetectado.nome_curto[0]}
                      </div>
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)' }}>{bancoDetectado.nome_curto}</span>
                    </div>
                  )}
                  {tipoDocumento && (
                    <div style={{ display: 'flex', alignItems: 'center', padding: '5px 10px', background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.15)', borderRadius: 8 }}>
                      <span style={{ fontSize: 11, color: 'rgba(74,222,128,.8)' }}>
                        {{ extrato_bancario: '🏦 Extrato', fatura_cartao: '💳 Fatura', nota_fiscal: '🧾 Nota fiscal', holerite: '📋 Holerite', recibo: '🧾 Recibo', outro: '📄 Documento' }[tipoDocumento] || tipoDocumento}
                      </span>
                    </div>
                  )}
                </div>

                {/* Vincular conta */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,.4)', marginBottom: 5, textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>Vincular à conta</label>
                  <TipCard id="tip-conta-upload" icon="💡" tips={tips} accent="#fbbf24"
                    text="Selecione a conta do extrato importado. Isso mantém o saldo da conta sempre correto. Ainda não tem? Cadastre uma clicando em <strong>＋ Cadastrar nova conta</strong> abaixo." />
                  <select
                    value={contaUpload}
                    onChange={e => {
                      if (e.target.value === '__nova__') {
                        setContaInlineAberta(true)
                        setContaUpload('')
                        setEtapaConfirmacao(false)
                        if (bancosLista.length === 0) fetch('/api/bancos').then(r => r.json()).then(d => setBancosLista(d.bancos || []))
                        setErroNovaConta('')
                        setFormNovaConta({ banco_id: '', nome: '', tipo: 'corrente', numero: '', agencia: '', mostrar_saldo: true, saldo_inicial: '' })
                        setBuscaBancoModal('')
                      } else {
                        setContaUpload(e.target.value)
                        setContaInlineAberta(false)
                        setEtapaConfirmacao(false)
                      }
                    }}
                    style={{ width: '100%', padding: '9px 12px', background: '#111', border: `1px solid ${contaInlineAberta ? '#4ade80' : '#1a3a1a'}`, borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}
                  >
                    <option value="">Sem conta específica</option>
                    {contas.filter(c => !bancoDetectado || c.bancos?.id === bancoDetectado.id).map(c => (
                      <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} — {c.nome}</option>
                    ))}
                    <option value="__nova__">＋ Cadastrar nova conta</option>
                  </select>

                  {/* ── Formulário inline de nova conta ── */}
                  {contaInlineAberta && (
                    <div style={{ marginTop: 10, background: '#0a1a0a', border: '1px solid #1a5a1a', borderRadius: 10, padding: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#4ade80' }}>Nova conta</span>
                        <button type="button" onClick={() => setContaInlineAberta(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 16, lineHeight: 1 }}>×</button>
                      </div>
                      <form onSubmit={salvarNovaConta} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

                        {/* Busca banco */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Banco</label>
                          <input
                            value={buscaBancoModal}
                            onChange={e => setBuscaBancoModal(e.target.value)}
                            placeholder="Buscar pelo nome ou código..."
                            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none', marginBottom: 6 }}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5, maxHeight: 130, overflowY: 'auto' }}>
                            {bancosLista
                              .filter(b => !buscaBancoModal || b.nome_curto.toLowerCase().includes(buscaBancoModal.toLowerCase()) || b.codigo.includes(buscaBancoModal))
                              .slice(0, 20)
                              .map(b => (
                                <button key={b.id} type="button"
                                  onClick={() => setFormNovaConta(p => ({ ...p, banco_id: b.id }))}
                                  style={{
                                    padding: '6px 4px', borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 500, textAlign: 'center',
                                    background: formNovaConta.banco_id === b.id ? `${b.cor || '#4ade80'}22` : 'rgba(255,255,255,.03)',
                                    border: `1px solid ${formNovaConta.banco_id === b.id ? b.cor || '#4ade80' : '#1a3a1a'}`,
                                    color: formNovaConta.banco_id === b.id ? b.cor || '#4ade80' : 'rgba(255,255,255,.5)',
                                  }}
                                >{b.nome_curto}</button>
                              ))}
                          </div>
                        </div>

                        {/* Nome da conta */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Nome da conta</label>
                          <input
                            value={formNovaConta.nome}
                            onChange={e => setFormNovaConta(p => ({ ...p, nome: e.target.value }))}
                            placeholder="Ex: Nubank pessoal..."
                            required
                            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none' }}
                          />
                        </div>

                        {/* Tipo */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Tipo</label>
                          <div style={{ display: 'flex', gap: 5 }}>
                            {(['corrente', 'poupança', 'crédito', 'investimento'] as const).map(t => (
                              <button key={t} type="button" onClick={() => setFormNovaConta(p => ({ ...p, tipo: t }))} style={{
                                flex: 1, padding: '6px 3px', borderRadius: 7, border: `1px solid ${formNovaConta.tipo === t ? '#4ade80' : '#1a3a1a'}`,
                                background: formNovaConta.tipo === t ? 'rgba(74,222,128,.12)' : 'transparent',
                                color: formNovaConta.tipo === t ? '#4ade80' : 'rgba(255,255,255,.4)', fontSize: 10, cursor: 'pointer',
                              }}>{t}</button>
                            ))}
                          </div>
                        </div>

                        {/* Saldo inicial */}
                        <div>
                          <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4 }}>Saldo inicial (opcional)</label>
                          <input type="number" value={formNovaConta.saldo_inicial} onChange={e => setFormNovaConta(p => ({ ...p, saldo_inicial: e.target.value }))}
                            placeholder="0,00" step="0.01" min="0"
                            style={{ width: '100%', padding: '8px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 12, outline: 'none' }} />
                        </div>

                        {erroNovaConta && (
                          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 7, padding: '7px 10px', fontSize: 11, color: '#f87171' }}>{erroNovaConta}</div>
                        )}

                        <div style={{ display: 'flex', gap: 7 }}>
                          <button type="button" onClick={() => setContaInlineAberta(false)}
                            style={{ flex: 1, padding: '8px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer' }}>
                            Cancelar
                          </button>
                          <button type="submit" disabled={salvandoConta}
                            style={{ flex: 2, padding: '8px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, fontWeight: 600, cursor: salvandoConta ? 'default' : 'pointer', opacity: salvandoConta ? 0.7 : 1 }}>
                            {salvandoConta ? 'Cadastrando...' : 'Cadastrar e vincular'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                {/* ── Transações prontas (sem nenhum problema) ─────────── */}
                {transacoesDetectadas.filter(t => !t.nao_categorizado && !t.confirmada_duplicata && !t.potencial_duplicata).length > 0 && (
                  <>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                      ✅ Prontas ({transacoesDetectadas.filter(t => !t.nao_categorizado && !t.confirmada_duplicata && !t.potencial_duplicata).length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto', marginBottom: 10 }}>
                      {transacoesDetectadas.map((t, i) => (t.nao_categorizado || t.confirmada_duplicata || t.potencial_duplicata) ? null : (
                        <div key={i} style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => removerTransacao(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input value={t.descricao} onChange={e => editarTransacao(i, 'descricao', e.target.value)}
                              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontWeight: 500, width: '100%', outline: 'none' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: `${CORES[t.categoria] || '#6b7280'}18`, color: CORES[t.categoria] || '#6b7280', border: `1px solid ${CORES[t.categoria] || '#6b7280'}33`, cursor: 'pointer' }}
                                onClick={() => setEditandoCategoriaIdx(editandoCategoriaIdx === i ? null : i)}>
                                {t.categoria} ▾
                              </span>
                              {t.origem_categoria === 'aprendido' && (
                                <span title="Categoria memorizada de importações anteriores" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(168,85,247,.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,.25)' }}>🧠</span>
                              )}
                              {t.origem_categoria === 'ia' && !t.nao_categorizado && (
                                <span title="Categoria sugerida pela IA" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(34,211,238,.08)', color: '#67e8f9', border: '1px solid rgba(34,211,238,.2)' }}>🤖</span>
                              )}
                              {t.origem_categoria === 'padrao' && !t.nao_categorizado && (
                                <span title="Categoria detectada por palavra-chave" style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(251,191,36,.08)', color: '#fcd34d', border: '1px solid rgba(251,191,36,.2)' }}>🔑</span>
                              )}
                              {editandoCategoriaIdx === i && (
                                <select autoFocus value={t.categoria}
                                  onChange={e => { editarTransacao(i, 'categoria', e.target.value); setEditandoCategoriaIdx(null) }}
                                  onBlur={() => setEditandoCategoriaIdx(null)}
                                  style={{ fontSize: 11, padding: '2px 6px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 6, color: '#fff', outline: 'none' }}>
                                  {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              )}
                              {t.tipo_pagamento && (
                                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.35)', border: '1px solid rgba(255,255,255,.1)' }}>
                                  {t.tipo_pagamento}
                                </span>
                              )}
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {t.tipo === 'credito' ? '+' : '-'}R$ {Math.abs(t.valor).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* ── Pagamento de fatura (entrada circular — excluído por padrão) ── */}
                {transacoesDetectadas.filter(t => t.e_pagamento_fatura).length > 0 && (
                  <div style={{ background: 'rgba(168,85,247,.05)', border: '1px solid rgba(168,85,247,.3)', borderRadius: 10, padding: '10px', marginBottom: 10 }}>
                    <div style={{ fontSize: 10, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600, marginBottom: 6 }}>
                      💳 Pagamento da fatura — excluído automaticamente
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginBottom: 8, lineHeight: 1.5 }}>
                      Este crédito representa o pagamento que já saiu de outra conta. Incluí-lo causaria duplicidade no saldo.
                    </div>
                    {transacoesDetectadas.map((t, i) => !t.e_pagamento_fatura ? null : (
                      <div key={i} style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(168,85,247,.2)', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.6)' }}>{t.descricao}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 2 }}>
                            {new Date(t.data_hora).toLocaleDateString('pt-BR')} · R$ {t.valor.toFixed(2)}
                          </div>
                          {t.conciliacao_descricao && (
                            <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 3 }}>
                              🔗 {t.conciliacao_descricao}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setTransacoesDetectadas(prev => prev.map((x, idx) => idx === i ? { ...x, confirmada_duplicata: false, e_pagamento_fatura: false } : x))}
                          style={{ fontSize: 9, padding: '3px 8px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 5, color: 'rgba(255,255,255,.4)', cursor: 'pointer', flexShrink: 0 }}
                        >
                          Incluir mesmo assim
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Duplicatas confirmadas (já no banco via ref_externa) ── */}
                {transacoesDetectadas.filter(t => t.confirmada_duplicata && !t.e_pagamento_fatura).length > 0 && (
                  <div style={{ background: 'rgba(239,68,68,.05)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 10, padding: '10px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#f87171', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
                        🚫 Já lançados — {transacoesDetectadas.filter(t => t.confirmada_duplicata && !t.e_pagamento_fatura).length} transaç{transacoesDetectadas.filter(t => t.confirmada_duplicata && !t.e_pagamento_fatura).length > 1 ? 'ões já existem' : 'ão já existe'} no sistema
                      </div>
                      <button
                        onClick={() => setTransacoesDetectadas(prev => prev.filter(t => !t.confirmada_duplicata))}
                        style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, color: '#f87171', cursor: 'pointer' }}
                      >
                        Remover todas
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                      {transacoesDetectadas.map((t, i) => (!t.confirmada_duplicata || t.e_pagamento_fatura) ? null : (
                        <div key={i} style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => removerTransacao(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,.5)', fontSize: 13, flexShrink: 0, lineHeight: 1 }} title="Remover">✕</button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.7)' }}>{t.descricao}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(239,68,68,.12)', color: '#f87171', border: '1px solid rgba(239,68,68,.25)' }}>
                                já existe no sistema
                              </span>
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171' }}>
                              {t.tipo === 'credito' ? '+' : '-'}R$ {Math.abs(t.valor).toFixed(2)}
                            </div>
                            <button onClick={() => setTransacoesDetectadas(prev => prev.map((x, idx) => idx === i ? { ...x, confirmada_duplicata: false } : x))}
                              style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 5, color: 'rgba(255,255,255,.4)', cursor: 'pointer' }}>
                              Lançar mesmo assim
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Possíveis duplicatas (fuzzy: mesma data+valor, desc diferente) ── */}
                {transacoesDetectadas.filter(t => t.potencial_duplicata && !t.confirmada_duplicata).length > 0 && (
                  <div style={{ background: 'rgba(249,115,22,.04)', border: '1px solid rgba(249,115,22,.25)', borderRadius: 10, padding: '10px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#f97316', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
                          🔁 Verificar — {transacoesDetectadas.filter(t => t.potencial_duplicata && !t.confirmada_duplicata).length} possíve{transacoesDetectadas.filter(t => t.potencial_duplicata && !t.confirmada_duplicata).length > 1 ? 'is duplicatas' : 'l duplicata'}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>Valor igual a um lançamento existente — <strong style={{ color: '#fbbf24' }}>verifique a data</strong>: se for diferente, é um lançamento distinto e deve ser incluído.</div>
                      </div>
                      <button
                        onClick={descartarDuplicatas}
                        style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(249,115,22,.12)', border: '1px solid rgba(249,115,22,.3)', borderRadius: 6, color: '#f97316', cursor: 'pointer', flexShrink: 0, marginLeft: 8 }}
                      >
                        Descartar todas
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 240, overflowY: 'auto' }}>
                      {transacoesDetectadas.map((t, i) => (!t.potencial_duplicata || t.confirmada_duplicata) ? null : (
                        <div key={i} style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(249,115,22,.2)', borderRadius: 8, padding: '7px 10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => removerTransacao(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(249,115,22,.5)', fontSize: 13, flexShrink: 0, lineHeight: 1 }} title="Descartar">✕</button>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <input value={t.descricao} onChange={e => editarTransacao(i, 'descricao', e.target.value)}
                                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontWeight: 500, width: '100%', outline: 'none' }} />
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                {t.conflito_data ? (
                                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(249,115,22,.12)', color: '#f97316', border: '1px solid rgba(249,115,22,.25)' }}>
                                    valor igual ao de {new Date(t.conflito_data).toLocaleDateString('pt-BR')}
                                    {t.conflito_data.slice(0,10) !== t.data_hora.slice(0,10)
                                      ? <strong style={{ color: '#fbbf24' }}> — datas diferentes, provável lançamento distinto</strong>
                                      : ' — mesma data'}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: 'rgba(249,115,22,.12)', color: '#f97316', border: '1px solid rgba(249,115,22,.25)' }}>
                                    mesmo valor e data já lançados
                                  </span>
                                )}
                                {t.nao_categorizado ? (
                                  <select value={t.categoria} onChange={e => editarTransacao(i, 'categoria', e.target.value)}
                                    style={{ fontSize: 11, padding: '2px 8px', background: '#0a0a0a', border: '1px solid rgba(251,191,36,.35)', borderRadius: 6, color: '#fbbf24', outline: 'none', cursor: 'pointer' }}>
                                    {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                                  </select>
                                ) : (
                                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 8, background: `${CORES[t.categoria] || '#6b7280'}18`, color: CORES[t.categoria] || '#6b7280', border: `1px solid ${CORES[t.categoria] || '#6b7280'}33` }}>
                                    {t.categoria}
                                  </span>
                                )}
                                {t.tipo_pagamento && (
                                  <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.35)', border: '1px solid rgba(255,255,255,.1)' }}>{t.tipo_pagamento}</span>
                                )}
                                <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171' }}>
                                {t.tipo === 'credito' ? '+' : '-'}R$ {Math.abs(t.valor).toFixed(2)}
                              </div>
                              <button onClick={() => desmarcarDuplicata(i)}
                                style={{ fontSize: 9, padding: '2px 7px', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 5, color: 'rgba(255,255,255,.4)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Lançar mesmo assim
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Transações não categorizadas (sem duplicata pendente) ── */}
                {transacoesDetectadas.filter(t => t.nao_categorizado && !t.potencial_duplicata && !t.confirmada_duplicata).length > 0 && (
                  <div style={{ background: 'rgba(251,191,36,.04)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 10, padding: '10px', marginBottom: 10 }}>
                    <TipCard id="tip-sem-categoria" icon="🏷️" tips={tips} accent="#fbbf24"
                      text="Clique no <strong>select de categoria</strong> ao lado de cada item ou use <strong>&quot;Lançar todos como Outros&quot;</strong> para categorizar em lote. Você pode alterar depois." />
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ fontSize: 10, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600 }}>
                        ⚠ Sem categoria ({transacoesDetectadas.filter(t => t.nao_categorizado && !t.potencial_duplicata && !t.confirmada_duplicata).length})
                      </div>
                      <button
                        onClick={categorizarNaoCategorizadosComoOutros}
                        style={{ fontSize: 10, padding: '3px 10px', background: 'rgba(251,191,36,.12)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 6, color: '#fbbf24', cursor: 'pointer' }}
                      >
                        Lançar todos como &quot;Outros&quot;
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 200, overflowY: 'auto' }}>
                      {transacoesDetectadas.map((t, i) => (!t.nao_categorizado || t.potencial_duplicata || t.confirmada_duplicata) ? null : (
                        <div key={i} style={{ background: 'rgba(0,0,0,.3)', border: '1px solid rgba(251,191,36,.15)', borderRadius: 8, padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => removerTransacao(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.25)', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✕</button>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <input value={t.descricao} onChange={e => editarTransacao(i, 'descricao', e.target.value)}
                              style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 12, fontWeight: 500, width: '100%', outline: 'none' }} />
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <select
                                value={t.categoria}
                                onChange={e => editarTransacao(i, 'categoria', e.target.value)}
                                style={{ fontSize: 11, padding: '2px 8px', background: '#0a0a0a', border: '1px solid rgba(251,191,36,.3)', borderRadius: 6, color: '#fbbf24', outline: 'none', cursor: 'pointer' }}>
                                {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              {t.tipo_pagamento && (
                                <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, background: 'rgba(255,255,255,.05)', color: 'rgba(255,255,255,.35)', border: '1px solid rgba(255,255,255,.1)' }}>
                                  {t.tipo_pagamento}
                                </span>
                              )}
                              <span style={{ fontSize: 9, color: 'rgba(255,255,255,.3)' }}>{new Date(t.data_hora).toLocaleDateString('pt-BR')}</span>
                            </div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap', flexShrink: 0 }}>
                            {t.tipo === 'credito' ? '+' : '-'}R$ {Math.abs(t.valor).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Etapa de confirmação de conta ── */}
                {etapaConfirmacao ? (
                  <div style={{ marginTop: 4, background: '#0a1a0a', border: '1px solid #1a5a1a', borderRadius: 10, padding: '14px' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 10 }}>Confirmar conta destino</div>
                    {(() => {
                      const contaSel = contas.find(c => c.id === contaUpload)
                      return contaSel ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(74,222,128,.07)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, marginBottom: 12 }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: contaSel.bancos?.cor || '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {(contaSel.bancos?.nome_curto || contaSel.nome)[0]}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>{contaSel.bancos?.nome_curto || '—'} — {contaSel.nome}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>{transacoesDetectadas.length} lançamento{transacoesDetectadas.length > 1 ? 's' : ''} serão vinculados a esta conta</div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 8, marginBottom: 12 }}>
                          <span style={{ fontSize: 18 }}>⚠️</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#fbbf24' }}>Sem conta vinculada</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>Os lançamentos não serão associados a nenhuma conta</div>
                          </div>
                        </div>
                      )
                    })()}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setEtapaConfirmacao(false)}
                        style={{ flex: 1, padding: '9px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer' }}>
                        ← Alterar conta
                      </button>
                      <button onClick={() => confirmarLancamentos()} disabled={confirmando}
                        style={{ flex: 2, padding: '9px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: confirmando ? 'default' : 'pointer', opacity: confirmando ? 0.7 : 1 }}>
                        {confirmando ? 'Lançando...' : `✓ Confirmar ${transacoesDetectadas.length} lançamento${transacoesDetectadas.length > 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button onClick={() => { setTransacoesDetectadas([]); setBancoDetectado(null); setContaUpload(''); setTipoDocumento(''); setEtapaConfirmacao(false); setContaInlineAberta(false) }}
                      style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button
                      onClick={() => { if (!transacoesDetectadas.some(t => (t.nao_categorizado || t.potencial_duplicata) && !t.confirmada_duplicata)) setEtapaConfirmacao(true) }}
                      disabled={transacoesDetectadas.some(t => (t.nao_categorizado || t.potencial_duplicata) && !t.confirmada_duplicata)}
                      title={transacoesDetectadas.some(t => t.potencial_duplicata && !t.confirmada_duplicata) ? 'Resolva as possíveis duplicatas antes de confirmar' : transacoesDetectadas.some(t => t.nao_categorizado && !t.confirmada_duplicata) ? 'Categorize todos os itens antes de confirmar' : ''}
                      style={{ flex: 2, padding: '10px', background: transacoesDetectadas.some(t => (t.nao_categorizado || t.potencial_duplicata) && !t.confirmada_duplicata) ? '#374151' : '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: transacoesDetectadas.some(t => (t.nao_categorizado || t.potencial_duplicata) && !t.confirmada_duplicata) ? 'not-allowed' : 'pointer' }}>
                      {transacoesDetectadas.some(t => t.potencial_duplicata && !t.confirmada_duplicata)
                        ? `Resolva ${transacoesDetectadas.filter(t => t.potencial_duplicata && !t.confirmada_duplicata).length} possíve${transacoesDetectadas.filter(t => t.potencial_duplicata && !t.confirmada_duplicata).length > 1 ? 'is duplicatas' : 'l duplicata'}`
                        : transacoesDetectadas.some(t => t.nao_categorizado && !t.confirmada_duplicata)
                          ? `Categorize os ${transacoesDetectadas.filter(t => t.nao_categorizado && !t.confirmada_duplicata).length} itens pendentes`
                          : `Avançar — ${transacoesDetectadas.length} lançamento${transacoesDetectadas.length > 1 ? 's' : ''}`}
                    </button>
                  </div>
                )}
              </div>
            )}
            </>)}
          </div>
          {/* Espaçador para o upload não ficar atrás da nav mobile */}
          <div style={{ height: '5rem' }} />
        </div>

        {/* ─── Histórico — oculto no mobile via CSS (.lancamento-right-col) ─── */}
        <div className="lancamento-right-col" style={{ padding: '1.5rem', overflowY: 'auto' }}>

          {/* ── Histórico de importações ── */}
          {(importacoes.length > 0 || loadingImportacoes) && (
            <ImportacoesHistorico
              importacoes={importacoes}
              loading={loadingImportacoes}
              filtroAtivo={filtroImportacaoId}
              onFiltrar={setFiltroImportacaoId}
              onExcluir={(id) => {
                setImportacoes(prev => prev.filter(i => i.id !== id))
                setHistorico(prev => prev.filter(t => t.importacao_id !== id))
                if (filtroImportacaoId === id) setFiltroImportacaoId(null)
              }}
            />
          )}

          <div id="historico-lancamentos" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: filtroImportacaoId ? 8 : '1rem' }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Lançamentos recentes</div>
            <button onClick={() => router.push('/dashboard/gastos')} style={{ fontSize: 11, color: '#4ade80', background: 'none', border: 'none', cursor: 'pointer' }}>ver todos →</button>
          </div>

          {/* Banner: filtro por importação ativo */}
          {filtroImportacaoId && (() => {
            const imp = importacoes.find(i => i.id === filtroImportacaoId)
            const nome = imp?.arquivo_nome || imp?.banco_nome || 'Importação'
            const qtd = historico.filter(t => t.importacao_id === filtroImportacaoId).length
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', padding: '7px 12px', background: 'rgba(129,140,248,.07)', border: '1px solid rgba(129,140,248,.25)', borderRadius: 8 }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 3h10M3 6h6M5 9h2" stroke="#818cf8" strokeWidth="1.3" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', flex: 1 }}>
                  Filtrando por <strong style={{ color: '#fff' }}>{nome}</strong>
                  {' · '}<strong style={{ color: '#818cf8' }}>{qtd}</strong> de {historico.length} lançamentos
                </span>
                <button onClick={() => setFiltroImportacaoId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 16, lineHeight: 1 }}>×</button>
              </div>
            )
          })()}

          {/* Filtro por conta */}
          {contas.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, color: 'rgba(255,255,255,.35)' }}>
                <path d="M1 3h11M3 6.5h7M5 10h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
              <select
                value={filtroContaId}
                onChange={e => setFiltroContaId(e.target.value)}
                style={{ flex: 1, padding: '6px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 8, color: filtroContaId ? '#fff' : 'rgba(255,255,255,.4)', fontSize: 12, outline: 'none', cursor: 'pointer' }}
              >
                <option value="">Todas as contas</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>
                ))}
                <option value="__sem_conta__">Sem conta vinculada</option>
              </select>
              {filtroContaId && (
                <button onClick={() => setFiltroContaId('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 16, lineHeight: 1, padding: '0 4px' }}>×</button>
              )}
            </div>
          )}

          {/* Barra de ações em lote */}
          {selecionados.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', background: '#0a1a0a', border: '1px solid #1a5a1a', borderRadius: 10 }}>
              <span style={{ fontSize: 12, color: '#4ade80', fontWeight: 500 }}>{selecionados.length} selecionado{selecionados.length > 1 ? 's' : ''}</span>
              <div style={{ flex: 1 }} />
              <select value={contaDestino} onChange={e => setContaDestino(e.target.value)}
                style={{ padding: '5px 10px', background: '#111', border: '1px solid #1a3a1a', borderRadius: 6, color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer' }}>
                <option value="">Mover para conta...</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>)}
              </select>
              <button onClick={moverParaConta} disabled={!contaDestino || movendo}
                style={{ padding: '5px 12px', background: 'rgba(74,222,128,.15)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 6, color: '#4ade80', fontSize: 12, cursor: contaDestino ? 'pointer' : 'default', opacity: !contaDestino ? 0.4 : 1 }}>
                {movendo ? 'Movendo...' : 'Mover'}
              </button>
              <button onClick={excluirSelecionados} disabled={excluindoLote}
                style={{ padding: '5px 12px', background: 'rgba(239,68,68,.15)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, color: '#f87171', fontSize: 12, cursor: 'pointer' }}>
                {excluindoLote ? 'Excluindo...' : 'Excluir'}
              </button>
              <button onClick={() => setSelecionados([])}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', fontSize: 18, lineHeight: 1 }}>×</button>
            </div>
          )}

          {historico.length === 0 ? (
            <div style={{ padding: '2rem 1.5rem', color: 'rgba(255,255,255,.4)', fontSize: 12 }}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
                <div style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,.6)', marginBottom: 6 }}>Nenhum lançamento ainda</div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>Preencha o formulário ao lado para registrar sua primeira transação.</div>
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 20 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: 12, color: 'rgba(255,255,255,.25)' }}>Dicas rápidas</div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {[
                    { keys: 'Tab', desc: 'Navegar entre campos' },
                    { keys: 'Ctrl + N', desc: 'Abrir lançamento de qualquer tela' },
                    { keys: 'Atalhos', desc: 'Clique nos chips para preencher automaticamente' },
                    { keys: 'Voz', desc: 'Dite o valor e descrição sem digitar' },
                  ].map(d => (
                    <div key={d.keys} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <kbd style={{ fontSize: 10, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 5, padding: '2px 7px', color: 'rgba(255,255,255,.4)', whiteSpace: 'nowrap' as const, flexShrink: 0 }}>{d.keys}</kbd>
                      <span style={{ color: 'rgba(255,255,255,.35)' }}>{d.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Selecionar todos */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                <input type="checkbox" checked={selecionados.length === historico.length && historico.length > 0}
                  onChange={toggleTodos}
                  style={{ cursor: 'pointer', accentColor: '#4ade80', width: 14, height: 14 }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,.3)' }}>Selecionar todos</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(filtroImportacaoId ? historico.filter(t => t.importacao_id === filtroImportacaoId) : historico).map(t => (
                  <div key={t.id} style={{
                    background: selecionados.includes(t.id) ? '#0d2a0d' : '#111',
                    border: `1px solid ${selecionados.includes(t.id) ? '#1a5a1a' : '#1a3a1a'}`,
                    borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, transition: 'all .15s',
                  }}>
                    {/* Checkbox */}
                    <input type="checkbox" checked={selecionados.includes(t.id)} onChange={() => toggleSelecionado(t.id)}
                      onClick={e => e.stopPropagation()}
                      style={{ cursor: 'pointer', accentColor: '#4ade80', width: 14, height: 14, flexShrink: 0 }} />

                    {/* Ícone categoria — clicável para editar */}
                    <div onClick={() => abrirEdicao(t)} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: `${CORES[t.categoria] || '#6b7280'}18`, border: `1px solid ${CORES[t.categoria] || '#6b7280'}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: CORES[t.categoria] || '#6b7280' }} />
                    </div>

                    {/* Conteúdo — clicável para editar */}
                    <div onClick={() => abrirEdicao(t)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descricao}</span>
                        {t.origem === 'manual' && <span style={{ fontSize: 9, background: 'rgba(255,255,255,.07)', color: 'rgba(255,255,255,.35)', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>manual</span>}
                        {t.origem === 'webhook' && <span style={{ fontSize: 9, background: 'rgba(74,222,128,.1)', color: '#4ade80', padding: '1px 5px', borderRadius: 3, flexShrink: 0 }}>auto</span>}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 2 }}>{t.categoria} · {fmtDataHora(t.data_hora)}</div>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 600, color: t.tipo === 'credito' ? '#4ade80' : '#f87171', whiteSpace: 'nowrap' }}>
                      {t.tipo === 'credito' ? '+' : '-'}{fmtBRL(Math.abs(t.valor))}
                    </div>

                    {/* Lixeira */}
                    <button onClick={() => deletar(t.id)} disabled={deletando === t.id}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.2)', padding: 4, flexShrink: 0, opacity: deletando === t.id ? 0.4 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,.2)')}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M5 4V3a1 1 0 011-1h2a1 1 0 011 1v1M6 7v3M8 7v3M3 4l1 7a1 1 0 001 1h4a1 1 0 001-1l1-7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Modal edição ─── */}
      {modalAberto && transacaoEditando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '0 1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalAberto(false) }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Editar lançamento</div>
              {transacaoEditando?.origem && (
                <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,.06)', color: 'rgba(255,255,255,.35)', border: '1px solid rgba(255,255,255,.1)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  {{ manual: 'manual', upload: 'importado', webhook: 'automático', saldo_inicial: 'saldo inicial' }[transacaoEditando.origem] || transacaoEditando.origem}
                </span>
              )}
            </div>

            {/* Tipo + Valor */}
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,.4)', border: '1px solid #1a3a1a', borderRadius: 8, padding: 3, gap: 2 }}>
                {(['debito', 'credito'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setEditTipo(t)} style={{
                    padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                    background: editTipo === t ? (t === 'debito' ? '#7f1d1d' : '#14532d') : 'transparent',
                    color: editTipo === t ? (t === 'debito' ? '#f87171' : '#4ade80') : 'rgba(255,255,255,.35)',
                  }}>
                    {t === 'debito' ? '− Despesa' : '+ Receita'}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(255,255,255,.35)' }}>R$</span>
                <input
                  value={editValor}
                  onChange={e => setEditValor(e.target.value.replace(/[^0-9,]/g, ''))}
                  style={{ width: '100%', padding: '9px 12px 9px 30px', background: '#0a0a0a', border: `1px solid ${editTipo === 'debito' ? 'rgba(239,68,68,.3)' : 'rgba(74,222,128,.3)'}`, borderRadius: 8, color: editTipo === 'debito' ? '#f87171' : '#4ade80', fontSize: 14, fontWeight: 600, outline: 'none' }}
                  inputMode="decimal"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Descrição</label>
              <input value={editDescricao} onChange={e => setEditDescricao(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Categoria</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {todasCategorias.map(c => (
                  <button key={c} type="button" onClick={() => setEditCategoria(c)} style={{
                    padding: '4px 10px', borderRadius: 20, border: `1px solid ${editCategoria === c ? CORES[c] || '#4ade80' : '#1a3a1a'}`,
                    background: editCategoria === c ? `${CORES[c] || '#4ade80'}18` : 'transparent',
                    color: editCategoria === c ? CORES[c] || '#4ade80' : 'rgba(255,255,255,.4)',
                    fontSize: 11, cursor: 'pointer',
                  }}>{c}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Conta</label>
              <select value={editContaId} onChange={e => setEditContaId(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', cursor: 'pointer' }}>
                <option value="">Sem conta específica</option>
                {contas.map(c => <option key={c.id} value={c.id}>{c.bancos?.nome_curto || '—'} · {c.nome}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Data e hora</label>
              <input type="datetime-local" value={editDataHora} onChange={e => setEditDataHora(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={() => setModalAberto(false)}
                style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={salvandoEdicao}
                style={{ flex: 2, padding: '10px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvandoEdicao ? 'default' : 'pointer', opacity: salvandoEdicao ? 0.7 : 1 }}>
                {salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal nova conta ─── */}
      {modalNovaConta && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '0 1rem' }}
          onClick={e => { if (e.target === e.currentTarget) setModalNovaConta(false) }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Cadastrar nova conta</div>
              <button onClick={() => setModalNovaConta(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.35)', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>

            <form onSubmit={salvarNovaConta} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Busca banco */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Banco</label>
                <input
                  value={buscaBancoModal}
                  onChange={e => setBuscaBancoModal(e.target.value)}
                  placeholder="Buscar banco pelo nome ou código..."
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', marginBottom: 8 }}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                  {bancosLista
                    .filter(b =>
                      !buscaBancoModal ||
                      b.nome_curto.toLowerCase().includes(buscaBancoModal.toLowerCase()) ||
                      b.codigo.includes(buscaBancoModal)
                    )
                    .slice(0, 20)
                    .map(b => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setFormNovaConta(p => ({ ...p, banco_id: b.id }))}
                        style={{
                          padding: '8px 6px', borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 500, textAlign: 'center',
                          background: formNovaConta.banco_id === b.id ? `${b.cor || '#4ade80'}22` : 'rgba(255,255,255,.04)',
                          border: `1px solid ${formNovaConta.banco_id === b.id ? b.cor || '#4ade80' : '#1a3a1a'}`,
                          color: formNovaConta.banco_id === b.id ? b.cor || '#4ade80' : 'rgba(255,255,255,.6)',
                        }}
                      >
                        {b.nome_curto}
                      </button>
                    ))
                  }
                </div>
              </div>

              {/* Nome */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Nome da conta</label>
                <input
                  value={formNovaConta.nome}
                  onChange={e => setFormNovaConta(p => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Conta corrente, Nubank pessoal..."
                  required
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                />
              </div>

              {/* Tipo */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Tipo</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {['corrente', 'poupança', 'crédito', 'investimento'].map(t => (
                    <button key={t} type="button" onClick={() => setFormNovaConta(p => ({ ...p, tipo: t }))} style={{
                      flex: 1, padding: '7px 4px', borderRadius: 8, border: `1px solid ${formNovaConta.tipo === t ? '#4ade80' : '#1a3a1a'}`,
                      background: formNovaConta.tipo === t ? 'rgba(74,222,128,.12)' : 'transparent',
                      color: formNovaConta.tipo === t ? '#4ade80' : 'rgba(255,255,255,.4)', fontSize: 11, cursor: 'pointer',
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              {/* Saldo inicial */}
              <div>
                <label style={{ display: 'block', fontSize: 10, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 5 }}>Saldo inicial (opcional)</label>
                <input
                  type="number"
                  value={formNovaConta.saldo_inicial}
                  onChange={e => setFormNovaConta(p => ({ ...p, saldo_inicial: e.target.value }))}
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                  style={{ width: '100%', padding: '9px 12px', background: '#0a0a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none' }}
                />
              </div>

              {erroNovaConta && (
                <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171' }}>
                  {erroNovaConta}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => setModalNovaConta(false)}
                  style={{ flex: 1, padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 13, cursor: 'pointer' }}>
                  Cancelar
                </button>
                <button type="submit" disabled={salvandoConta}
                  style={{ flex: 2, padding: '10px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvandoConta ? 'default' : 'pointer', opacity: salvandoConta ? 0.7 : 1 }}>
                  {salvandoConta ? 'Salvando...' : 'Cadastrar conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal banco não encontrado ─── */}
      {modalContaNaoEncontrada && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '1rem' }}>
          <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 16, padding: '1.5rem', width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>🏦 Conta não cadastrada</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
              Detectamos <strong style={{ color: '#fff' }}>{bancoNaoEncontrado}</strong> no extrato, mas você não tem essa conta cadastrada ainda.
            </div>

            {/* Criação rápida — só aparece quando temos banco_id pré-preenchido */}
            {formNovaConta.banco_id && (
              <div style={{ background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600 }}>✨ Criar conta com 1 clique</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {formNovaConta.numero && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)' }}>
                      Conta: <span style={{ color: '#fff' }}>{formNovaConta.numero}</span>
                      {formNovaConta.agencia && <> · Ag: <span style={{ color: '#fff' }}>{formNovaConta.agencia}</span></>}
                    </div>
                  )}
                  <input
                    value={formNovaConta.nome || bancoNaoEncontrado}
                    onChange={e => setFormNovaConta(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Nome da conta (ex: Conta Corrente Itaú)"
                    style={{ fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid rgba(74,222,128,.25)', background: 'rgba(0,0,0,.3)', color: '#fff', outline: 'none' }}
                  />
                </div>
                {erroNovaConta && <div style={{ fontSize: 11, color: '#f87171' }}>{erroNovaConta}</div>}
                <button
                  onClick={criarContaRapida}
                  disabled={salvandoConta}
                  style={{ padding: '9px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {salvandoConta ? 'Criando...' : `Criar conta ${bancoNaoEncontrado}`}
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={() => setModalContaNaoEncontrada(false)}
                style={{ padding: '10px', background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, color: '#4ade80', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                Continuar sem conta e vincular depois
              </button>
              <button onClick={() => { setModalContaNaoEncontrada(false); abrirModalNovaConta() }}
                style={{ padding: '10px', background: 'transparent', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                Preencher manualmente
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}