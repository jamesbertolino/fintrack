-- Migração: adiciona whatsapp_grupo_id na tabela grupos
alter table public.grupos
  add column if not exists whatsapp_grupo_id text;
