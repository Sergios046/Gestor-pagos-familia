-- Permitir que cada usuario borre sus propios eventos de historial (p. ej. vaciar historial desde la app).
drop policy if exists "payment_events_delete_own" on public.payment_events;
create policy "payment_events_delete_own" on public.payment_events for delete using (auth.uid() = user_id);
