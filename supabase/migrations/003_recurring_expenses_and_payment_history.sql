-- Gastos recurrentes mensuales + historial unificado de pagos (gastos y deudas).

alter table public.expenses add column if not exists recurring_monthly boolean not null default false;

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

create policy "payment_events_select_own" on public.payment_events for select using (auth.uid() = user_id);

create policy "payment_events_insert_own" on public.payment_events for insert with check (auth.uid() = user_id);
