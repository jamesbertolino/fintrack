create table if not exists public.meta_aportes (
  id         uuid primary key default uuid_generate_v4(),
  meta_id    uuid not null references public.goals(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  valor      numeric(12,2) not null,
  nota       text,
  data       date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.meta_aportes enable row level security;

create policy "meta_aportes_own" on public.meta_aportes
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists meta_aportes_meta_id_idx on public.meta_aportes(meta_id);
