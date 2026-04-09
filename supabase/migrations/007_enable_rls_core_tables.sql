-- Corrige avisos del Security Advisor: políticas existentes + RLS desactivado = tabla expuesta.
-- Ejecuta en SQL Editor (o vía migraciones). Idempotente.
alter table public.expenses enable row level security;
alter table public.debts enable row level security;
alter table public.payment_events enable row level security;
