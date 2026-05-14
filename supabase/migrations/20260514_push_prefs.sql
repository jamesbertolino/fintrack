create table if not exists public.push_preferencias (
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  resumo_semanal   boolean not null default true,
  aviso_meta       boolean not null default true,
  alerta_orcamento boolean not null default true,
  updated_at       timestamptz not null default now()
);

alter table public.push_preferencias enable row level security;

create policy "push_prefs_own" on public.push_preferencias
  using (user_id = auth.uid()) with check (user_id = auth.uid());
