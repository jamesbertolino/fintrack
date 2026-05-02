-- Tabela de progresso de missões por usuário
create table if not exists missoes_usuario (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  missao_id  text not null,
  periodo    timestamptz not null,  -- início do dia (diária) ou semana (semanal)
  progresso  int not null default 0,
  concluida  boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, missao_id, periodo)
);

alter table missoes_usuario enable row level security;

create policy "usuarios veem suas proprias missoes"
  on missoes_usuario for select
  using (auth.uid() = user_id);

create policy "usuarios atualizam suas proprias missoes"
  on missoes_usuario for insert
  with check (auth.uid() = user_id);

create policy "usuarios editam suas proprias missoes"
  on missoes_usuario for update
  using (auth.uid() = user_id);
