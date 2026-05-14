create table if not exists public.categoria_aprendida (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  chave      text not null,           -- chave normalizada da descrição (primeiros ~20 chars sem números)
  categoria  text not null,
  vezes      int  not null default 1,
  updated_at timestamptz not null default now(),
  unique (user_id, chave)
);

alter table public.categoria_aprendida enable row level security;

create policy "cat_aprendida_own" on public.categoria_aprendida
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists cat_aprendida_user_chave on public.categoria_aprendida(user_id, chave);
