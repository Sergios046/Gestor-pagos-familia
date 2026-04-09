-- Schema aligned with your project (ewqnwdvqduroltnbbauz).
-- Run in Supabase SQL Editor. Adjust RLS when you add Auth.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null,
  due_date date,
  paid boolean default false,
  paid_at timestamp with time zone,
  debt_id uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_amount numeric not null,
  monthly_payment numeric not null,
  remaining_balance numeric not null,
  created_at timestamp with time zone default now()
);

-- Optional columns (run if missing)
alter table public.expenses add column if not exists category text;
alter table public.expenses add column if not exists updated_at timestamp with time zone default now();
alter table public.debts add column if not exists updated_at timestamp with time zone default now();

create index if not exists expenses_due_date_idx on public.expenses (due_date);
create index if not exists debts_name_idx on public.debts (name);

alter table public.expenses enable row level security;
alter table public.debts enable row level security;

drop policy if exists "expenses_anon_all" on public.expenses;
create policy "expenses_anon_all" on public.expenses for all using (true) with check (true);

drop policy if exists "debts_anon_all" on public.debts;
create policy "debts_anon_all" on public.debts for all using (true) with check (true);

-- Realtime (skip errors if already added)
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.debts;
