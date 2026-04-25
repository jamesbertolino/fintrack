'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const AVATARES_PADRAO = ['🦁', '🐯', '🦊', '🐺', '🦝', '🐻', '🐼', '🦄', '🐸', '🦋', '🐙', '🦅']

interface ModalAvatarProps {
  userId:       string
  nomeAtual:    string
  avatarAtual?: string | null
  onSalvo:      (novaUrl: string) => void
  onFechar:     () => void
}

export default function ModalAvatar({ userId, nomeAtual, avatarAtual, onSalvo, onFechar }: ModalAvatarProps) {
  const supabase    = createClient()
  const inputRef    = useRef<HTMLInputElement>(null)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro]         = useState('')
  const [preview, setPreview]   = useState<string | null>(null)
  const [arquivo, setArquivo]   = useState<File | null>(null)

  async function salvarEmoji(emoji: string) {
    setSalvando(true); setErro('')
    const url = `emoji:${emoji}`
    const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId)
    setSalvando(false)
    if (error) { setErro('Erro ao salvar'); return }
    onSalvo(url)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setErro('Arquivo muito grande. Máximo 2MB.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setErro('Use JPG, PNG ou WebP.'); return }
    setErro('')
    setArquivo(file)
    setPreview(URL.createObjectURL(file))
  }

  async function fazerUpload() {
    if (!arquivo) return
    setSalvando(true); setErro('')

    const ext  = arquivo.name.split('.').pop() || 'jpg'
    const path = `${userId}/avatar.${ext}`

    const { error: upErr } = await supabase.storage
      .from('avatares')
      .upload(path, arquivo, { upsert: true, contentType: arquivo.type })

    if (upErr) { setSalvando(false); setErro('Erro no upload: ' + upErr.message); return }

    const { data: { publicUrl } } = supabase.storage.from('avatares').getPublicUrl(path)

    const { error: dbErr } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId)

    setSalvando(false)
    if (dbErr) { setErro('Erro ao salvar URL'); return }
    onSalvo(publicUrl)
  }

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '1rem',
  }
  const modal: React.CSSProperties = {
    background: '#111', border: '1px solid #1a3a1a', borderRadius: 16,
    padding: '1.5rem', width: '100%', maxWidth: 420,
    fontFamily: 'system-ui, sans-serif', color: '#fff',
  }

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onFechar() }}>
      <div style={modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>Alterar avatar</div>
          <button onClick={onFechar} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Avatares emoji */}
        <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          Escolher avatar
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: '1.5rem' }}>
          {AVATARES_PADRAO.map(emoji => (
            <button
              key={emoji}
              onClick={() => salvarEmoji(emoji)}
              disabled={salvando}
              style={{
                background: avatarAtual === `emoji:${emoji}` ? 'rgba(22,163,74,.2)' : 'rgba(255,255,255,.05)',
                border: `1px solid ${avatarAtual === `emoji:${emoji}` ? '#16a34a' : 'rgba(255,255,255,.1)'}`,
                borderRadius: 10, padding: '10px 0', fontSize: 22,
                cursor: salvando ? 'default' : 'pointer',
                transition: 'background .15s',
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Upload */}
        <div style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.4)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 10 }}>
          Fazer upload
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="preview" style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', border: '2px solid #16a34a' }} />
          )}
          <div style={{ flex: 1 }}>
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={onFileChange} />
            <button
              onClick={() => inputRef.current?.click()}
              style={{ padding: '8px 14px', background: 'rgba(255,255,255,.06)', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.7)', fontSize: 12, cursor: 'pointer', width: '100%' }}
            >
              {arquivo ? arquivo.name : 'Selecionar foto (JPG, PNG, WebP · máx 2MB)'}
            </button>
          </div>
        </div>

        {arquivo && (
          <button
            onClick={fazerUpload}
            disabled={salvando}
            style={{ width: '100%', padding: '10px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1, marginBottom: 10 }}
          >
            {salvando ? 'Enviando...' : 'Salvar foto'}
          </button>
        )}

        {erro && (
          <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171' }}>
            {erro}
          </div>
        )}

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.25)', marginTop: 12, textTransform: 'none' }}>
          Olá, {nomeAtual}! Clique num emoji ou envie uma foto.
        </div>
      </div>
    </div>
  )
}
