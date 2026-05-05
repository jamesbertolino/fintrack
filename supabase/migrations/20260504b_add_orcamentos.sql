create table if not exists public.orcamentos (
  id            uuid        default gen_random_uuid() primary key,
  user_id       uuid        references auth.users(id) on delete cascade not null,
  categoria     text        not null,
  valor_planejado numeric(12,2) not null default 0,
  mes           text        not null,  -- formato: YYYY-MM
  created_at    timestamptz not null default now(),
  unique(user_id, categoria, mes)
);

alter table public.orcamentos enable row level security;

create policy "users_own_orcamentos" on public.orcamentos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
