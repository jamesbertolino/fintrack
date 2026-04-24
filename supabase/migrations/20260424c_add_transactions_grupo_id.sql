-- Migração: adiciona grupo_id em transactions para rastrear origem por grupo WhatsApp
alter table public.transactions
  add column if not exists grupo_id uuid references public.grupos(id) on delete set null;
