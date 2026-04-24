-- =========================================================
-- Fintrack — Schema SQL para Supabase
-- Execute no SQL Editor do painel Supabase
-- =========================================================

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- =========================================================
-- TABELA: profiles (complementa auth.users do Supabase)
-- =========================================================
create table public.profiles (
  id                   uuid references auth.users(id) on delete cascade primary key,
  nome                 text not null,
  sobrenome            text,
  whatsapp             text,
  timezone             text not null default 'America/Sao_Paulo',
  idioma               text not null default 'pt-BR',
  evolution_instancia  text,
  setup_completo       boolean not null default false,
  grupo_id_principal   uuid,
  renda_mensal         text,
  banco_principal      text,
  objetivo             text,          -- 'sair_vermelho' | 'poupar' | 'sonho' | 'entender'
  plano                text not null default 'free', -- 'free' | 'pro' | 'familia'
  stripe_customer_id   text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- RLS: usuário só acessa seu próprio perfil
alter table public.profiles enable row level security;
create policy "Perfil próprio" on public.profiles
  using (auth.uid() = id);

-- =========================================================
-- TABELA: webhook_configs
-- =========================================================
create table public.webhook_configs (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references public.profiles(id) on delete cascade not null unique,
  token      text not null unique default encode(gen_random_bytes(24), 'hex'),
  ativo      boolean not null default true,
  plano      text not null default 'free',
  created_at timestamptz not null default now()
);

alter table public.webhook_configs enable row level security;
create policy "Webhook próprio" on public.webhook_configs
  using (auth.uid() = user_id);

-- Criar config automaticamente quando perfil é criado
create or replace function public.criar_webhook_config()
returns trigger language plpgsql security definer as $$
begin
  insert into public.webhook_configs (user_id, plano)
  values (new.id, new.plano);
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.criar_webhook_config();

-- =========================================================
-- TABELA: grupos (grupos de WhatsApp por usuário)
-- =========================================================
create table public.grupos (
  id                  uuid primary key default uuid_generate_v4(),
  nome                text not null,
  criado_por          uuid references public.profiles(id) on delete cascade not null,
  evolution_instancia text,
  whatsapp_grupo_id   text,
  created_at          timestamptz not null default now()
);

alter table public.grupos enable row level security;
create policy "Grupos próprios" on public.grupos
  using (auth.uid() = criado_por);

-- =========================================================
-- TABELA: transactions
-- =========================================================
create table public.transactions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.profiles(id) on delete cascade not null,
  descricao           text not null,
  valor               numeric(12,2) not null,  -- negativo = despesa
  tipo                text not null check (tipo in ('debito', 'credito')),
  categoria           text not null default 'Outros',
  data_hora           timestamptz not null,
  origem              text not null default 'webhook', -- 'webhook' | 'manual'
  grupo_id            uuid references public.grupos(id) on delete set null,
  referencia_externa  text,   -- ID do banco de origem (para deduplicação)
  created_at          timestamptz not null default now()
);

-- Índices para queries frequentes
create index idx_transactions_user_data on public.transactions (user_id, data_hora desc);
create index idx_transactions_categoria on public.transactions (user_id, categoria, data_hora desc);
create index idx_transactions_ref_ext on public.transactions (user_id, referencia_externa)
  where referencia_externa is not null;

alter table public.transactions enable row level security;
create policy "Transações próprias" on public.transactions
  using (auth.uid() = user_id);

-- =========================================================
-- TABELA: goals (metas financeiras)
-- =========================================================
create table public.goals (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  nome            text not null,
  tipo            text not null default 'acumulacao', -- 'acumulacao' | 'emergencia' | 'limite'
  valor_total     numeric(12,2) not null,
  valor_atual     numeric(12,2) not null default 0,
  contribuicao_mensal numeric(10,2),
  prazo           date,
  categoria_vinculada text,
  ativo           boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_goals_user on public.goals (user_id, ativo);

alter table public.goals enable row level security;
create policy "Metas próprias" on public.goals
  using (auth.uid() = user_id);

-- =========================================================
-- TABELA: alert_rules (regras de alerta configuradas)
-- =========================================================
create table public.alert_rules (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  tipo            text not null,  -- 'receita_recebida' | 'limite_categoria' | 'marco_meta' | 'fim_mes'
  ativo           boolean not null default true,
  categoria       text,           -- para tipo = 'limite_categoria'
  limite          numeric(10,2),  -- teto mensal da categoria
  threshold_pct   integer default 80, -- % para disparar o alerta
  canais          text[] not null default array['email', 'push'],
  created_at      timestamptz not null default now()
);

alter table public.alert_rules enable row level security;
create policy "Regras próprias" on public.alert_rules
  using (auth.uid() = user_id);

-- Regras padrão para novos usuários
create or replace function public.criar_alertas_padrao()
returns trigger language plpgsql security definer as $$
begin
  insert into public.alert_rules (user_id, tipo, canais) values
    (new.id, 'receita_recebida',  array['push', 'email']),
    (new.id, 'marco_meta',        array['push', 'email']),
    (new.id, 'fim_mes',           array['push']);
  return new;
end;
$$;

create trigger on_profile_created_alerts
  after insert on public.profiles
  for each row execute procedure public.criar_alertas_padrao();

-- =========================================================
-- TABELA: notifications (fila de notificações geradas)
-- =========================================================
create table public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  tipo            text not null,
  titulo          text not null,
  mensagem        text not null,
  lida            boolean not null default false,
  transaction_id  uuid references public.transactions(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index idx_notifications_user on public.notifications (user_id, lida, created_at desc);

alter table public.notifications enable row level security;
create policy "Notificações próprias" on public.notifications
  using (auth.uid() = user_id);

-- =========================================================
-- TABELA: webhook_logs (auditoria de chamadas)
-- =========================================================
create table public.webhook_logs (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references public.profiles(id) on delete cascade not null,
  transaction_id  uuid references public.transactions(id) on delete set null,
  status          integer not null,   -- 200, 401, 422, 429, 500
  erro            text,
  duracao_ms      integer,
  created_at      timestamptz not null default now()
);

create index idx_webhook_logs_user on public.webhook_logs (user_id, created_at desc);
create index idx_webhook_logs_rate on public.webhook_logs (user_id, status, created_at desc);

-- webhook_logs só é gravado pelo service role (backend)
-- usuários podem apenas ler seus próprios logs
alter table public.webhook_logs enable row level security;
create policy "Logs próprios leitura" on public.webhook_logs
  for select using (auth.uid() = user_id);

-- =========================================================
-- VIEW: resumo_mensal (usada pelo dashboard)
-- =========================================================
create or replace view public.resumo_mensal as
select
  user_id,
  date_trunc('month', data_hora) as mes,
  categoria,
  tipo,
  count(*)           as qtd_transacoes,
  sum(valor)         as total,
  sum(abs(valor))    as total_abs,
  avg(abs(valor))    as ticket_medio
from public.transactions
group by user_id, date_trunc('month', data_hora), categoria, tipo;

-- =========================================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- =========================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_goals_updated_at
  before update on public.goals
  for each row execute procedure public.set_updated_at();

-- =========================================================
-- REALTIME: habilitar para o dashboard ao vivo
-- =========================================================
-- Execute no painel Supabase em Database > Replication
-- ou via SQL:
alter publication supabase_realtime add table public.transactions;
alter publication supabase_realtime add table public.notifications;