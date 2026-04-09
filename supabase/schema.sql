-- Schema aligned with your project (ewqnwdvqduroltnbbauz).
-- Run in Supabase SQL Editor. Adjust RLS when you add Auth.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  amount numeric not null,
  due_date date,
  paid boolean default false,
  paid_at timestamp with time zone,
  recurring_monthly boolean not null default false,
  debt_id uuid,
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamp with time zone default now()
);

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  total_amount numeric not null,
  monthly_payment numeric not null,
  remaining_balance numeric not null,
  due_date date not null default (current_date),
  reference_number text,
  convenio text,
  infonavit_credit text,
  user_id uuid references auth.users (id) on delete cascade default auth.uid(),
  created_at timestamp with time zone default now()
);

-- Optional columns (run if missing)
alter table public.expenses add column if not exists pay_convenio text;
alter table public.expenses add column if not exists pay_service_account text;
alter table public.expenses add column if not exists pay_notes text;

alter table public.expenses add column if not exists category text;
alter table public.expenses add column if not exists recurring_monthly boolean not null default false;
alter table public.expenses add column if not exists updated_at timestamp with time zone default now();
alter table public.debts add column if not exists updated_at timestamp with time zone default now();
alter table public.debts add column if not exists reference_number text;
alter table public.debts add column if not exists convenio text;
alter table public.debts add column if not exists infonavit_credit text;
alter table public.debts add column if not exists due_date date;
update public.debts set due_date = coalesce(due_date, current_date);
alter table public.debts alter column due_date set default (current_date);
alter table public.debts alter column due_date set not null;

alter table public.expenses add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.debts add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.expenses alter column user_id set default auth.uid();
alter table public.debts alter column user_id set default auth.uid();

create index if not exists expenses_due_date_idx on public.expenses (due_date);
create index if not exists debts_name_idx on public.debts (name);
create index if not exists debts_due_date_idx on public.debts (due_date);

-- RLS obligatorio si hay políticas; sin esto el Security Advisor marca «RLS Disabled in Public».
alter table public.expenses enable row level security;
alter table public.debts enable row level security;

drop policy if exists "expenses_anon_all" on public.expenses;
drop policy if exists "debts_anon_all" on public.debts;

drop policy if exists "expenses_select_own" on public.expenses;
drop policy if exists "expenses_insert_own" on public.expenses;
drop policy if exists "expenses_update_own" on public.expenses;
drop policy if exists "expenses_delete_own" on public.expenses;

drop policy if exists "debts_select_own" on public.debts;
drop policy if exists "debts_insert_own" on public.debts;
drop policy if exists "debts_update_own" on public.debts;
drop policy if exists "debts_delete_own" on public.debts;

create policy "expenses_select_own" on public.expenses for select using (auth.uid() = user_id);

create policy "expenses_insert_own" on public.expenses for insert with check (auth.uid() = user_id);

create policy "expenses_update_own" on public.expenses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expenses_delete_own" on public.expenses for delete using (auth.uid() = user_id);

create policy "debts_select_own" on public.debts for select using (auth.uid() = user_id);

create policy "debts_insert_own" on public.debts for insert with check (auth.uid() = user_id);

create policy "debts_update_own" on public.debts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "debts_delete_own" on public.debts for delete using (auth.uid() = user_id);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('expense', 'debt')),
  ref_id uuid not null,
  title text not null,
  amount numeric not null,
  paid_at timestamp with time zone not null default now()
);

create index if not exists payment_events_user_paid_at_idx on public.payment_events (user_id, paid_at desc);

alter table public.payment_events enable row level security;

drop policy if exists "payment_events_select_own" on public.payment_events;
drop policy if exists "payment_events_insert_own" on public.payment_events;
drop policy if exists "payment_events_delete_own" on public.payment_events;

create policy "payment_events_select_own" on public.payment_events for select using (auth.uid() = user_id);

create policy "payment_events_insert_own" on public.payment_events for insert with check (auth.uid() = user_id);

create policy "payment_events_delete_own" on public.payment_events for delete using (auth.uid() = user_id);

-- Realtime (skip errors if already added)
alter publication supabase_realtime add table public.expenses;
alter publication supabase_realtime add table public.debts;
