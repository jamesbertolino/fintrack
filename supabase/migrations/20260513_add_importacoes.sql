-- Histórico de importações: registra cada lote importado via upload
create table if not exists public.importacoes (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  arquivo_nome      text,
  formato           text,                          -- csv | ofx | pdf | imagem
  banco_nome        text,
  conta_id          uuid references public.contas(id) on delete set null,
  total_detectadas  int not null default 0,
  total_inseridas   int not null default 0,
  total_duplicatas  int not null default 0,
  created_at        timestamptz not null default now()
);

-- RLS: cada usuário vê apenas suas próprias importações
alter table public.importacoes enable row level security;

create policy "Importações próprias"
  on public.importacoes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists idx_importacoes_user_created
  on public.importacoes(user_id, created_at desc);
