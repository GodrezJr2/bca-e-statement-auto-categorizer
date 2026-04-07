-- supabase/schema.sql

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- categories table
create table categories (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text not null check (type in ('Income', 'Expense'))
);

-- Seed default categories
insert into categories (name, type) values
  ('Food',         'Expense'),
  ('Transport',    'Expense'),
  ('Utilities',    'Expense'),
  ('Shopping',     'Expense'),
  ('Subscription', 'Expense'),
  ('Health',       'Expense'),
  ('Entertainment','Expense'),
  ('Transfer',     'Expense'),
  ('Income',       'Income'),
  ('Other',        'Expense');

-- transactions table
create table transactions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  transaction_date date not null,
  description      text not null,
  amount           numeric(18, 2) not null,
  category_id      uuid references categories(id),
  created_at       timestamptz default now()
);

-- Indexes
create index transactions_user_id_idx on transactions(user_id);
create index transactions_date_idx    on transactions(transaction_date);

-- RLS
alter table transactions enable row level security;
alter table categories    enable row level security;

create policy "categories_read_all"
  on categories for select using (true);

create policy "transactions_select_own"
  on transactions for select
  using (auth.uid() = user_id);

create policy "transactions_insert_own"
  on transactions for insert
  with check (auth.uid() = user_id);

create policy "transactions_update_own"
  on transactions for update
  using (auth.uid() = user_id);

create policy "transactions_delete_own"
  on transactions for delete
  using (auth.uid() = user_id);
