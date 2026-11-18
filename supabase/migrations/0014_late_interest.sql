-- Skeello Cash — juros de atraso (depois do vencimento)
-- Rode depois de 0001 a 0013.
--
-- O juros de atraso é calculado na tela: dias de atraso x % ao dia sobre o que falta pagar, mais uma multa
-- única (%) se você definir. Cada dívida/empréstimo pode ter o seu % ao dia; sem ele vale o padrão de Configurações.

alter table public.loans add column if not exists late_daily_rate numeric(8,4) check (late_daily_rate is null or late_daily_rate >= 0);
alter table public.debts add column if not exists late_daily_rate numeric(8,4) check (late_daily_rate is null or late_daily_rate >= 0);
alter table public.user_settings add column if not exists default_late_rate numeric(8,4) not null default 0 check (default_late_rate >= 0);
alter table public.user_settings add column if not exists default_late_fee numeric(6,2) not null default 0 check (default_late_fee >= 0);
