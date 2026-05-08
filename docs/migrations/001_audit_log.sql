-- Tabela de auditoria de ações críticas
-- Rodar no Supabase SQL Editor

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  action      text        not null,
  resource_id text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- Apenas o service role pode inserir/ler — usuários não têm acesso direto
alter table public.audit_log enable row level security;

-- Nenhuma policy de select/insert para o anon/authenticated role:
-- o app usa service role key exclusivamente para escrever nesta tabela.

-- Índices para queries de auditoria
create index if not exists audit_log_user_id_idx  on public.audit_log (user_id);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

-- Retenção automática: deleta registros com mais de 90 dias
-- Requer pg_cron habilitado no Supabase (Dashboard → Database → Extensions)
-- Se pg_cron não estiver disponível, usar o endpoint /api/cron/retencao (vercel.json)
select cron.schedule(
  'audit-log-retencao-90d',
  '0 3 * * *',  -- toda noite às 3h UTC
  $$delete from public.audit_log where created_at < now() - interval '90 days'$$
);
