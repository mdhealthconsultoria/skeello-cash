-- Skeello Cash — permite valor 0 em movimentações e pagamentos
-- (ex.: dívida já quitada que a pessoa só quer registrar).
alter table public.debts drop constraint if exists debts_amount_check;
alter table public.debts add constraint debts_amount_check check (amount >= 0);

alter table public.payments drop constraint if exists payments_amount_check;
alter table public.payments add constraint payments_amount_check check (amount >= 0);
