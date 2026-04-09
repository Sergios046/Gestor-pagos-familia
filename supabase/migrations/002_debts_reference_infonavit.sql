-- Datos de referencia de deuda (Infonavit / convenio). Ejecutar en SQL Editor si la tabla ya existe.

alter table public.debts add column if not exists reference_number text;
alter table public.debts add column if not exists convenio text;
alter table public.debts add column if not exists infonavit_credit text;
