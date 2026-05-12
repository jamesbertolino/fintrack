-- Referral: quem indicou este usuário
alter table public.profiles
  add column if not exists referido_por uuid references public.profiles(id) on delete set null;

-- Índice para buscar quem foi indicado por um usuário
create index if not exists idx_profiles_referido_por on public.profiles(referido_por);
