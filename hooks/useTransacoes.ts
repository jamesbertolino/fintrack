'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface Transaction {
  id: string
  descricao: string
  valor: number
  tipo: 'debito' | 'credito'
  categoria: string
  data_hora: string
  origem: string
}

export function useTransacoes(userId: string, limite = 20) {
  const [transacoes, setTransacoes] = useState<Transaction[]>([])
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!userId) return

    // 1. Buscar histórico inicial
    async function buscarTransacoes() {
      const { data } = await supabase
        .from('transactions')
        .select('id, descricao, valor, tipo, categoria, data_hora, origem')
        .eq('user_id', userId)
        .order('data_hora', { ascending: false })
        .limit(limite)

      if (data) setTransacoes(data)
      setCarregando(false)
    }

    buscarTransacoes()

    // 2. Assinar canal Realtime — atualiza ao vivo quando webhook chega
    const channel = supabase
      .channel(`transactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const nova = payload.new as Transaction
          setTransacoes((prev) => [nova, ...prev].slice(0, limite))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, limite])

  // Métricas derivadas
  const receitas = transacoes
    .filter((t) => t.tipo === 'credito')
    .reduce((acc, t) => acc + t.valor, 0)

  const despesas = transacoes
    .filter((t) => t.tipo === 'debito')
    .reduce((acc, t) => acc + Math.abs(t.valor), 0)

  const saldo = receitas - despesas

  return { transacoes, carregando, receitas, despesas, saldo }
}