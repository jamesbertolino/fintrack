'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { formatData, formatDataHora, formatMes } from '@/lib/formatters'

const DEFAULT_TZ   = 'America/Sao_Paulo'
const DEFAULT_LANG = 'pt-BR'

export function usePerfil() {
  const [nome, setNome]         = useState('')
  const [timezone, setTimezone] = useState(DEFAULT_TZ)
  const [idioma, setIdioma]     = useState(DEFAULT_LANG)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('nome, timezone, idioma')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (!data) return
          if (data.nome)     setNome(data.nome)
          if (data.timezone) setTimezone(data.timezone)
          if (data.idioma)   setIdioma(data.idioma)
        })
    })
  }, [])

  return {
    nome,
    timezone,
    idioma,
    fmtData:     (iso: string) => formatData(iso, timezone, idioma),
    fmtDataHora: (iso: string) => formatDataHora(iso, timezone, idioma),
    fmtMes:      (iso: string) => formatMes(iso, idioma),
  }
}
