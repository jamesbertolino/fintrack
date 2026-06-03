-- Preferência de interface do usuário (Simples / Completo)
-- Rodar no Supabase SQL Editor

alter table public.profiles
  add column if not exists modo_interface text
    default 'completo'
    check (modo_interface in ('simples', 'completo'));
