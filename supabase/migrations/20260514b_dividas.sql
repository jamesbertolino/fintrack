create table if not exists public.dividas (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  nome             text not null,
  saldo            numeric(12,2) not null default 0,
  taxa_juros       numeric(6,4) not null default 0,   -- % mensal, ex: 0.0299 = 2.99%
  pagamento_minimo numeric(12,2) not null default 0,
  ativo            boolean not null default true,
  created_at       timestamptz not null default now()
);

alter table public.dividas enable row level security;

create policy "dividas_own" on public.dividas
  using (user_id = auth.uid()) with check (user_id = auth.uid());
