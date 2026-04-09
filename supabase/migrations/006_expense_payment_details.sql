-- Datos opcionales del servicio / forma de pago (luz, agua, etc.).
alter table public.expenses add column if not exists pay_convenio text;
alter table public.expenses add column if not exists pay_service_account text;
alter table public.expenses add column if not exists pay_notes text;
