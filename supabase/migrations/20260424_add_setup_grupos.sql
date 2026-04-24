-- Migração: setup_completo, evolution_instancia e tabela grupos
-- Execute no SQL Editor do Supabase para bases já existentes

-- 1. Novas colunas em profiles
alter table public.profiles
  add column if not exists evolution_instancia text,
  add column if not exists setup_completo      boolean not null default false;

-- 2. Usuários já existentes não precisam refazer o setup
update public.profiles set setup_completo = true where setup_completo = false;

-- 3. Tabela de grupos WhatsApp
create table if not exists public.grupos (
  id         uuid primary key default uuid_generate_v4(),
  nome       text not null,
  criado_por uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz not null default now()
);

alter table public.grupos enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'grupos' and policyname = 'Grupos próprios'
  ) then
    execute 'create policy "Grupos próprios" on public.grupos using (auth.uid() = criado_por)';
  end if;
end $$;
