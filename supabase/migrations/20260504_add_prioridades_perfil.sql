-- Adiciona campos de perfil pessoal e prioridades financeiras
alter table public.profiles
  add column if not exists data_nascimento date,
  add column if not exists genero text check (genero in ('masculino','feminino','outro','prefiro_nao_informar')),
  add column if not exists prioridades jsonb not null default '[]'::jsonb;
