create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  unique(user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "usuario ve propria subscription"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "usuario insere propria subscription"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "usuario deleta propria subscription"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
