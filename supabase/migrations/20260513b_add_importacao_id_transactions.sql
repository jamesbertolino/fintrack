-- Vincula cada transação importada ao seu lote de importação
alter table public.transactions
  add column if not exists importacao_id uuid references public.importacoes(id) on delete set null;

create index if not exists idx_transactions_importacao_id
  on public.transactions(importacao_id)
  where importacao_id is not null;
