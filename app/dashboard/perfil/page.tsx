'use client'

import { useCallback, useEffect, useState, Suspense, lazy } from 'react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Avatar from '@/components/Avatar'
import ConvidarAmigos from '@/components/ConvidarAmigos'
import ModalAvatar from '@/components/ModalAvatar'
import { useTema, useCores } from '@/components/ThemeProvider'

const PushManagerComponent = lazy(() => import('@/components/PushManager'))
function PushManagerInline() {
  return (
    <Suspense fallback={null}>
      <PushManagerComponent inline />
    </Suspense>
  )
}

// Lê ?assinar=pro e dispara checkout automaticamente
function AssinaturaAutoStart({ onAssinar }: { onAssinar: (plano: string) => void }) {
  const params = useSearchParams()
  useEffect(() => {
    const plano = params.get('assinar')
    if (plano) onAssinar(plano)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

interface Profile {
  id: string
  nome: string
  sobrenome: string
  whatsapp: string
  timezone: string
  idioma: string
  plano: string
  created_at: string
  avatar_url?: string | null
  conta_padrao_id?: string | null
}

interface ContaPerfil {
  id: string
  nome: string
  bancos: { nome_curto: string } | null
}

interface WebhookConfig {
  token: string
  ativo: boolean
  plano: string
}

interface GrupoMembro {
  id: string
  whatsapp: string
  status: string
  papel: string
  user_id: string | null
  profiles: { nome: string; avatar_url?: string | null }[] | { nome: string; avatar_url?: string | null } | null
}

interface Grupo {
  id: string
  nome: string
  whatsapp_grupo_id: string | null
  criado_por: string
}

export default function PerfilPage() {
  const router = useRouter()
  const supabase = createClient()

  const [profile, setProfile]       = useState<Profile | null>(null)
  const [webhook, setWebhook]       = useState<WebhookConfig | null>(null)
  const [email, setEmail]           = useState('')
  const [loading, setLoading]       = useState(true)
  const [salvando, setSalvando]     = useState(false)
  const [sucesso, setSucesso]       = useState('')
  const [erro, setErro]             = useState('')
  const [abaSel, setAbaSel]         = useState<'perfil' | 'configuracoes' | 'webhook' | 'grupo' | 'plano' | 'seguranca' | 'prioridades'>('perfil')
  const isMobile = useIsMobile(640)

  // Família app
  const [, setFamiliaGrupo]                   = useState<{ id: string } | null>(null)
  const [familiaMembros, setFamiliaMembros]   = useState<{ id: string; permissao: string; created_at: string; membro_id: string; profiles: { nome: string; avatar_url?: string | null } | null }[]>([])
  const [familiaConvites, setFamiliaConvites] = useState<{ id: string; email: string; permissao: string; expires_at: string }[]>([])
  const [familiaEmail, setFamiliaEmail]       = useState('')
  const [familiaPerm, setFamiliaPerm]         = useState<'leitura' | 'edicao'>('leitura')
  const [familiaConvidando, setFamiliaConvid] = useState(false)
  const [familiaRem, setFamiliaRem]           = useState<string | null>(null)
  const [prioridades, setPrioridades] = useState<Array<{ tipo: string; titulo: string; icon: string; ordem: number }>>([])
  const [editandoPrioridades, setEditandoPrioridades] = useState(false)
  const [prioridadesSelecionadas, setPrioridadesSelecionadas] = useState<string[]>([])
  const [metricsExpandidoIdx, setMetricsExpandidoIdx] = useState<number | null>(null)
  const [metricasEdit, setMetricasEdit] = useState<Record<number, { valor_alvo: string; valor_atual: string; contribuicao_mensal: string; prazo_meses: string }>>({})
  const [grupo, setGrupo]           = useState<Grupo | null>(null)
  const [membros, setMembros]       = useState<GrupoMembro[]>([])
  const [novoNumero, setNovoNum]    = useState('')
  const [convidando, setConvidan]   = useState(false)
  const [tokenVisivel, setTokenVis]     = useState(false)
  const [copiado, setCopiado]           = useState(false)
  const [modalAvatarAberto, setModalAv] = useState(false)
  const [contasPerfil, setContasPerfil] = useState<ContaPerfil[]>([])
  const [contaPadrao, setContaPadrao]   = useState('')
  const [mfaAtivo, setMfaAtivo]         = useState(false)
  const [mfaFactorId, setMfaFactorId]   = useState('')
  const [mfaEtapa, setMfaEtapa]         = useState<'idle' | 'qr' | 'verificando'>('idle')
  const [mfaUri, setMfaUri]             = useState('')
  const [mfaSecretKey, setMfaSecretKey] = useState('')
  const [mfaCodigo, setMfaCodigo]       = useState('')
  const [exportando, setExportando]     = useState(false)
  const [assinando, setAssinando]       = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState('')

  const [form, setForm] = useState({ nome: '', sobrenome: '', whatsapp: '', timezone: 'America/Sao_Paulo', idioma: 'pt-BR' })
  const [notificacoesCelular, setNotificacoesCelular] = useState(true)
  const [salvandoNotif, setSalvandoNotif] = useState(false)
  const [pushPrefs, setPushPrefs] = useState({ resumo_semanal: true, aviso_meta: true, alerta_orcamento: true })
  const [salvandoPushPrefs, setSalvandoPushPrefs] = useState(false)
  const [senhaForm, setSenhaForm] = useState({ nova: '', confirmar: '' })
  const { tema, alterarTema: alterarTemaCtx } = useTema()
  const cores = useCores()

  async function assinarPlano(plano: string) {
    setAssinando(plano)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setErro(data.error || 'Erro ao iniciar checkout')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setAssinando(null)
    }
  }

  async function abrirPortal() {
    setAssinando('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setErro(data.error || 'Erro ao abrir portal')
    } catch {
      setErro('Erro de conexão')
    } finally {
      setAssinando(null)
    }
  }

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    setEmail(user.email || '')
    setCurrentUserId(user.id)

    const [{ data: prof }, { data: wh }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('webhook_configs').select('token, ativo, plano').eq('user_id', user.id).single(),
    ])

    if (prof) {
      setProfile(prof)
      setForm({ nome: prof.nome || '', sobrenome: prof.sobrenome || '', whatsapp: prof.whatsapp || '', timezone: prof.timezone || 'America/Sao_Paulo', idioma: prof.idioma || 'pt-BR' })
      setContaPadrao(prof.conta_padrao_id || '')
      setNotificacoesCelular(prof.notificacoes_celular !== false)
      const prios: Array<{ tipo: string; titulo: string; icon: string; ordem: number }> = Array.isArray(prof.prioridades) ? prof.prioridades : []
      setPrioridades(prios)
      setPrioridadesSelecionadas(prios.map((p: { tipo: string }) => p.tipo))
    }
    if (wh) setWebhook(wh)

    // Preferências de push
    const { data: pp } = await supabase.from('push_preferencias').select('resumo_semanal,aviso_meta,alerta_orcamento').eq('user_id', user.id).single()
    if (pp) setPushPrefs({ resumo_semanal: pp.resumo_semanal, aviso_meta: pp.aviso_meta, alerta_orcamento: pp.alerta_orcamento })

    const contasRes = await fetch('/api/contas')
    const contasDados = await contasRes.json()
    setContasPerfil(contasDados.contas || [])

    const { data: grupoData } = await supabase
      .from('grupos')
      .select('id, nome, whatsapp_grupo_id, criado_por')
      .eq('criado_por', user.id)
      .eq('ativo', true)
      .maybeSingle()

    let grupoFinal: Grupo | null = grupoData

    // Se não é admin, tenta buscar como membro ativo
    if (!grupoData) {
      const { data: membroData } = await supabase
        .from('grupo_membros')
        .select('grupo_id, grupos!grupo_membros_grupo_id_fkey(id, nome, whatsapp_grupo_id, criado_por)')
        .eq('user_id', user.id)
        .eq('status', 'ativo')
        .maybeSingle()

      if (membroData?.grupos) {
        grupoFinal = Array.isArray(membroData.grupos)
          ? (membroData.grupos[0] as Grupo)
          : (membroData.grupos as Grupo)
      }
    }

    setGrupo(grupoFinal)

    if (grupoFinal) {
      const { data: membrosData, error: membrosError } = await supabase
        .from('grupo_membros')
        .select('id, whatsapp, status, papel, user_id')
        .eq('grupo_id', grupoFinal.id)
        .neq('status', 'removido')

      if (membrosError) console.log('[perfil] membrosError:', membrosError.message)

      const userIds = membrosData?.map(m => m.user_id).filter(Boolean) || []
      let profilesMap: Record<string, { nome: string; avatar_url: string | null }> = {}

      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, nome, avatar_url')
          .in('id', userIds)

        profilesMap = Object.fromEntries(
          (profilesData || []).map(p => [p.id, { nome: p.nome, avatar_url: p.avatar_url }])
        )
      }

      const membrosCompletos = (membrosData || []).map(m => ({
        ...m,
        profiles: m.user_id ? profilesMap[m.user_id] || null : null,
      }))

      setMembros(membrosCompletos as GrupoMembro[])
    }
    // Família app
    const famRes = await fetch('/api/familia')
    if (famRes.ok) {
      const famData = await famRes.json()
      setFamiliaGrupo(famData.grupo || null)
      setFamiliaMembros(famData.membros || [])
      setFamiliaConvites(famData.convites || [])
    }

    setLoading(false)
  }, [supabase, router])

  async function familiaConvidar() {
    if (!familiaEmail.trim()) return
    setFamiliaConvid(true)
    const res = await fetch('/api/familia/convite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: familiaEmail.trim(), permissao: familiaPerm }),
    })
    const d = await res.json()
    setFamiliaConvid(false)
    if (d.ok) {
      setFamiliaEmail('')
      setSucesso('Convite enviado por e-mail!')
      setTimeout(() => setSucesso(''), 3000)
      // Recarrega
      const famRes = await fetch('/api/familia')
      if (famRes.ok) { const fd = await famRes.json(); setFamiliaGrupo(fd.grupo); setFamiliaMembros(fd.membros || []); setFamiliaConvites(fd.convites || []) }
    } else {
      setErro(d.error || 'Erro ao enviar convite')
    }
  }

  async function familiaRemoverMembro(id: string) {
    setFamiliaRem(id)
    await fetch(`/api/familia/membro/${id}`, { method: 'DELETE' })
    setFamiliaMembros(prev => prev.filter(m => m.id !== id))
    setFamiliaRem(null)
  }

  const carregarMfa = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    const totp = data?.totp?.find(f => f.status === 'verified')
    if (totp) { setMfaAtivo(true); setMfaFactorId(totp.id) }
    else { setMfaAtivo(false); setMfaFactorId('') }
  }, [supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    carregar()
    carregarMfa()
  }, [carregar, carregarMfa])

  async function salvarPerfil(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (!form.nome.trim()) { setErro('Nome obrigatório'); return }
    const waDigs = form.whatsapp.replace(/\D/g, '')
    if (waDigs && (waDigs.length < 10 || waDigs.length > 15)) { setErro('WhatsApp inválido: informe DDI + DDD + número (ex: 5511999999999)'); return }
    setSalvando(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('profiles').update({
      nome: form.nome.trim(),
      sobrenome: form.sobrenome.trim(),
      whatsapp: waDigs || null,
      timezone: form.timezone,
      idioma: form.idioma,
    }).eq('id', user.id)

    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    setSucesso('Perfil atualizado com sucesso!')
    carregar()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function iniciarMfa() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', issuer: 'PoupaUp' })
    if (error || !data) { setErro('Erro ao iniciar MFA: ' + error?.message); return }
    setMfaUri(data.totp.uri)
    setMfaSecretKey(data.totp.secret)
    setMfaFactorId(data.id)
    setMfaEtapa('qr')
  }

  async function confirmarMfa() {
    setMfaEtapa('verificando')
    const { data: ch, error: ce } = await supabase.auth.mfa.challenge({ factorId: mfaFactorId })
    if (ce || !ch) { setErro('Erro ao criar desafio MFA'); setMfaEtapa('qr'); return }
    const { error: ve } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: ch.id, code: mfaCodigo })
    if (ve) { setErro('Código inválido. Tente novamente.'); setMfaEtapa('qr'); return }
    setMfaAtivo(true); setMfaEtapa('idle'); setMfaCodigo(''); setSucesso('MFA ativado com sucesso!')
    setTimeout(() => setSucesso(''), 3000)
  }

  async function desativarMfa() {
    if (!window.confirm('Deseja desativar a autenticação de dois fatores?')) return
    const { error } = await supabase.auth.mfa.unenroll({ factorId: mfaFactorId })
    if (error) { setErro('Erro ao desativar MFA: ' + error.message); return }
    setMfaAtivo(false); setMfaFactorId(''); setMfaEtapa('idle'); setSucesso('MFA desativado.')
    setTimeout(() => setSucesso(''), 3000)
  }

  async function exportarDados() {
    setExportando(true)
    const res = await fetch('/api/export')
    if (!res.ok) { setErro('Erro ao exportar dados'); setExportando(false); return }
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `poupaup-dados-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(url)
    setExportando(false)
  }

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setSucesso('')
    if (senhaForm.nova.length < 8) { setErro('Senha deve ter no mínimo 8 caracteres'); return }
    if (senhaForm.nova !== senhaForm.confirmar) { setErro('Senhas não conferem'); return }
    setSalvando(true)

    const { error } = await supabase.auth.updateUser({ password: senhaForm.nova })
    setSalvando(false)
    if (error) { setErro('Erro: ' + error.message); return }
    setSucesso('Senha alterada com sucesso!')
    setSenhaForm({ nova: '', confirmar: '' })
    setTimeout(() => setSucesso(''), 3000)
  }

  async function toggleWebhook() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !webhook) return
    const novoAtivo = !webhook.ativo
    await supabase.from('webhook_configs').update({ ativo: novoAtivo }).eq('user_id', user.id)
    setWebhook(prev => prev ? { ...prev, ativo: novoAtivo } : prev)
  }

  async function regenerarToken() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const novoToken = crypto.randomUUID().replace(/-/g, '')
    await supabase.from('webhook_configs').update({ token: novoToken }).eq('user_id', user.id)
    setWebhook(prev => prev ? { ...prev, token: novoToken } : prev)
    setSucesso('Token regenerado!')
    setTimeout(() => setSucesso(''), 2000)
  }

  function copiarToken() {
    if (!webhook) return
    navigator.clipboard.writeText(webhook.token)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  async function sairDoGrupo() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !grupo) return

    const ehAdmin = grupo.criado_por === user.id

    if (!window.confirm(ehAdmin ? 'Encerrar o grupo para todos?' : 'Sair do grupo?')) return

    setSalvando(true)

    if (ehAdmin) {
      const { data: membrosAtivos } = await supabase
        .from('grupo_membros')
        .select('whatsapp')
        .eq('grupo_id', grupo.id)
        .eq('status', 'ativo')

      const { data: prof } = await supabase
        .from('profiles')
        .select('evolution_instancia')
        .eq('id', user.id)
        .single()

      if (prof?.evolution_instancia && membrosAtivos?.length) {
        for (const membro of membrosAtivos) {
          await fetch('/api/evolution/grupo/remover-membro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instancia: prof.evolution_instancia,
              grupoJid: grupo.whatsapp_grupo_id,
              numero: membro.whatsapp,
            }),
          })
        }
      }

      // Bot sai do grupo WhatsApp
      if (prof?.evolution_instancia && grupo.whatsapp_grupo_id) {
        await fetch('/api/evolution/grupo/encerrar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instancia: prof.evolution_instancia,
            grupoJid: grupo.whatsapp_grupo_id,
          }),
        })
      }

      await supabase.from('grupo_membros')
        .update({ status: 'removido' })
        .eq('grupo_id', grupo.id)

      await supabase.from('grupos')
        .update({ ativo: false })
        .eq('id', grupo.id)

      console.log('[sairDoGrupo] limpando profile...')
      await supabase.from('profiles')
        .update({ grupo_id_principal: null, setup_completo: false, evolution_instancia: null })
        .eq('id', user.id)

    } else {
      const { data: adminProf } = await supabase
        .from('profiles')
        .select('evolution_instancia')
        .eq('id', grupo.criado_por)
        .single()

      const { data: meuPerfil } = await supabase
        .from('profiles')
        .select('whatsapp')
        .eq('id', user.id)
        .single()

      if (adminProf?.evolution_instancia && meuPerfil?.whatsapp) {
        await fetch('/api/evolution/grupo/remover-membro', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instancia: adminProf.evolution_instancia,
            grupoJid: grupo.whatsapp_grupo_id,
            numero: meuPerfil.whatsapp,
          }),
        })
      }

      await supabase.from('grupo_membros')
        .update({ status: 'removido' })
        .eq('grupo_id', grupo.id)
        .eq('user_id', user.id)
    }

    setGrupo(null)
    setSucesso(ehAdmin ? 'Grupo encerrado com sucesso!' : 'Você saiu do grupo.')
    setSalvando(false)
    setTimeout(() => setSucesso(''), 3000)
  }

  async function convidarMembro() {
    if (!novoNumero.trim() || !grupo) return
    setConvidan(true); setErro(''); setSucesso('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res  = await fetch('/api/grupo/convidar', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userId: user.id, numero: novoNumero.trim(), grupo_id: grupo.id }),
    })
    const data = await res.json()
    setConvidan(false)
    if (!res.ok) { setErro(data.error || 'Erro ao convidar'); return }
    setSucesso('Convite enviado via WhatsApp!')
    setNovoNum('')
    carregar()
    setTimeout(() => setSucesso(''), 3000)
  }

  async function removerMembro(membroId: string, whatsapp: string) {
    if (!confirm('Remover este membro do grupo?')) return
    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !grupo) { setSalvando(false); return }

    const { data: prof } = await supabase
      .from('profiles')
      .select('evolution_instancia')
      .eq('id', user.id)
      .single()

    console.log('[remover] chamando evolution com:', { instancia: prof?.evolution_instancia, grupoJid: grupo.whatsapp_grupo_id, numero: whatsapp })

    if (prof?.evolution_instancia && grupo.whatsapp_grupo_id) {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/evolution/grupo/remover-membro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instancia: prof.evolution_instancia,
          grupoJid: grupo.whatsapp_grupo_id,
          numero: whatsapp,
        }),
      })
    }

    // Remove do banco sempre (mesmo se Evolution retornar erro)
    await supabase.from('grupo_membros')
      .update({ status: 'removido' })
      .eq('id', membroId)

    setSucesso('Membro removido!')
    carregar()
    setSalvando(false)
    setTimeout(() => setSucesso(''), 3000)
  }

  async function excluirConta() {
    const confirmacao1 = window.confirm(
      '⚠️ Tem certeza que deseja excluir sua conta?\n\nTodos os seus dados serão apagados permanentemente:\n- Transações\n- Metas\n- Histórico\n- Grupo familiar'
    )
    if (!confirmacao1) return

    const confirmacao2 = window.confirm(
      '🚨 Esta ação é IRREVERSÍVEL.\n\nDigite OK para confirmar a exclusão definitiva da sua conta.'
    )
    if (!confirmacao2) return

    setSalvando(true)
    const res = await fetch('/api/conta/excluir', { method: 'DELETE' })

    if (res.ok) {
      await supabase.auth.signOut()
      router.push('/?conta=excluida')
    } else {
      setErro('Erro ao excluir conta. Tente novamente.')
      setSalvando(false)
    }
  }

  async function salvarConfiguracoes(campos: Partial<{ timezone: string; idioma: string }>) {
    setSalvando(true); setErro(''); setSucesso('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSalvando(false); return }
    const { error } = await supabase.from('profiles').update(campos).eq('id', user.id)
    setSalvando(false)
    if (error) { setErro('Erro ao salvar: ' + error.message); return }
    setSucesso('Configurações salvas!')
    setTimeout(() => setSucesso(''), 3000)
  }

  async function salvarNotificacoesCelular(valor: boolean) {
    setSalvandoNotif(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) await supabase.from('profiles').update({ notificacoes_celular: valor }).eq('id', user.id)
    setNotificacoesCelular(valor)
    setSalvandoNotif(false)
  }

  async function salvarPushPrefs(novas: typeof pushPrefs) {
    setSalvandoPushPrefs(true)
    await fetch('/api/push/preferencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(novas),
    })
    setPushPrefs(novas)
    setSalvandoPushPrefs(false)
  }

  function copiarUrlWebhook() {
    const url = `${window.location.origin}/api/webhook/${profile?.id}`
    navigator.clipboard.writeText(url)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', background: cores.inputBg,
    border: `1px solid ${cores.inputBorder}`, borderRadius: 8, color: cores.text,
    fontSize: 13, outline: 'none',
  }

  const labelStyle = {
    display: 'block', fontSize: 10, fontWeight: 500,
    color: cores.textMuted, marginBottom: 5,
    textTransform: 'uppercase' as const, letterSpacing: '.05em',
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 13, color: cores.textMuted, fontFamily: 'system-ui' }}>Carregando perfil...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: cores.pageBg, fontFamily: 'system-ui, sans-serif', fontSize: 13, color: cores.text }}>

      <Suspense><AssinaturaAutoStart onAssinar={assinarPlano} /></Suspense>

      {/* Topbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '.875rem 1.5rem', borderBottom: `1px solid ${cores.border}`, background: cores.topbarBg }}>
        <button onClick={() => router.push('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Dashboard
        </button>
        <span style={{ color: 'rgba(255,255,255,.2)' }}>/</span>
        <span style={{ fontSize: 15, fontWeight: 500 }}>Perfil</span>
      </div>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '1.5rem' }}>

        {/* Avatar + nome */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: '1.5rem', padding: '1.25rem', background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 14 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar url={profile?.avatar_url} nome={profile?.nome || 'U'} size={56} onClick={() => setModalAv(true)} />
            <div style={{ position: 'absolute', bottom: 0, right: 0, width: 18, height: 18, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '2px solid #0a0a0a' }} onClick={() => setModalAv(true)}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1 5.5l1.5-1.5 3.5-3.5L7.5 2 4 5.5l-2.5.5-.5-.5z" stroke="#fff" strokeWidth="1" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>{profile?.nome} {profile?.sobrenome}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginTop: 2 }}>{email}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <span style={{ fontSize: 10, background: profile?.plano === 'pro' ? 'rgba(251,191,36,.15)' : 'rgba(74,222,128,.1)', color: profile?.plano === 'pro' ? '#fbbf24' : '#4ade80', padding: '2px 8px', borderRadius: 10, fontWeight: 500, textTransform: 'uppercase' }}>
                {profile?.plano === 'pro' ? '⭐ Pro' : 'Free'}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>
                desde {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Abas */}
        <div style={{ background: cores.surfaceAlt, border: `1px solid ${cores.borderMid}`, borderRadius: 8, padding: 3, marginBottom: '1.25rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div style={{ display: 'flex', gap: 4, minWidth: 'max-content' }}>
            {([
              { id: 'perfil',        label: 'Dados pessoais' },
              { id: 'prioridades',   label: '🎯 Prioridades' },
              { id: 'configuracoes', label: 'Configurações' },
              { id: 'webhook',       label: 'Webhook' },
              { id: 'grupo',         label: '👥 Pessoas' },
              { id: 'plano',         label: 'Plano' },
              { id: 'seguranca',     label: 'Segurança' },
            ] as const).map(a => (
              <button key={a.id} onClick={() => { setAbaSel(a.id); setErro(''); setSucesso('') }} style={{
                padding: '7px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                whiteSpace: 'nowrap',
                background: abaSel === a.id ? '#16a34a' : 'transparent',
                color: abaSel === a.id ? '#fff' : cores.textMuted,
              }}>{a.label}</button>
            ))}
          </div>
        </div>

        {/* Feedback */}
        {sucesso && <div style={{ background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#4ade80', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,7 5.5,10.5 12,3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          {sucesso}
        </div>}
        {erro && <div style={{ background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#f87171', marginBottom: 12 }}>{erro}</div>}

        {/* ── DADOS PESSOAIS ── */}
        {abaSel === 'perfil' && (
          <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1.25rem' }}>
            <form onSubmit={salvarPerfil}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={labelStyle}>Nome</label>
                  <input value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Seu nome" required style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Sobrenome</label>
                  <input value={form.sobrenome} onChange={e => setForm(p => ({ ...p, sobrenome: e.target.value }))} placeholder="Seu sobrenome" style={inputStyle} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>WhatsApp</label>
                <input
                  value={form.whatsapp}
                  onChange={e => setForm(p => ({ ...p, whatsapp: e.target.value }))}
                  placeholder="5511999999999 (DDI + DDD + número)"
                  type="tel"
                  style={inputStyle}
                />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>
                  Número autorizado a enviar mensagens e receber alertas via WhatsApp. Formato: <strong style={{color: 'rgba(255,255,255,.5)'}}>5511999999999</strong>
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>E-mail</label>
                <input value={email} disabled style={{ ...inputStyle, opacity: 0.5, cursor: 'not-allowed' }} />
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', marginTop: 4 }}>O e-mail não pode ser alterado por aqui.</div>
              </div>
              <button type="submit" disabled={salvando} style={{ padding: '10px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
                {salvando ? 'Salvando...' : 'Salvar alterações'}
              </button>
            </form>
          </div>
        )}

        {/* ── CONFIGURAÇÕES ── */}
        {abaSel === 'configuracoes' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Tema */}
            <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Tema</div>
              <div style={{ fontSize: 12, color: cores.textMuted, marginBottom: 16 }}>Escolha a aparência do aplicativo</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10 }}>

                {/* Tema Escuro */}
                <button
                  onClick={() => alterarTemaCtx('escuro')}
                  style={{
                    padding: '14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: tema === 'escuro' ? 'rgba(74,222,128,.08)' : 'rgba(255,255,255,.03)',
                    border: `2px solid ${tema === 'escuro' ? '#4ade80' : '#1a3a1a'}`,
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ background: '#0a0a0a', borderRadius: 6, padding: '8px', marginBottom: 10, border: '1px solid #222' }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      <div style={{ height: 4, width: '60%', background: '#1a3a1a', borderRadius: 2 }} />
                      <div style={{ height: 4, width: '30%', background: '#4ade8033', borderRadius: 2 }} />
                    </div>
                    <div style={{ height: 3, width: '80%', background: '#111', borderRadius: 2, marginBottom: 3 }} />
                    <div style={{ height: 3, width: '50%', background: '#111', borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 1 }}>🌙 Escuro</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>Padrão</div>
                    </div>
                    {tema === 'escuro' && (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 3.8,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </div>
                </button>

                {/* Tema Claro */}
                <button
                  onClick={() => alterarTemaCtx('claro')}
                  style={{
                    padding: '14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: tema === 'claro' ? 'rgba(22,163,74,.08)' : 'rgba(255,255,255,.03)',
                    border: `2px solid ${tema === 'claro' ? '#16a34a' : '#1a3a1a'}`,
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ background: '#f5f5f5', borderRadius: 6, padding: '8px', marginBottom: 10, border: '1px solid #e0e0e0' }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      <div style={{ height: 4, width: '60%', background: '#d0d0d0', borderRadius: 2 }} />
                      <div style={{ height: 4, width: '30%', background: '#16a34a55', borderRadius: 2 }} />
                    </div>
                    <div style={{ height: 3, width: '80%', background: '#e8e8e8', borderRadius: 2, marginBottom: 3 }} />
                    <div style={{ height: 3, width: '50%', background: '#e8e8e8', borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 1 }}>☀️ Claro</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>Pergaminho</div>
                    </div>
                    {tema === 'claro' && (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 3.8,7.5 8.5,2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </div>
                </button>

                {/* Tema Medieval */}
                <button
                  onClick={() => alterarTemaCtx('medieval')}
                  style={{
                    padding: '14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                    background: tema === 'medieval' ? 'rgba(212,175,55,.10)' : 'rgba(255,255,255,.03)',
                    border: `2px solid ${tema === 'medieval' ? '#D4AF37' : '#1a3a1a'}`,
                    transition: 'all .15s',
                  }}
                >
                  {/* Preview medieval — pedra e ouro */}
                  <div style={{ background: '#0e0904', borderRadius: 6, padding: '8px', marginBottom: 10, border: '1px solid #3d2e0a', backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 7px,rgba(0,0,0,.2) 7px,rgba(0,0,0,.2) 8px),repeating-linear-gradient(90deg,transparent,transparent 11px,rgba(0,0,0,.1) 11px,rgba(0,0,0,.1) 12px)' }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 5 }}>
                      <div style={{ height: 4, width: '60%', background: '#1c1409', borderRadius: 2, border: '1px solid #3d2e0a' }} />
                      <div style={{ height: 4, width: '30%', background: '#D4AF3744', borderRadius: 2 }} />
                    </div>
                    <div style={{ height: 3, width: '80%', background: '#3d2e0a', borderRadius: 2, marginBottom: 3 }} />
                    <div style={{ height: 3, width: '50%', background: '#3d2e0a', borderRadius: 2 }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#D4AF37', marginBottom: 1, fontFamily: 'var(--font-cinzel, Georgia, serif)' }}>⚔ Medieval</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>Pedra & Ouro</div>
                    </div>
                    {tema === 'medieval' && (
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 3.8,7.5 8.5,2" stroke="#0e0904" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    )}
                  </div>
                </button>

              </div>
              {tema === 'medieval' && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(212,175,55,.08)', border: '1px solid rgba(212,175,55,.25)', borderRadius: 8, fontSize: 11, color: '#D4AF37', fontFamily: 'var(--font-cinzel, Georgia, serif)', letterSpacing: '0.04em' }}>
                  ⚔ O Reino dos Guerreiros está ativo. Que sua jornada seja épica!
                </div>
              )}
              {tema === 'claro' && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(37,99,235,.08)', border: '1px solid rgba(37,99,235,.2)', borderRadius: 8, fontSize: 11, color: '#2563EB' }}>
                  ☀️ Tema claro ativo — visual moderno e limpo.
                </div>
              )}
            </div>

            {/* Idioma */}
            <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Idioma</div>
              <div style={{ fontSize: 12, color: cores.textMuted, marginBottom: 12 }}>Idioma usado nas datas e formatações do app</div>
              <select
                value={form.idioma}
                onChange={e => setForm(p => ({ ...p, idioma: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer', marginBottom: 12 }}
              >
                <option value="pt-BR">🇧🇷 Português (Brasil)</option>
                <option value="en-US">🇺🇸 English (US)</option>
                <option value="es-ES">🇪🇸 Español</option>
              </select>
              <button
                onClick={() => salvarConfiguracoes({ idioma: form.idioma })}
                disabled={salvando}
                style={{ padding: '8px 16px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}
              >
                {salvando ? 'Salvando...' : 'Salvar idioma'}
              </button>
            </div>

            {/* Notificações WhatsApp */}
            <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    📱 Notificações no WhatsApp
                  </div>
                  <div style={{ fontSize: 12, color: cores.textMuted, lineHeight: 1.6 }}>
                    Receba alertas financeiros personalizados no seu WhatsApp (máx. 2 por dia). Inclui dicas da IA, avisos de orçamento e atualizações de metas.
                  </div>
                  {!form.whatsapp && (
                    <div style={{ marginTop: 8, fontSize: 11, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 5 }}>
                      ⚠️ Cadastre seu número na aba <strong>Perfil</strong> para ativar.
                    </div>
                  )}
                </div>
                {/* Toggle */}
                <button
                  onClick={() => !salvandoNotif && form.whatsapp && salvarNotificacoesCelular(!notificacoesCelular)}
                  disabled={salvandoNotif || !form.whatsapp}
                  title={!form.whatsapp ? 'Cadastre seu WhatsApp primeiro' : ''}
                  style={{
                    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: form.whatsapp ? 'pointer' : 'not-allowed',
                    background: notificacoesCelular && form.whatsapp ? cores.accent : 'rgba(255,255,255,.12)',
                    position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: salvandoNotif ? 0.6 : 1,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3,
                    left: notificacoesCelular && form.whatsapp ? 25 : 3,
                    width: 20, height: 20, borderRadius: '50%', background: '#fff',
                    transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
                  }} />
                </button>
              </div>
              {notificacoesCelular && form.whatsapp && (
                <div style={{ marginTop: 10, padding: '8px 12px', background: `${cores.accent}0d`, border: `1px solid ${cores.accent}25`, borderRadius: 8, fontSize: 11, color: cores.accent }}>
                  ✅ Ativo — você receberá até 2 notificações por dia no {form.whatsapp.replace(/(\d{2})(\d{2})\d+(\d{4})/, '$1$2•••••$3')}
                </div>
              )}
            </div>

            {/* Notificações push */}
            <PushManagerInline />

            {/* Preferências de alertas inteligentes */}
            <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Alertas inteligentes</div>
              <div style={{ fontSize: 12, color: cores.textMuted, marginBottom: 14 }}>Escolha quais notificações push automáticas você quer receber</div>

              {[
                { key: 'resumo_semanal'   as const, emoji: '📅', titulo: 'Resumo semanal', desc: 'Todo domingo: receitas, gastos e resultado da semana' },
                { key: 'aviso_meta'       as const, emoji: '🎯', titulo: 'Meta com prazo próximo', desc: 'Aviso quando uma meta vence em 7 dias e ainda não foi concluída' },
                { key: 'alerta_orcamento' as const, emoji: '📊', titulo: 'Orçamento quase estourado', desc: 'Alerta quando um orçamento passa de 80% do limite' },
              ].map(item => {
                const ativo = pushPrefs[item.key]
                return (
                  <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderBottom: `1px solid ${cores.borderMid}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ fontSize: 18, marginTop: 1 }}>{item.emoji}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: cores.text }}>{item.titulo}</div>
                        <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 2 }}>{item.desc}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => !salvandoPushPrefs && salvarPushPrefs({ ...pushPrefs, [item.key]: !ativo })}
                      disabled={salvandoPushPrefs}
                      style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: ativo ? cores.accent : 'rgba(255,255,255,.12)', position: 'relative', transition: 'background .2s', flexShrink: 0, opacity: salvandoPushPrefs ? 0.6 : 1 }}
                    >
                      <div style={{ position: 'absolute', top: 2, left: ativo ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Indicar amigos */}
            {currentUserId && (
              <ConvidarAmigos userId={currentUserId} nomeUsuario={form.nome} />
            )}

            {/* Fuso horário */}
            <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Fuso horário</div>
              <div style={{ fontSize: 12, color: cores.textMuted, marginBottom: 12 }}>Usado para exibir datas e horas corretamente no app e nas mensagens WhatsApp</div>
              <select
                value={form.timezone}
                onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}
                style={{ ...inputStyle, cursor: 'pointer', marginBottom: 12 }}
              >
                <optgroup label="Brasil">
                  <option value="America/Sao_Paulo">🇧🇷 Brasília (GMT-3)</option>
                  <option value="America/Manaus">🇧🇷 Manaus (GMT-4)</option>
                  <option value="America/Belem">🇧🇷 Belém (GMT-3)</option>
                  <option value="America/Fortaleza">🇧🇷 Fortaleza (GMT-3)</option>
                  <option value="America/Recife">🇧🇷 Recife (GMT-3)</option>
                  <option value="America/Noronha">🇧🇷 Fernando de Noronha (GMT-2)</option>
                  <option value="America/Porto_Velho">🇧🇷 Porto Velho (GMT-4)</option>
                  <option value="America/Boa_Vista">🇧🇷 Boa Vista (GMT-4)</option>
                  <option value="America/Rio_Branco">🇧🇷 Rio Branco (GMT-5)</option>
                </optgroup>
                <optgroup label="América do Sul">
                  <option value="America/Argentina/Buenos_Aires">🇦🇷 Buenos Aires (GMT-3)</option>
                  <option value="America/Santiago">🇨🇱 Santiago (GMT-3)</option>
                  <option value="America/Lima">🇵🇪 Lima (GMT-5)</option>
                  <option value="America/Bogota">🇨🇴 Bogotá (GMT-5)</option>
                </optgroup>
                <optgroup label="América do Norte">
                  <option value="America/New_York">🇺🇸 New York (GMT-5)</option>
                  <option value="America/Chicago">🇺🇸 Chicago (GMT-6)</option>
                  <option value="America/Denver">🇺🇸 Denver (GMT-7)</option>
                  <option value="America/Los_Angeles">🇺🇸 Los Angeles (GMT-8)</option>
                  <option value="America/Toronto">🇨🇦 Toronto (GMT-5)</option>
                </optgroup>
                <optgroup label="Europa">
                  <option value="Europe/Lisbon">🇵🇹 Lisboa (GMT+0)</option>
                  <option value="Europe/London">🇬🇧 Londres (GMT+0)</option>
                  <option value="Europe/Paris">🇫🇷 Paris (GMT+1)</option>
                  <option value="Europe/Berlin">🇩🇪 Berlin (GMT+1)</option>
                </optgroup>
                <optgroup label="UTC">
                  <option value="UTC">🌍 UTC (GMT+0)</option>
                </optgroup>
              </select>
              <button
                onClick={() => salvarConfiguracoes({ timezone: form.timezone })}
                disabled={salvando}
                style={{ padding: '8px 16px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}
              >
                {salvando ? 'Salvando...' : 'Salvar fuso horário'}
              </button>
            </div>

          </div>
        )}

        {/* ── WEBHOOK ── */}
        {abaSel === 'webhook' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Status */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 3 }}>Status do webhook</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Receba transações automaticamente via n8n ou outros sistemas</div>
                </div>
                <div onClick={toggleWebhook} style={{
                  width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                  background: webhook?.ativo ? '#16a34a' : 'rgba(255,255,255,.1)',
                  position: 'relative', transition: 'background .2s', flexShrink: 0,
                }}>
                  <div style={{ position: 'absolute', top: 3, left: webhook?.ativo ? 22 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: webhook?.ativo ? '#4ade80' : '#6b7280' }} />
                <span style={{ fontSize: 12, color: webhook?.ativo ? '#4ade80' : 'rgba(255,255,255,.4)' }}>
                  {webhook?.ativo ? 'Ativo — recebendo transações' : 'Inativo'}
                </span>
              </div>
            </div>

            {/* URL */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>URL do endpoint</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,.6)', wordBreak: 'break-all' }}>
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/${profile?.id}` : '/api/webhook/...'}
                </div>
                <button onClick={copiarUrlWebhook} style={{ padding: '9px 14px', background: copiado ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.06)', border: `1px solid ${copiado ? 'rgba(74,222,128,.3)' : '#1a3a1a'}`, borderRadius: 8, color: copiado ? '#4ade80' : 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {copiado ? '✓ copiado' : 'Copiar'}
                </button>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.3)', marginTop: 6 }}>Use esta URL no n8n como destino do webhook. Sempre envie o token no header <code style={{ color: '#4ade80' }}>Authorization: Bearer TOKEN</code></div>
            </div>

            {/* Token */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Token de autenticação</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1, padding: '9px 12px', background: '#0a1a0a', border: '1px solid #1a3a1a', borderRadius: 8, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,.7)', letterSpacing: tokenVisivel ? '0' : '0.2em' }}>
                  {tokenVisivel ? (webhook?.token || '—') : '••••••••••••••••••••••••'}
                </div>
                <button onClick={() => setTokenVis(!tokenVisivel)} style={{ padding: '9px 12px', background: 'rgba(255,255,255,.06)', border: '1px solid #1a3a1a', borderRadius: 8, color: 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>
                  {tokenVisivel ? 'Ocultar' : 'Mostrar'}
                </button>
                <button onClick={copiarToken} style={{ padding: '9px 12px', background: copiado ? 'rgba(74,222,128,.15)' : 'rgba(255,255,255,.06)', border: `1px solid ${copiado ? 'rgba(74,222,128,.3)' : '#1a3a1a'}`, borderRadius: 8, color: copiado ? '#4ade80' : 'rgba(255,255,255,.5)', fontSize: 12, cursor: 'pointer' }}>
                  {copiado ? '✓' : 'Copiar'}
                </button>
              </div>
              <button onClick={regenerarToken} style={{ fontSize: 11, padding: '6px 12px', background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, color: '#f87171', cursor: 'pointer' }}>
                ⚠ Regenerar token — invalida o token atual
              </button>
            </div>

            {/* Formato payload */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Formato do payload</div>
              <div style={{ background: '#0a0a0a', borderRadius: 8, padding: '12px', fontFamily: 'monospace', fontSize: 11, color: '#4ade80', lineHeight: 1.8 }}>
                {`{
  "descricao": "Supermercado Extra",
  "valor": -87.50,
  "data_hora": "2026-04-23T10:00:00Z",
  "tipo": "debito",
  "categoria": "Alimentação"
}`}
              </div>
            </div>
          </div>
        )}

        {/* ── GRUPO ── */}
        {abaSel === 'grupo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!grupo ? (
              <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
                  Você ainda não tem um grupo configurado.
                </div>
                <button onClick={() => router.push('/setup')} style={{ padding: '9px 18px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, cursor: 'pointer', fontWeight: 500 }}>
                  Criar novo grupo
                </button>
              </div>
            ) : (
              <>
                {/* Info do grupo */}
                <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{grupo.nome}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)' }}>
                    {membros.length} membro{membros.length !== 1 ? 's' : ''}
                  </div>
                </div>

                {/* Convidar */}
                <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>Convidar membro</div>
                  {profile?.plano !== 'pro' ? (
                    <div style={{ background: 'rgba(251,191,36,.07)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#fbbf24' }}>
                      ⭐ Convide membros com o plano Pro
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={novoNumero}
                        onChange={e => setNovoNum(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && convidarMembro()}
                        placeholder="5511999999999"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button onClick={convidarMembro} disabled={convidando || !novoNumero.trim()} style={{ padding: '9px 14px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: convidando ? 'default' : 'pointer', opacity: convidando ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                        {convidando ? 'Enviando...' : 'Convidar'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Lista de membros */}
                <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>Membros</div>
                  {membros.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,.3)' }}>Nenhum membro ainda. Convide alguém!</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {membros.map(m => {
                        const prof = Array.isArray(m.profiles) ? m.profiles[0] : (m.profiles as { nome: string; avatar_url?: string | null } | null)
                        const nomeExibido = prof?.nome || 'Convidado'
                        return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: '#0a1a0a', borderRadius: 8, border: '1px solid #1a3a1a' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Avatar url={prof?.avatar_url} nome={nomeExibido} size={36} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{nomeExibido}</div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', marginTop: 1 }}>{m.whatsapp}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 500, background: m.status === 'ativo' ? 'rgba(74,222,128,.12)' : 'rgba(251,191,36,.12)', color: m.status === 'ativo' ? '#4ade80' : '#fbbf24' }}>
                              {m.status === 'ativo' ? 'ativo' : 'pendente'}
                            </span>
                            {profile?.plano === 'pro' && (
                              <button onClick={() => removerMembro(m.id, m.whatsapp)} disabled={salvando} style={{ padding: '3px 8px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, color: '#f87171', fontSize: 11, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.5 : 1 }}>
                                Remover
                              </button>
                            )}
                          </div>
                        </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Conta padrão */}
            {grupo && contasPerfil.length > 0 && (() => {
              const contaAtual = contasPerfil.find(c => c.id === contaPadrao)
              return (
                <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Conta padrão para lançamentos do grupo</div>
                  <div style={{ fontSize: 12, color: cores.textMuted, marginBottom: 12 }}>
                    Lançamentos via WhatsApp sem conta especificada usarão esta conta.
                  </div>

                  {/* Preview da conta selecionada */}
                  {contaAtual ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(74,222,128,.08)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, marginBottom: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                        {(contaAtual.bancos?.nome_curto || contaAtual.nome)[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#4ade80' }}>{contaAtual.bancos?.nome_curto || '—'} — {contaAtual.nome}</div>
                        <div style={{ fontSize: 10, color: cores.textMuted }}>Conta padrão ativa</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '8px 12px', background: cores.surfaceAlt, border: `1px solid ${cores.borderMid}`, borderRadius: 8, marginBottom: 10, fontSize: 12, color: cores.textMuted }}>
                      Nenhuma conta padrão definida — lançamentos ficam sem vínculo.
                    </div>
                  )}

                  <select
                    value={contaPadrao}
                    onChange={async e => {
                      const val = e.target.value
                      setContaPadrao(val)
                      const { data: { user } } = await supabase.auth.getUser()
                      if (!user) return
                      await supabase.from('profiles').update({ conta_padrao_id: val || null }).eq('id', user.id)
                      setSucesso('Conta padrão atualizada!')
                      setTimeout(() => setSucesso(''), 2000)
                    }}
                    style={inputStyle}
                  >
                    <option value="">Sem conta padrão</option>
                    {contasPerfil.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.bancos?.nome_curto || '—'} — {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })()}

            {/* Sair / Encerrar grupo */}
            {grupo && (() => {
              const isAdmin = grupo.criado_por === profile?.id
              return (
                <div style={{ marginTop: 4, padding: '1rem', background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#f87171', marginBottom: 6 }}>
                    {isAdmin ? 'Encerrar grupo' : 'Sair do grupo'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
                    {isAdmin
                      ? 'Remove todos os membros e encerra o grupo PoupaUp.'
                      : 'Você será removido do grupo e perderá acesso às metas compartilhadas.'}
                  </div>
                  <button onClick={sairDoGrupo} disabled={salvando} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(239,68,68,.3)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 500, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
                    {isAdmin ? 'Encerrar grupo' : 'Sair do grupo'}
                  </button>
                </div>
              )
            })()}

            {/* ── Acesso ao App (Família) ── */}
            <div style={{ marginTop: 8, borderTop: `1px solid ${cores.borderMid}`, paddingTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: cores.text, marginBottom: 4 }}>👨‍👩‍👧 Acesso ao App — Família</div>
              <div style={{ fontSize: 12, color: cores.textMuted, marginBottom: 16, lineHeight: 1.6 }}>
                Convide pessoas por e-mail para acessar seu painel financeiro. Permissão de <strong style={{ color: cores.text }}>leitura</strong> permite apenas visualizar; <strong style={{ color: cores.text }}>edição</strong> permite lançar transações.
              </div>

              {/* Formulário de convite */}
              <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1rem', marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Convidar por e-mail</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="email"
                    value={familiaEmail}
                    onChange={e => setFamiliaEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && familiaConvidar()}
                    placeholder="email@exemplo.com"
                    style={{ ...inputStyle, flex: 1, minWidth: 180 }}
                  />
                  <select value={familiaPerm} onChange={e => setFamiliaPerm(e.target.value as 'leitura' | 'edicao')} style={{ ...inputStyle, width: 120 }}>
                    <option value="leitura">Leitura</option>
                    <option value="edicao">Edição</option>
                  </select>
                  <button onClick={familiaConvidar} disabled={familiaConvidando || !familiaEmail.trim()}
                    style={{ padding: '9px 16px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: familiaConvidando ? 'default' : 'pointer', opacity: familiaConvidando ? 0.6 : 1, whiteSpace: 'nowrap' }}>
                    {familiaConvidando ? 'Enviando...' : 'Convidar'}
                  </button>
                </div>
              </div>

              {/* Convites pendentes */}
              {familiaConvites.length > 0 && (
                <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1rem', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10, color: cores.textMuted }}>Convites pendentes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {familiaConvites.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: 'rgba(251,191,36,.05)', border: '1px solid rgba(251,191,36,.15)', borderRadius: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, color: cores.text }}>{c.email}</div>
                          <div style={{ fontSize: 10, color: cores.textFaint }}>
                            {c.permissao === 'edicao' ? 'Edição' : 'Leitura'} · expira {new Date(c.expires_at).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: 'rgba(251,191,36,.12)', color: '#fbbf24' }}>Aguardando</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Membros com acesso */}
              <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 10 }}>Membros com acesso ({familiaMembros.length})</div>
                {familiaMembros.length === 0 ? (
                  <div style={{ fontSize: 12, color: cores.textMuted }}>Nenhum membro ainda. Envie um convite acima.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {familiaMembros.map(m => {
                      const prof = m.profiles
                      return (
                        <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', background: cores.surfaceAlt, borderRadius: 8, border: `1px solid ${cores.borderMid}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {(prof?.nome || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{prof?.nome || 'Usuário'}</div>
                              <div style={{ fontSize: 10, color: cores.textFaint }}>
                                {m.permissao === 'edicao' ? '✏️ Edição' : '👁 Leitura'} · desde {new Date(m.created_at).toLocaleDateString('pt-BR')}
                              </div>
                            </div>
                          </div>
                          <button onClick={() => familiaRemoverMembro(m.id)} disabled={familiaRem === m.id}
                            style={{ padding: '4px 10px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 6, color: '#f87171', fontSize: 11, cursor: familiaRem === m.id ? 'default' : 'pointer', opacity: familiaRem === m.id ? 0.5 : 1 }}>
                            {familiaRem === m.id ? '...' : 'Remover'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PLANO ── */}
        {abaSel === 'plano' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Free */}
              <div style={{ background: profile?.plano === 'free' ? 'rgba(74,222,128,.06)' : '#111', border: `1px solid ${profile?.plano === 'free' ? 'rgba(74,222,128,.3)' : '#1a3a1a'}`, borderRadius: 14, padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Free</div>
                  {profile?.plano === 'free' && <span style={{ fontSize: 10, background: 'rgba(74,222,128,.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 10 }}>Plano atual</span>}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80', marginBottom: 14 }}>R$ 0<span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,.4)' }}>/mês</span></div>
                {['5 metas', '10 webhooks/min', 'PoupaBot básico', 'Dashboard completo'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="1.5,6 4.5,9 10.5,3" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </div>
                ))}
              </div>

              {/* Pro */}
              <div style={{ background: profile?.plano === 'pro' ? 'rgba(251,191,36,.06)' : '#111', border: `1px solid ${profile?.plano === 'pro' ? 'rgba(251,191,36,.3)' : '#1a3a1a'}`, borderRadius: 14, padding: '1.25rem', position: 'relative', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>Pro ⭐</div>
                  {profile?.plano === 'pro' && <span style={{ fontSize: 10, background: 'rgba(251,191,36,.15)', color: '#fbbf24', padding: '2px 8px', borderRadius: 10 }}>Plano atual</span>}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fbbf24', marginBottom: 14 }}>R$ 29<span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,.4)' }}>/mês</span></div>
                {['Metas ilimitadas', '60 webhooks/min', 'PoupaBot avançado', 'Relatórios em PDF', 'Suporte prioritário', 'Multibancos (em breve)'].map(f => (
                  <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><polyline points="1.5,6 4.5,9 10.5,3" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {f}
                  </div>
                ))}
                {profile?.plano === 'pro' ? (
                  <button onClick={abrirPortal} disabled={assinando === 'portal'} style={{ width: '100%', marginTop: 10, padding: '9px', background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', borderRadius: 8, color: '#fbbf24', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                    {assinando === 'portal' ? 'Redirecionando...' : 'Gerenciar assinatura'}
                  </button>
                ) : (
                  <button onClick={() => assinarPlano('pro')} disabled={!!assinando} style={{ width: '100%', marginTop: 10, padding: '9px', background: '#fbbf24', border: 'none', borderRadius: 8, color: '#0a0a0a', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {assinando === 'pro' ? 'Redirecionando...' : 'Assinar Pro — R$ 29/mês'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PRIORIDADES ── */}
        {abaSel === 'prioridades' && (() => {
          const CATALOGO_PRIO = [
            { tipo: 'emergencia',    titulo: 'Reserva de emergência', icon: '🛡️', desc: 'Fundo de segurança para 6 meses de despesas' },
            { tipo: 'dividas',       titulo: 'Sair das dívidas',      icon: '💳', desc: 'Quitar cartão, empréstimos e financiamentos' },
            { tipo: 'viagem',        titulo: 'Realizar uma viagem',   icon: '✈️', desc: 'Conhecer novos destinos' },
            { tipo: 'casa',          titulo: 'Casa própria',          icon: '🏠', desc: 'Dar entrada ou financiar meu imóvel' },
            { tipo: 'veiculo',       titulo: 'Carro ou moto',         icon: '🚗', desc: 'Adquirir ou trocar meu veículo' },
            { tipo: 'aposentadoria', titulo: 'Aposentadoria',         icon: '🌅', desc: 'Garantir renda para parar de trabalhar com conforto' },
            { tipo: 'investimento',  titulo: 'Investir mais',         icon: '📈', desc: 'Fazer meu dinheiro crescer' },
            { tipo: 'educacao',      titulo: 'Educação',              icon: '🎓', desc: 'Curso, faculdade, MBA, especialização' },
            { tipo: 'negocio',       titulo: 'Abrir um negócio',      icon: '🚀', desc: 'Empreender e ter minha própria empresa' },
            { tipo: 'casamento',     titulo: 'Casamento',             icon: '💍', desc: 'Realizar a cerimônia dos sonhos' },
            { tipo: 'filho',         titulo: 'Filhos e família',      icon: '👶', desc: 'Planejar filhos, creche, escola e faculdade' },
            { tipo: 'saude',         titulo: 'Saúde e bem-estar',     icon: '❤️', desc: 'Plano de saúde, academia, qualidade de vida' },
          ]

          function toggleP(tipo: string) {
            setPrioridadesSelecionadas(prev =>
              prev.includes(tipo)
                ? prev.filter(t => t !== tipo)
                : prev.length < 5 ? [...prev, tipo] : prev
            )
          }

          async function salvarPrioridades() {
            setSalvando(true)
            const novas = prioridadesSelecionadas.map((tipo, i) => {
              const cat = CATALOGO_PRIO.find(c => c.tipo === tipo)!
              return { tipo, titulo: cat.titulo, icon: cat.icon, ordem: i + 1 }
            })
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            await supabase.from('profiles').update({ prioridades: novas }).eq('id', user.id)
            setPrioridades(novas)
            setEditandoPrioridades(false)
            setSalvando(false)
            setSucesso('Prioridades atualizadas!')
            setTimeout(() => setSucesso(''), 2500)
          }

          return (
            <div style={{ background: cores.surface, border: `1px solid ${cores.borderMid}`, borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: cores.text }}>Prioridades financeiras</div>
                  <div style={{ fontSize: 11, color: cores.textMuted, marginTop: 2 }}>A IA usa esses objetivos para personalizar conselhos e análises</div>
                </div>
                {!editandoPrioridades && (
                  <button onClick={() => setEditandoPrioridades(true)}
                    style={{ fontSize: 11, padding: '5px 12px', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.25)', borderRadius: 6, color: '#4ade80', cursor: 'pointer' }}>
                    Editar
                  </button>
                )}
              </div>

              {!editandoPrioridades ? (
                prioridades.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: cores.textMuted, fontSize: 13 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🎯</div>
                    <div>Nenhuma prioridade definida ainda.</div>
                    <button onClick={() => setEditandoPrioridades(true)}
                      style={{ marginTop: 12, fontSize: 12, padding: '7px 16px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer' }}>
                      Definir agora
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {prioridades.map((p, i) => {
                      const pm = p as typeof p & { valor_alvo?: number; valor_atual?: number; contribuicao_mensal?: number; prazo_meses?: number }
                      const pct = pm.valor_alvo ? Math.min(100, Math.round(((pm.valor_atual ?? 0) / pm.valor_alvo) * 100)) : null
                      const aberto = metricsExpandidoIdx === i
                      const ed = metricasEdit[i]

                      function abrirMetricas() {
                        setMetricasEdit(prev => ({
                          ...prev,
                          [i]: {
                            valor_alvo: pm.valor_alvo?.toString() ?? '',
                            valor_atual: pm.valor_atual?.toString() ?? '',
                            contribuicao_mensal: pm.contribuicao_mensal?.toString() ?? '',
                            prazo_meses: pm.prazo_meses?.toString() ?? '',
                          }
                        }))
                        setMetricsExpandidoIdx(aberto ? null : i)
                      }

                      async function salvarMetricas() {
                        const m = metricasEdit[i]; if (!m) return
                        const novas = prioridades.map((px, idx) => idx === i ? {
                          ...px,
                          valor_alvo: parseFloat(m.valor_alvo) || undefined,
                          valor_atual: parseFloat(m.valor_atual) || undefined,
                          contribuicao_mensal: parseFloat(m.contribuicao_mensal) || undefined,
                          prazo_meses: parseInt(m.prazo_meses) || undefined,
                        } : px)
                        const { data: { user } } = await supabase.auth.getUser()
                        if (!user) return
                        await supabase.from('profiles').update({ prioridades: novas }).eq('id', user.id)
                        setPrioridades(novas as typeof prioridades)
                        setMetricsExpandidoIdx(null)
                        setSucesso('Métricas salvas!'); setTimeout(() => setSucesso(''), 2000)
                      }

                      return (
                        <div key={p.tipo} style={{ background: cores.surfaceAlt, border: `1px solid ${aberto ? cores.accent : cores.border}`, borderRadius: 10, overflow: 'hidden', transition: 'border-color .2s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', cursor: 'pointer' }} onClick={abrirMetricas}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: cores.accent, width: 18, textAlign: 'center', flexShrink: 0 }}>#{i + 1}</span>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{p.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: cores.text }}>{p.titulo}</div>
                              {pct !== null ? (
                                <div style={{ marginTop: 4 }}>
                                  <div style={{ height: 4, background: cores.border, borderRadius: 2, overflow: 'hidden' }}>
                                    <div style={{ height: '100%', borderRadius: 2, width: `${pct}%`, background: pct >= 100 ? '#4ade80' : pct >= 60 ? '#fbbf24' : cores.accent, transition: 'width .5s' }} />
                                  </div>
                                  <div style={{ fontSize: 10, color: cores.textMuted, marginTop: 2 }}>{pct}% — {(pm.valor_atual ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de {pm.valor_alvo!.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                                </div>
                              ) : (
                                <div style={{ fontSize: 10, color: cores.textFaint, marginTop: 2 }}>Clique para definir meta e acompanhar progresso</div>
                              )}
                            </div>
                            <span style={{ fontSize: 11, color: cores.textMuted, flexShrink: 0 }}>{aberto ? '▲' : '▼'}</span>
                          </div>
                          {aberto && ed && (
                            <div style={{ padding: '0 12px 12px', borderTop: `1px solid ${cores.border}` }}>
                              <div style={{ paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                                {([
                                  { k: 'valor_alvo',          label: 'Meta total (R$)',       ph: 'Ex: 5000' },
                                  { k: 'valor_atual',         label: 'Já guardei (R$)',        ph: 'Ex: 1200' },
                                  { k: 'contribuicao_mensal', label: 'Poupo por mês (R$)',     ph: 'Ex: 300' },
                                  { k: 'prazo_meses',         label: 'Prazo (meses)',          ph: 'Ex: 18' },
                                ] as const).map(f => (
                                  <div key={f.k}>
                                    <div style={{ fontSize: 9, color: cores.textMuted, textTransform: 'uppercase' as const, letterSpacing: '.05em', marginBottom: 3 }}>{f.label}</div>
                                    <input type="number" min="0" placeholder={f.ph} value={ed[f.k]}
                                      onChange={e => setMetricasEdit(prev => ({ ...prev, [i]: { ...prev[i], [f.k]: e.target.value } }))}
                                      style={{ width: '100%', padding: '6px 8px', background: cores.inputBg, border: `1px solid ${cores.inputBorder}`, borderRadius: 6, color: cores.text, fontSize: 12, outline: 'none', boxSizing: 'border-box' as const }}
                                    />
                                  </div>
                                ))}
                              </div>
                              <button onClick={salvarMetricas}
                                style={{ width: '100%', padding: '7px', background: '#16a34a', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                Salvar métricas
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                <>
                  <div style={{ fontSize: 11, color: cores.textMuted, marginBottom: 12 }}>
                    Escolha até <strong style={{ color: cores.accent }}>5 prioridades</strong> em ordem de importância ({prioridadesSelecionadas.length}/5)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto', marginBottom: 16 }}>
                    {CATALOGO_PRIO.map(cat => {
                      const sel = prioridadesSelecionadas.includes(cat.tipo)
                      const bloq = !sel && prioridadesSelecionadas.length >= 5
                      return (
                        <button key={cat.tipo} onClick={() => !bloq && toggleP(cat.tipo)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '9px 12px', borderRadius: 8, textAlign: 'left',
                            border: `1px solid ${sel ? cores.accent : cores.border}`,
                            background: sel ? `${cores.accent}10` : cores.surfaceAlt,
                            cursor: bloq ? 'not-allowed' : 'pointer',
                            opacity: bloq ? 0.45 : 1, transition: 'all .15s',
                          }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{cat.icon}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: sel ? cores.accent : cores.text }}>{cat.titulo}</div>
                            <div style={{ fontSize: 10, color: cores.textMuted }}>{cat.desc}</div>
                          </div>
                          <div style={{
                            width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                            border: `1.5px solid ${sel ? cores.accent : cores.border}`,
                            background: sel ? cores.accent : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, color: '#fff', fontWeight: 700,
                          }}>
                            {sel ? prioridadesSelecionadas.indexOf(cat.tipo) + 1 : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditandoPrioridades(false); setPrioridadesSelecionadas(prioridades.map(p => p.tipo)) }}
                      style={{ flex: 1, padding: '9px', background: 'transparent', border: `1px solid ${cores.border}`, borderRadius: 8, color: cores.textMuted, fontSize: 12, cursor: 'pointer' }}>
                      Cancelar
                    </button>
                    <button onClick={salvarPrioridades} disabled={salvando || prioridadesSelecionadas.length === 0}
                      style={{ flex: 2, padding: '9px', background: prioridadesSelecionadas.length > 0 ? '#16a34a' : '#1a2e1a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: prioridadesSelecionadas.length > 0 ? 'pointer' : 'default', opacity: salvando ? 0.7 : 1 }}>
                      {salvando ? 'Salvando...' : 'Salvar prioridades'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )
        })()}

        {/* ── SEGURANÇA ── */}
        {abaSel === 'seguranca' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Alterar senha</div>
              <form onSubmit={alterarSenha}>
                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Nova senha</label>
                  <input type="password" value={senhaForm.nova} onChange={e => setSenhaForm(p => ({ ...p, nova: e.target.value }))} placeholder="mínimo 8 caracteres" required style={inputStyle} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>Confirmar nova senha</label>
                  <input type="password" value={senhaForm.confirmar} onChange={e => setSenhaForm(p => ({ ...p, confirmar: e.target.value }))} placeholder="repita a senha" required style={inputStyle} />
                </div>
                <button type="submit" disabled={salvando} style={{ padding: '10px 20px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 500, cursor: salvando ? 'default' : 'pointer', opacity: salvando ? 0.6 : 1 }}>
                  {salvando ? 'Alterando...' : 'Alterar senha'}
                </button>
              </form>
            </div>

            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Sessões ativas</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Você está conectado neste dispositivo.</div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ padding: '9px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, color: '#f87171', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>
                Encerrar todas as sessões
              </button>
            </div>

            {/* MFA */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Autenticação de dois fatores (MFA)</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
                Proteja sua conta com um código TOTP gerado por app como Google Authenticator ou Authy.
              </div>
              {mfaAtivo && mfaEtapa === 'idle' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#4ade80' }}>✅ MFA ativo</span>
                  <button onClick={desativarMfa} style={{ padding: '6px 14px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.2)', borderRadius: 8, color: '#f87171', fontSize: 12, cursor: 'pointer' }}>Desativar</button>
                </div>
              )}
              {!mfaAtivo && mfaEtapa === 'idle' && (
                <button onClick={iniciarMfa} style={{ padding: '9px 16px', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, color: '#4ade80', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Ativar MFA</button>
              )}
              {mfaEtapa === 'qr' && (
                <div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginBottom: 10 }}>
                    Escaneie o QR code com seu app autenticador ou insira a chave manualmente:
                  </div>
                  {/* QR code via API pública de geração */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(mfaUri)}`}
                    alt="QR Code MFA"
                    width={160} height={160}
                    style={{ borderRadius: 8, display: 'block', marginBottom: 10 }}
                  />
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', wordBreak: 'break-all', marginBottom: 14, fontFamily: 'monospace' }}>
                    Chave: {mfaSecretKey}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                      type="text" maxLength={6} placeholder="Código de 6 dígitos"
                      value={mfaCodigo} onChange={e => setMfaCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      style={{ width: 140, fontSize: 14, padding: '8px 10px', borderRadius: 8, border: '1px solid #1a3a1a', background: '#0a0a0a', color: '#fff', textAlign: 'center', letterSpacing: '0.2em' }}
                    />
                    <button onClick={confirmarMfa} disabled={mfaCodigo.length !== 6} style={{ padding: '8px 16px', background: '#16a34a', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12, cursor: mfaCodigo.length !== 6 ? 'default' : 'pointer', opacity: mfaCodigo.length !== 6 ? 0.5 : 1 }}>Confirmar</button>
                    <button onClick={() => { setMfaEtapa('idle'); setMfaCodigo('') }} style={{ padding: '8px 12px', background: 'transparent', border: '1px solid #333', borderRadius: 8, color: 'rgba(255,255,255,.4)', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
                  </div>
                </div>
              )}
              {mfaEtapa === 'verificando' && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)' }}>Verificando código...</div>
              )}
            </div>

            {/* Exportar dados LGPD */}
            <div style={{ background: '#111', border: '1px solid #1a3a1a', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Exportar meus dados</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>
                Baixe todos os seus dados em formato JSON (LGPD art. 18 — portabilidade).
              </div>
              <button onClick={exportarDados} disabled={exportando} style={{ padding: '9px 16px', background: 'rgba(74,222,128,.1)', border: '1px solid rgba(74,222,128,.2)', borderRadius: 8, color: '#4ade80', fontSize: 12, fontWeight: 500, cursor: exportando ? 'default' : 'pointer', opacity: exportando ? 0.6 : 1 }}>
                {exportando ? 'Preparando...' : '⬇ Baixar dados'}
              </button>
            </div>

            <div style={{ background: 'rgba(239,68,68,.04)', border: '1px solid rgba(239,68,68,.15)', borderRadius: 12, padding: '1.25rem' }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#f87171', marginBottom: 6 }}>Zona de perigo</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,.4)', marginBottom: 12 }}>Ações irreversíveis. Tenha certeza antes de continuar.</div>
              <button
                onClick={excluirConta}
                disabled={salvando}
                style={{
                  padding: '9px 16px',
                  background: 'rgba(239,68,68,.1)',
                  border: '1px solid rgba(239,68,68,.3)',
                  borderRadius: 8,
                  color: '#f87171',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: salvando ? 'not-allowed' : 'pointer',
                  opacity: salvando ? 0.6 : 1,
                }}
              >
                {salvando ? 'Excluindo...' : '🗑 Excluir minha conta'}
              </button>
            </div>
          </div>
        )}

      </div>

      {modalAvatarAberto && profile && (
        <ModalAvatar
          userId={profile.id}
          nomeAtual={profile.nome}
          avatarAtual={profile.avatar_url}
          onSalvo={novaUrl => {
            setProfile(prev => prev ? { ...prev, avatar_url: novaUrl } : prev)
            setModalAv(false)
          }}
          onFechar={() => setModalAv(false)}
        />
      )}
    </div>
  )
}
