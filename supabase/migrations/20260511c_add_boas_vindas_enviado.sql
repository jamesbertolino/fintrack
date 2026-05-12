alter table public.profiles
  add column if not exists boas_vindas_enviado boolean not null default false;
