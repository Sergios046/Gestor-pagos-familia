-- PRIVACIDAD / RLS por user_id (lineas con -- son solo ayuda; no dan error si las ejecutas).
-- GitHub: Settings - General - Danger zone - Change repository visibility - Private.
-- Vercel: la .vercel.app sigue siendo publica; los datos quedan protegidos por login + estas politicas.
-- Supabase: Authentication - Providers - Email activado. Para pruebas rapidas, desactiva Confirm email.
-- Orden: ejecuta todo este archivo; crea usuario (app o Authentication - Users); si habia datos:
--   UPDATE public.expenses SET user_id = 'TU-UUID' WHERE user_id IS NULL;
--   UPDATE public.debts SET user_id = 'TU-UUID' WHERE user_id IS NULL;

-- Columnas de propiedad (JWT = auth.uid())
alter table public.expenses add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.debts add column if not exists user_id uuid references auth.users (id) on delete cascade;

alter table public.expenses alter column user_id set default auth.uid();
alter table public.debts alter column user_id set default auth.uid();

-- Quitar acceso público (anon) — solo filas del usuario con sesión
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
