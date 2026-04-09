-- Día/mes de la próxima cuota (similar a gastos); al registrar pago la app avanza un mes.
alter table public.debts add column if not exists due_date date;
update public.debts set due_date = current_date where due_date is null;
alter table public.debts alter column due_date set default (current_date);
alter table public.debts alter column due_date set not null;

create index if not exists debts_due_date_idx on public.debts (due_date);
