-- ── Origens financeiras do grupo ──────────────────────────────────────────────
create table if not exists public.grupo_origens (
  id           uuid primary key default uuid_generate_v4(),
  grupo_id     uuid not null references public.familia_grupos(id) on delete cascade,
  criado_por   uuid not null references public.profiles(id) on delete cascade,
  nome         text not null,
  tipo         text not null default 'conta_bancaria'
               check (tipo in ('conta_bancaria','especie','cheque','outro')),
  conta_id     uuid references public.contas(id) on delete set null,
  saldo_inicial numeric(12,2) not null default 0,
  ativo        boolean not null default true,
  created_at   timestamptz not null default now()
);

alter table public.grupo_origens enable row level security;

create policy "grupo_origens_read" on public.grupo_origens
  for select using (
    exists (
      select 1 from public.familia_grupos fg
      where fg.id = grupo_origens.grupo_id
        and (fg.dono_id = auth.uid()
             or exists (select 1 from public.familia_membros fm
                        where fm.grupo_id = fg.id and fm.membro_id = auth.uid()))
    )
  );

create policy "grupo_origens_manage" on public.grupo_origens
  for all using (criado_por = auth.uid()) with check (criado_por = auth.uid());

-- ── Movimentos consolidados do grupo ───────────────────────────────────────────
create table if not exists public.grupo_movimentos (
  id          uuid primary key default uuid_generate_v4(),
  grupo_id    uuid not null references public.familia_grupos(id) on delete cascade,
  origem_id   uuid not null references public.grupo_origens(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  tipo        text not null check (tipo in ('entrada','saida')),
  valor       numeric(12,2) not null,
  descricao   text not null,
  categoria   text not null default 'Outros',
  data        date not null default current_date,
  meta_id     uuid references public.goals(id) on delete set null,
  divida_id   uuid references public.dividas(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table public.grupo_movimentos enable row level security;

create policy "grupo_movimentos_read" on public.grupo_movimentos
  for select using (
    exists (
      select 1 from public.familia_grupos fg
      where fg.id = grupo_movimentos.grupo_id
        and (fg.dono_id = auth.uid()
             or exists (select 1 from public.familia_membros fm
                        where fm.grupo_id = fg.id and fm.membro_id = auth.uid()))
    )
  );

create policy "grupo_movimentos_insert" on public.grupo_movimentos
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.familia_grupos fg
      where fg.id = grupo_movimentos.grupo_id
        and (fg.dono_id = auth.uid()
             or exists (select 1 from public.familia_membros fm
                        where fm.grupo_id = fg.id and fm.membro_id = auth.uid()))
    )
  );

create policy "grupo_movimentos_delete" on public.grupo_movimentos
  for delete using (user_id = auth.uid());

create index if not exists grupo_movimentos_grupo_idx  on public.grupo_movimentos(grupo_id);
create index if not exists grupo_movimentos_origem_idx on public.grupo_movimentos(origem_id);
create index if not exists grupo_movimentos_data_idx   on public.grupo_movimentos(data desc);
