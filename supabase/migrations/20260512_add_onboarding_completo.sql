alter table public.profiles
  add column if not exists onboarding_completo boolean not null default false;

-- Usuários que já completaram o setup não precisam refazer o onboarding
update public.profiles
  set onboarding_completo = true
  where setup_completo = true;
