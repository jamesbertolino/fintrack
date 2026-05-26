'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

// ─── Catálogo de prioridades ──────────────────────────────────────────────────
const CATALOGO = [
  { tipo: 'emergencia',   titulo: 'Reserva de emergência', icon: '🛡️', desc: 'Fundo de segurança para 6 meses de despesas' },
  { tipo: 'dividas',      titulo: 'Sair das dívidas',      icon: '💳', desc: 'Quitar cartão, empréstimos e financiamentos' },
  { tipo: 'viagem',       titulo: 'Realizar uma viagem',   icon: '✈️', desc: 'Conhecer novos destinos nacionais ou internacionais' },
  { tipo: 'casa',         titulo: 'Casa própria',          icon: '🏠', desc: 'Dar entrada ou financiar meu imóvel' },
  { tipo: 'veiculo',      titulo: 'Carro ou moto',         icon: '🚗', desc: 'Adquirir ou trocar meu veículo' },
  { tipo: 'aposentadoria',titulo: 'Aposentadoria',         icon: '🌅', desc: 'Garantir renda para parar de trabalhar com conforto' },
  { tipo: 'investimento', titulo: 'Investir mais',         icon: '📈', desc: 'Fazer meu dinheiro crescer com aplicações' },
  { tipo: 'educacao',     titulo: 'Educação',              icon: '🎓', desc: 'Curso, faculdade, MBA, especialização' },
  { tipo: 'negocio',      titulo: 'Abrir um negócio',      icon: '🚀', desc: 'Empreender e ter minha própria empresa' },
  { tipo: 'casamento',    titulo: 'Casamento',             icon: '💍', desc: 'Realizar a cerimônia dos sonhos' },
  { tipo: 'filho',        titulo: 'Filhos e família',      icon: '👶', desc: 'Planejar filhos, creche, escola e faculdade' },
  { tipo: 'saude',        titulo: 'Saúde e bem-estar',     icon: '❤️', desc: 'Plano de saúde, academia, qualidade de vida' },
]

// Sugestão automática por faixa de idade
function sugerirPorIdade(idade: number): string[] {
  if (idade < 22) return ['emergencia', 'educacao', 'viagem', 'veiculo', 'dividas']
  if (idade < 30) return ['emergencia', 'viagem', 'casa', 'investimento', 'educacao']
  if (idade < 40) return ['casa', 'emergencia', 'investimento', 'filho', 'aposentadoria']
  if (idade < 50) return ['aposentadoria', 'investimento', 'filho', 'casa', 'saude']
  return ['aposentadoria', 'saude', 'investimento', 'dividas', 'viagem']
}

