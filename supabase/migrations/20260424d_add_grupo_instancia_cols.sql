-- Migração: grupo_id_principal em profiles e evolution_instancia em grupos
alter table public.profiles
  add column if not exists grupo_id_principal uuid references public.grupos(id) on delete set null;

alter table public.grupos
  add column if not exists evolution_instancia text;
