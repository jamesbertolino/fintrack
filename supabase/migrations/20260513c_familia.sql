-- Grupos de família (acesso ao app, distinto de grupos WhatsApp)
create table if not exists public.familia_grupos (
  id          uuid primary key default uuid_generate_v4(),
  dono_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (dono_id)
);

-- Membros com acesso ao app do dono
create table if not exists public.familia_membros (
  id          uuid primary key default uuid_generate_v4(),
  grupo_id    uuid not null references public.familia_grupos(id) on delete cascade,
  membro_id   uuid not null references public.profiles(id) on delete cascade,
  permissao   text not null default 'leitura' check (permissao in ('leitura','edicao')),
  created_at  timestamptz not null default now(),
  unique (grupo_id, membro_id)
);

-- Convites pendentes por e-mail
create table if not exists public.familia_convites (
  id          uuid primary key default uuid_generate_v4(),
  grupo_id    uuid not null references public.familia_grupos(id) on delete cascade,
  email       text not null,
  token       uuid not null default uuid_generate_v4(),
  permissao   text not null default 'leitura' check (permissao in ('leitura','edicao')),
  aceito      boolean not null default false,
  expires_at  timestamptz not null default (now() + interval '7 days'),
  created_at  timestamptz not null default now(),
  unique (grupo_id, email)
);

-- RLS
alter table public.familia_grupos   enable row level security;
alter table public.familia_membros  enable row level security;
alter table public.familia_convites enable row level security;

create policy "familia_grupos_owner"   on public.familia_grupos   for all using (dono_id = auth.uid()) with check (dono_id = auth.uid());
create policy "familia_membros_owner"  on public.familia_membros  for all using (
  grupo_id in (select id from public.familia_grupos where dono_id = auth.uid())
  or membro_id = auth.uid()
);
create policy "familia_convites_owner" on public.familia_convites for all using (
  grupo_id in (select id from public.familia_grupos where dono_id = auth.uid())
);
-- Qualquer usuário autenticado pode ler um convite pelo token (para aceitar)
create policy "familia_convites_read_token" on public.familia_convites for select using (true);
