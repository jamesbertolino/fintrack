-- Coluna de consentimento LGPD no perfil
-- Rodar no Supabase SQL Editor

alter table public.profiles
  add column if not exists lgpd_aceito_em timestamptz;

-- Retenção de whatsapp_logs (90 dias)
-- Requer pg_cron habilitado (Dashboard → Database → Extensions)
select cron.schedule(
  'whatsapp-logs-retencao-90d',
  '0 2 * * *',  -- toda noite às 2h UTC
  $$delete from public.whatsapp_logs where created_at < now() - interval '90 days'$$
);
