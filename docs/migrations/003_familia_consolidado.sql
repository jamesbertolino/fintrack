-- Controle de consolidação familiar por membro
-- Rodar no Supabase SQL Editor

alter table public.familia_membros
  add column if not exists incluir_consolidado boolean not null default true;

comment on column public.familia_membros.incluir_consolidado is
  'Quando true, as contas (mostrar_saldo=true) deste membro entram no consolidado familiar';
