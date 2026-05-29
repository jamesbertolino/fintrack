'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import PoupaUpLogo from '@/components/PoupaUpLogo'
import { useCores } from '@/components/ThemeProvider'
import { CATEGORIAS_PADRAO, PALETA_CORES, EMOJIS_SUGERIDOS, type Categoria } from '@/lib/categorias'

interface CategoriaCustom extends Categoria {
  id: string
}

const TIPO_LABEL = { debito: 'Despesa', credito: 'Receita', ambos: 'Ambos' }
const TIPO_COR   = { debito: '#f87171', credito: '#4ade80', ambos: '#94a3b8' }

const FORM_VAZIO: { nome: string; cor: string; icone: string; tipo: 'debito' | 'credito' | 'ambos' } = { nome: '', cor: '#4ade80', icone: '📌', tipo: 'ambos' }

export default function CategoriasPage() {
  const router = useRouter()
  const cores  = useCores()

  const [customCats, setCustomCats] = useState<CategoriaCustom[]>([])
  const [loading,    setLoading]    = useState(true)
  const [form,       setForm]       = useState(FORM_VAZIO)
  const [editId,     setEditId]     = useState<string | null>(null)
  const [salvando,   setSalvando]   = useState(false)
  const [erro,       setErro]       = useState('')
  const [showForm,   setShowForm]   = useState(false)
  const [pickerEmoji, setPickerEmoji] = useState(false)

  useEffect(() => {
    fetch('/api/categorias')
      .then(r => r.json())
      .then(d => { setCustomCats(d.categorias || []); setLoading(false) })
  }, [])

  function abrirNova() {
    setForm(FORM_VAZIO); setEditId(null); setErro(''); setShowForm(true)
  }

  function abrirEditar(c: CategoriaCustom) {
    setForm({ nome: c.nome, cor: c.cor, icone: c.icone, tipo: c.tipo }); setEditId(c.id); setErro(''); setShowForm(true)
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro('Nome obrigatório'); return }
    if (!editId && customCats.some(c => c.nome.toLowerCase() === form.nome.trim().toLowerCase())) { setErro('Já existe uma categoria com esse nome'); return }
    setSalvando(true); setErro('')
    try {
      if (editId) {
        const res  = await fetch(`/api/categorias/${editId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setCustomCats(prev => prev.map(c => c.id === editId ? { ...c, ...form } : c))
      } else {
        const res  = await fetch('/api/categorias', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setCustomCats(prev => [...prev, data.categoria])
      }
      setShowForm(false); setEditId(null); setForm(FORM_VAZIO)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro')
    }
    setSalvando(false)
  }

  async function remover(id: string) {
    await fetch(`/api/categorias/${id}`, { method: 'DELETE' })
    setCustomCats(prev => prev.filter(c => c.id !== id))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', background: cores.surface,
    border: `1px solid ${cores.border}`, borderRadius: 8, color: cores.text,
    fontSize: 13, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, color: cores.text, fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '1rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.surface }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cores.textMuted, fontSize: 18, lineHeight: 1, padding: 4 }}>←</button>
        <PoupaUpLogo mode="compact" />
        <span style={{ fontSize: 13, color: cores.textMuted }}>🏷️ Categorias</span>
        <button onClick={abrirNova} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          + Nova categoria
        </button>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '1.5rem' }}>

        {/* ── Formulário ── */}
        {showForm && (
          <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: '1.25rem' }}>
              {editId ? 'Editar categoria' : 'Nova categoria'}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ fontSize: 10, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Nome</div>
                <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex.: Pet, Academia, Viagem" style={inputStyle} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Tipo</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['debito', 'credito', 'ambos'] as const).map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, tipo: t }))} style={{
                      flex: 1, padding: '9px 6px', borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      background: form.tipo === t ? `${TIPO_COR[t]}20` : 'transparent',
                      border: `1.5px solid ${form.tipo === t ? TIPO_COR[t] : cores.border}`,
                      color: form.tipo === t ? TIPO_COR[t] : cores.textMuted,
                    }}>{TIPO_LABEL[t]}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Ícone */}
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontSize: 10, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>Ícone</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setPickerEmoji(p => !p)}
                  style={{ width: 44, height: 44, borderRadius: 10, border: `1.5px solid ${cores.border}`, background: `${form.cor}15`, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {form.icone}
                </button>
                <span style={{ fontSize: 12, color: cores.textMuted }}>Clique para escolher</span>
              </div>
              {pickerEmoji && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8, padding: '10px', background: cores.pageBg, border: `1px solid ${cores.border}`, borderRadius: 10 }}>
                  {EMOJIS_SUGERIDOS.map(e => (
                    <button key={e} onClick={() => { setForm(p => ({ ...p, icone: e })); setPickerEmoji(false) }}
                      style={{ width: 34, height: 34, borderRadius: 6, border: `1px solid ${form.icone === e ? form.cor : 'transparent'}`, background: form.icone === e ? `${form.cor}20` : 'transparent', fontSize: 18, cursor: 'pointer' }}>
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Cor */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: 10, color: cores.textMuted, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>Cor</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PALETA_CORES.map(c => (
                  <button key={c} onClick={() => setForm(p => ({ ...p, cor: c }))}
                    style={{ width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${form.cor === c ? '#fff' : 'transparent'}`, cursor: 'pointer', transition: 'border-color .15s', boxShadow: form.cor === c ? `0 0 0 2px ${c}` : 'none' }} />
                ))}
              </div>
            </div>

            {/* Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: `${form.cor}10`, border: `1px solid ${form.cor}30`, borderRadius: 10, marginBottom: '1rem' }}>
              <span style={{ fontSize: 20 }}>{form.icone}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: form.cor }}>{form.nome || 'Prévia da categoria'}</span>
              <span style={{ fontSize: 11, color: cores.textMuted, marginLeft: 4 }}>{TIPO_LABEL[form.tipo]}</span>
            </div>

            {erro && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>{erro}</div>}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={salvar} disabled={salvando} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
                {salvando ? 'Salvando...' : editId ? 'Salvar alterações' : 'Criar categoria'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null) }} style={{ padding: '9px 16px', borderRadius: 8, border: `1px solid ${cores.border}`, background: 'transparent', color: cores.textMuted, fontSize: 13, cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* ── Categorias personalizadas ── */}
        <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, overflow: 'hidden', marginBottom: '1.25rem' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${cores.border}`, fontSize: 13, fontWeight: 600 }}>
            Suas categorias ({customCats.length})
          </div>
          {loading ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: cores.textMuted, fontSize: 13 }}>Carregando...</div>
          ) : customCats.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 32 }}>🏷️</div>
              <div style={{ fontSize: 13, color: cores.textMuted }}>Nenhuma categoria personalizada ainda.</div>
              <button onClick={() => { setForm(FORM_VAZIO); setEditId(null); setErro(''); setShowForm(true) }}
                style={{ padding: '8px 20px', background: cores.accent, border: 'none', borderRadius: 8, color: '#000', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Criar primeira categoria
              </button>
            </div>
          ) : (
            customCats.map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 1.25rem', borderBottom: i < customCats.length - 1 ? `1px solid ${cores.border}` : 'none' }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${c.cor}18`, border: `1.5px solid ${c.cor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {c.icone}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: c.cor }}>{c.nome}</div>
                  <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 2 }}>{TIPO_LABEL[c.tipo]}</div>
                </div>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: c.cor, flexShrink: 0 }} />
                <button onClick={() => abrirEditar(c)} style={{ background: 'none', border: `1px solid ${cores.border}`, borderRadius: 6, padding: '5px 10px', cursor: 'pointer', color: cores.textMuted, fontSize: 12 }}>Editar</button>
                <button onClick={() => remover(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,.6)', fontSize: 16, padding: 4 }}>✕</button>
              </div>
            ))
          )}
        </div>

        {/* ── Categorias padrão (somente leitura) ── */}
        <div style={{ background: cores.surface, border: `1px solid ${cores.border}`, borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${cores.border}`, fontSize: 13, fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>Categorias padrão</span>
            <span style={{ fontSize: 11, color: cores.textMuted }}>somente leitura</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 0 }}>
            {CATEGORIAS_PADRAO.map((c, i) => (
              <div key={c.nome} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 1.25rem', borderBottom: `1px solid ${cores.border}`, borderRight: i % 3 < 2 ? `1px solid ${cores.border}` : 'none' }}>
                <span style={{ fontSize: 16 }}>{c.icone}</span>
                <div>
                  <div style={{ fontSize: 13, color: c.cor, fontWeight: 500 }}>{c.nome}</div>
                  <div style={{ fontSize: 10, color: cores.textMuted }}>{TIPO_LABEL[c.tipo]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
