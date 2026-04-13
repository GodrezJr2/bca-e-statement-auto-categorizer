create table if not exists public.budgets (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  category      text        not null,
  monthly_limit integer     not null check (monthly_limit > 0),
  updated_at    timestamptz not null default now(),
  unique(user_id, category)
);

alter table public.budgets enable row level security;

create policy "Users manage own budgets"
  on public.budgets
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-update updated_at on every write
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute procedure public.set_updated_at();