function calcularIdade(dataNasc: string): number {
  const hoje = new Date()
  const nasc = new Date(dataNasc)
  let idade = hoje.getFullYear() - nasc.getFullYear()
  if (hoje.getMonth() < nasc.getMonth() || (hoje.getMonth() === nasc.getMonth() && hoje.getDate() < nasc.getDate())) idade--
  return idade
}

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('onboarding_completo, setup_completo').eq('id', user.id).maybeSingle()
      if (profile?.onboarding_completo && profile?.setup_completo) { router.push('/dashboard'); return }
      if (profile?.onboarding_completo) { router.push('/setup'); return }
    }
    check()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [etapa, setEtapa]                   = useState(1)
  const [dataNasc, setDataNasc]             = useState('')
  const [genero, setGenero]                 = useState('')
  const [selecionados, setSelecionados]     = useState<string[]>([])
  const [salvando, setSalvando]             = useState(false)

  const idade = dataNasc ? calcularIdade(dataNasc) : null
  const sugeridos = idade ? sugerirPorIdade(idade) : []

  function togglePrioridade(tipo: string) {
    setSelecionados(prev =>
      prev.includes(tipo)
        ? prev.filter(t => t !== tipo)
        : prev.length < 5 ? [...prev, tipo] : prev
    )
  }

  // Ordena: sugeridos primeiro, depois restantes
  const catalogoOrdenado = [
    ...CATALOGO.filter(c => sugeridos.includes(c.tipo)),
    ...CATALOGO.filter(c => !sugeridos.includes(c.tipo)),
  ]

  async function finalizar() {
    if (selecionados.length === 0) return
    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const prioridades = selecionados.map((tipo, i) => {
      const cat = CATALOGO.find(c => c.tipo === tipo)!
      return { tipo, titulo: cat.titulo, icon: cat.icon, ordem: i + 1 }
    })

    await supabase.from('profiles').update({
      data_nascimento: dataNasc || null,
      genero: genero || null,
      prioridades,
      onboarding_completo: true,
    }).eq('id', user.id)

    router.push('/setup')
  }

  const s = {
    page:    { minHeight: '100vh', background: '#080b0f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif', padding: '1.5rem' } as React.CSSProperties,
    card:    { width: '100%', maxWidth: 560, background: '#0d1117', border: '1px solid #1e2d1e', borderRadius: 16, padding: '2rem', boxShadow: '0 8px 40px rgba(0,0,0,.6)' } as React.CSSProperties,
    h1:      { fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 6 } as React.CSSProperties,
    sub:     { fontSize: 13, color: 'rgba(255,255,255,.45)', marginBottom: 24, lineHeight: 1.6 } as React.CSSProperties,
    label:   { display: 'block', fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase' as const, letterSpacing: '.06em', marginBottom: 6 } as React.CSSProperties,
    input:   { width: '100%', padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
    btnNext: { width: '100%', padding: '12px', background: '#16a34a', border: 'none', borderRadius: 10, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8 } as React.CSSProperties,
    btnBack: { background: 'none', border: 'none', color: 'rgba(255,255,255,.35)', fontSize: 12, cursor: 'pointer', marginBottom: 16, padding: 0 } as React.CSSProperties,
    steps:   { display: 'flex', gap: 6, marginBottom: 28 } as React.CSSProperties,
  }

  function stepDot(active: boolean, done: boolean): React.CSSProperties {
    return { flex: 1, height: 4, borderRadius: 2, background: done ? '#16a34a' : active ? '#4ade80' : '#1a3a1a', transition: 'background .3s' }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Progress dots */}
        <div style={s.steps}>
          {[1, 2, 3].map(n => (
            <div key={n} style={stepDot(etapa === n, etapa > n)} />
          ))}
        </div>

        {/* ── Etapa 1: Perfil pessoal ─────────────────────────────────────── */}
        {etapa === 1 && (
          <>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👋</div>
            <h1 style={s.h1}>Vamos personalizar sua experiência</h1>
            <p style={s.sub}>Essas informações ajudam a IA a dar conselhos financeiros mais precisos para o seu momento de vida.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Data de nascimento</label>
              <input type="date" value={dataNasc} onChange={e => setDataNasc(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                style={s.input} />
              {idade !== null && (
                <div style={{ fontSize: 11, color: '#4ade80', marginTop: 5 }}>
                  {idade} anos — {idade < 25 ? 'Início da jornada financeira 🌱' : idade < 40 ? 'Fase de construção 🏗️' : idade < 55 ? 'Fase de consolidação ⚡' : 'Fase de preservação 🌅'}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={s.label}>Gênero</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { val: 'masculino',            label: '♂ Masculino' },
                  { val: 'feminino',             label: '♀ Feminino' },
                  { val: 'outro',                label: '⚧ Outro' },
                  { val: 'prefiro_nao_informar', label: '🔒 Prefiro não informar' },
                ].map(op => (
                  <button key={op.val} onClick={() => setGenero(op.val)} style={{
                    padding: '9px 12px', borderRadius: 8, border: `1px solid ${genero === op.val ? '#4ade80' : '#1a3a1a'}`,
                    background: genero === op.val ? 'rgba(74,222,128,.1)' : 'rgba(255,255,255,.03)',
                    color: genero === op.val ? '#4ade80' : 'rgba(255,255,255,.5)',
                    fontSize: 12, cursor: 'pointer', transition: 'all .15s',
                  }}>{op.label}</button>
                ))}
              </div>
            </div>

            <button style={s.btnNext} onClick={() => setEtapa(2)}>
              Continuar →
            </button>
            <button style={{ ...s.btnNext, background: 'transparent', color: 'rgba(255,255,255,.3)', marginTop: 8, fontSize: 12 }}
              onClick={() => setEtapa(2)}>
              Pular por enquanto
            </button>
          </>
        )}

        {/* ── Etapa 2: Prioridades ────────────────────────────────────────── */}
        {etapa === 2 && (
          <>
            <button style={s.btnBack} onClick={() => setEtapa(1)}>← Voltar</button>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
            <h1 style={s.h1}>Quais são suas prioridades financeiras?</h1>
            <p style={s.sub}>
              Escolha até <strong style={{ color: '#4ade80' }}>5 prioridades</strong>.
              {sugeridos.length > 0 && <span> As marcadas com ✨ são sugestões para seu perfil.</span>}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 380, overflowY: 'auto', marginBottom: 20, paddingRight: 4 }}>
              {catalogoOrdenado.map(cat => {
                const sel = selecionados.includes(cat.tipo)
                const sug = sugeridos.includes(cat.tipo)
                const bloqueado = !sel && selecionados.length >= 5
                return (
                  <button key={cat.tipo} onClick={() => !bloqueado && togglePrioridade(cat.tipo)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 10, textAlign: 'left',
                      border: `1px solid ${sel ? '#4ade80' : sug ? 'rgba(74,222,128,.25)' : '#1a3a1a'}`,
                      background: sel ? 'rgba(74,222,128,.08)' : sug ? 'rgba(74,222,128,.03)' : 'rgba(255,255,255,.02)',
                      cursor: bloqueado ? 'not-allowed' : 'pointer',
                      opacity: bloqueado ? 0.45 : 1,
                      transition: 'all .15s',
                    }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: sel ? '#4ade80' : '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                        {cat.titulo}
                        {sug && <span style={{ fontSize: 9, color: '#4ade80', opacity: .7 }}>✨ sugerido</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{cat.desc}</div>
                    </div>
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: `1.5px solid ${sel ? '#4ade80' : '#1a3a1a'}`,
                      background: sel ? '#16a34a' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, color: '#fff',
                    }}>
                      {sel ? '✓' : selecionados.indexOf(cat.tipo) >= 0 ? selecionados.indexOf(cat.tipo) + 1 : ''}
                    </div>
                  </button>
                )
              })}
            </div>

            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginBottom: 12, textAlign: 'center' }}>
              {selecionados.length}/5 selecionadas
            </div>

            <button style={{ ...s.btnNext, background: selecionados.length > 0 ? '#16a34a' : '#1a2e1a', cursor: selecionados.length > 0 ? 'pointer' : 'default' }}
              onClick={() => selecionados.length > 0 && setEtapa(3)}>
              {selecionados.length > 0 ? 'Revisar minhas prioridades →' : 'Selecione pelo menos 1 prioridade'}
            </button>
          </>
        )}

        {/* ── Etapa 3: Revisão ────────────────────────────────────────────── */}
        {etapa === 3 && (
          <>
            <button style={s.btnBack} onClick={() => setEtapa(2)}>← Ajustar</button>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏆</div>
            <h1 style={s.h1}>Tudo certo!</h1>
            <p style={s.sub}>Suas prioridades guiarão os conselhos da IA para te ajudar a chegar mais rápido aos seus objetivos.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
              {selecionados.map((tipo, i) => {
                const cat = CATALOGO.find(c => c.tipo === tipo)!
                return (
                  <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'rgba(74,222,128,.06)', border: '1px solid rgba(74,222,128,.15)', borderRadius: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80', width: 16, textAlign: 'center' }}>#{i + 1}</span>
                    <span style={{ fontSize: 18 }}>{cat.icon}</span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{cat.titulo}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)' }}>{cat.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ background: 'rgba(74,222,128,.04)', border: '1px solid rgba(74,222,128,.12)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>
              💡 A IA vai analisar seus gastos com base nessas prioridades e sugerir o que adaptar para você chegar mais rápido aos seus objetivos. Você pode alterar isso a qualquer momento em <strong style={{ color: 'rgba(255,255,255,.6)' }}>Perfil → Prioridades</strong>.
            </div>

            <button style={{ ...s.btnNext, opacity: salvando ? 0.7 : 1 }} onClick={finalizar} disabled={salvando}>
              {salvando ? 'Salvando...' : '✓ Começar a usar o PoupaUp'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
