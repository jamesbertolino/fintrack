-- Migração: adiciona whatsapp, timezone e idioma ao perfil
-- Execute no SQL Editor do Supabase para bases já existentes

alter table public.profiles
  add column if not exists whatsapp text,
  add column if not exists timezone  text not null default 'America/Sao_Paulo',
  add column if not exists idioma    text not null default 'pt-BR';
