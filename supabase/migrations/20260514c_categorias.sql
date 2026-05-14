create table if not exists public.categorias_personalizadas (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  nome       text not null,
  cor        text not null default '#6b7280',
  icone      text not null default '📌',
  tipo       text not null default 'ambos' check (tipo in ('debito','credito','ambos')),
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, nome)
);

alter table public.categorias_personalizadas enable row level security;

create policy "cats_own" on public.categorias_personalizadas
  using (user_id = auth.uid()) with check (user_id = auth.uid());
