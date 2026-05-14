create table if not exists public.meta_compartilhamentos (
  id         uuid primary key default uuid_generate_v4(),
  meta_id    uuid not null references public.goals(id) on delete cascade,
  grupo_id   uuid not null references public.familia_grupos(id) on delete cascade,
  criado_por uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (meta_id, grupo_id)
);

alter table public.meta_compartilhamentos enable row level security;

-- dono da meta pode gerenciar
create policy "meta_comp_own" on public.meta_compartilhamentos
  using (criado_por = auth.uid()) with check (criado_por = auth.uid());

-- membros da família podem ler
create policy "meta_comp_read" on public.meta_compartilhamentos
  for select using (
    exists (
      select 1 from public.familia_membros fm
      where fm.grupo_id = meta_compartilhamentos.grupo_id
        and fm.membro_id = auth.uid()
    )
    or exists (
      select 1 from public.familia_grupos fg
      where fg.id = meta_compartilhamentos.grupo_id
        and fg.dono_id = auth.uid()
    )
  );
