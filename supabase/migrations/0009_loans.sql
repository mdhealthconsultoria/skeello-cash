-- Skeello Cash — Empréstimos a juros (você pega dinheiro com pessoas e empresta a outras)
-- Rode depois de 0001 a 0008.
--
-- Modelo:
--   loans          = o empréstimo que VOCÊ (dono) faz a um tomador. Juros fixos (%) sobre o principal.
--   loan_funders   = quem colocou dinheiro nesse empréstimo (co-fundadores), cada um com valor e % combinados.
--   loan_payments  = pagamentos que o tomador fez a você.
--   funder_payments= pagamentos que você fez a um co-fundador.
-- Só o dono lê/escreve nas tabelas. Tomador e co-fundadores leem pelas funções
-- get_my_borrowings() e get_my_fundings(), que devolvem apenas o que cada um pode ver
-- (o tomador nunca vê a margem do dono nem o que os co-fundadores ganham).

-- =========================================================
-- TABELAS
-- =========================================================
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  borrower_name text not null,
  borrower_email text,
  borrower_user_id uuid references auth.users(id) on delete set null,
  principal numeric(12,2) not null check (principal > 0),
  borrower_rate numeric(7,2) not null default 0 check (borrower_rate >= 0),
  issue_date date not null default current_date,
  due_date date not null,
  notes text,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loans_owner_idx on public.loans(owner_id);
create index if not exists loans_borrower_user_idx on public.loans(borrower_user_id);
create index if not exists loans_due_idx on public.loans(due_date);

create table if not exists public.loan_funders (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  funder_name text not null,
  funder_email text,
  funder_user_id uuid references auth.users(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  rate numeric(7,2) not null default 0 check (rate >= 0),
  can_see_borrower boolean not null default false,
  can_see_payments boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists loan_funders_loan_idx on public.loan_funders(loan_id);
create index if not exists loan_funders_user_idx on public.loan_funders(funder_user_id);

create table if not exists public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists loan_payments_loan_idx on public.loan_payments(loan_id);

create table if not exists public.funder_payments (
  id uuid primary key default gen_random_uuid(),
  funder_id uuid not null references public.loan_funders(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists funder_payments_funder_idx on public.funder_payments(funder_id);

-- evita lembrete duplicado (mesmo empréstimo, mesma pessoa, mesmo marco de dias)
create table if not exists public.loan_reminder_log (
  loan_id uuid not null references public.loans(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  days_before int not null,
  sent_at timestamptz not null default now(),
  primary key (loan_id, user_id, days_before)
);

-- notificações passam a poder apontar para um empréstimo
alter table public.notifications
  add column if not exists loan_id uuid references public.loans(id) on delete cascade;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'due_today', 'due_soon', 'overdue', 'summary', 'debt_invite', 'debt_accepted', 'contact_added',
    'loan_shared', 'loan_due'
  ));

-- =========================================================
-- RLS (só o dono mexe direto nas tabelas)
-- =========================================================
alter table public.loans enable row level security;
alter table public.loan_funders enable row level security;
alter table public.loan_payments enable row level security;
alter table public.funder_payments enable row level security;
alter table public.loan_reminder_log enable row level security;

create policy "loans_owner_all" on public.loans
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create policy "loan_funders_owner_all" on public.loan_funders
  for all using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.loans l where l.id = loan_id and l.owner_id = auth.uid())
  );

create policy "loan_payments_owner_all" on public.loan_payments
  for all using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.loans l where l.id = loan_id and l.owner_id = auth.uid())
  );

create policy "funder_payments_owner_all" on public.funder_payments
  for all using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.loan_funders f where f.id = funder_id and f.owner_id = auth.uid())
  );

-- loan_reminder_log: sem policies = ninguém lê/escreve pelo app (só as funções security definer)

-- =========================================================
-- TRIGGER: liga e-mail digitado a um usuário que já existe
-- =========================================================
create or replace function public.link_loan_borrower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.borrower_user_id is null and nullif(trim(new.borrower_email), '') is not null then
    select id into new.borrower_user_id from public.profiles
    where lower(email) = lower(trim(new.borrower_email)) and id <> new.owner_id
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_loan_borrower on public.loans;
create trigger trg_link_loan_borrower
  before insert or update of borrower_email, borrower_user_id on public.loans
  for each row execute function public.link_loan_borrower();

create or replace function public.link_loan_funder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.funder_user_id is null and nullif(trim(new.funder_email), '') is not null then
    select id into new.funder_user_id from public.profiles
    where lower(email) = lower(trim(new.funder_email)) and id <> new.owner_id
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_link_loan_funder on public.loan_funders;
create trigger trg_link_loan_funder
  before insert or update of funder_email, funder_user_id on public.loan_funders
  for each row execute function public.link_loan_funder();

-- =========================================================
-- TRIGGER: quem cria conta depois já encontra os empréstimos esperando por ele
-- =========================================================
create or replace function public.link_loans_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null then
    return new;
  end if;
  update public.loans set borrower_user_id = new.id
  where borrower_user_id is null and lower(borrower_email) = lower(new.email) and owner_id <> new.id;
  update public.loan_funders set funder_user_id = new.id
  where funder_user_id is null and lower(funder_email) = lower(new.email) and owner_id <> new.id;
  return new;
end;
$$;

drop trigger if exists trg_link_loans_on_signup on public.profiles;
create trigger trg_link_loans_on_signup
  after insert on public.profiles
  for each row execute function public.link_loans_on_signup();

-- =========================================================
-- TRIGGER: avisa quando alguém é incluído (ou ganha acesso) a um empréstimo
-- =========================================================
create or replace function public.notify_loan_borrower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text;
begin
  if new.borrower_user_id is not null
     and (tg_op = 'INSERT' or old.borrower_user_id is distinct from new.borrower_user_id) then
    select coalesce(nullif(name, ''), email) into v_owner from public.profiles where id = new.owner_id;
    insert into public.notifications (user_id, loan_id, type, message)
    values (
      new.borrower_user_id, new.id, 'loan_shared',
      coalesce(v_owner, 'Alguém') || ' registrou um empréstimo para você. Veja quanto você deve e quando vence.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_loan_borrower on public.loans;
create trigger trg_notify_loan_borrower
  after insert or update of borrower_user_id on public.loans
  for each row execute function public.notify_loan_borrower();

create or replace function public.notify_loan_funder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text;
begin
  if new.funder_user_id is not null
     and (tg_op = 'INSERT' or old.funder_user_id is distinct from new.funder_user_id) then
    select coalesce(nullif(name, ''), email) into v_owner from public.profiles where id = new.owner_id;
    insert into public.notifications (user_id, loan_id, type, message)
    values (
      new.funder_user_id, new.loan_id, 'loan_shared',
      coalesce(v_owner, 'Alguém') || ' incluiu você como co-fundador de um empréstimo. Veja quanto você vai receber e quando.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_loan_funder on public.loan_funders;
create trigger trg_notify_loan_funder
  after insert or update of funder_user_id on public.loan_funders
  for each row execute function public.notify_loan_funder();

-- =========================================================
-- RPC: empréstimos em que EU sou o tomador (o que eu devo)
-- =========================================================
create or replace function public.get_my_borrowings()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.due_date), '[]'::jsonb)
  from (
    select
      l.id,
      l.due_date,
      l.issue_date,
      l.principal,
      l.borrower_rate,
      round(l.principal * (1 + l.borrower_rate / 100), 2) as total,
      coalesce((select sum(p.amount) from public.loan_payments p where p.loan_id = l.id), 0) as paid,
      (select coalesce(nullif(pr.name, ''), pr.email) from public.profiles pr where pr.id = l.owner_id) as owner_name,
      l.closed,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', p.id, 'amount', p.amount, 'paid_at', p.paid_at, 'note', p.note)
          order by p.paid_at desc, p.created_at desc
        )
        from public.loan_payments p where p.loan_id = l.id
      ), '[]'::jsonb) as payments
    from public.loans l
    where l.borrower_user_id = auth.uid()
  ) r;
$$;

grant execute on function public.get_my_borrowings() to authenticated;

-- =========================================================
-- RPC: empréstimos em que EU sou co-fundador (o que vou receber)
-- =========================================================
create or replace function public.get_my_fundings()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(jsonb_agg(to_jsonb(r) order by r.due_date), '[]'::jsonb)
  from (
    select
      f.id,
      l.due_date,
      l.issue_date,
      f.amount,
      f.rate,
      round(f.amount * (1 + f.rate / 100), 2) as total,
      coalesce((select sum(fp.amount) from public.funder_payments fp where fp.funder_id = f.id), 0) as paid,
      (select coalesce(nullif(pr.name, ''), pr.email) from public.profiles pr where pr.id = l.owner_id) as owner_name,
      l.closed,
      case when f.can_see_borrower then l.borrower_name end as borrower_name,
      f.can_see_borrower,
      f.can_see_payments,
      case when f.can_see_payments then
        round(l.principal * (1 + l.borrower_rate / 100), 2)
      end as borrower_total,
      case when f.can_see_payments then
        coalesce((select sum(p.amount) from public.loan_payments p where p.loan_id = l.id), 0)
      end as borrower_paid,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', fp.id, 'amount', fp.amount, 'paid_at', fp.paid_at, 'note', fp.note)
          order by fp.paid_at desc, fp.created_at desc
        )
        from public.funder_payments fp where fp.funder_id = f.id
      ), '[]'::jsonb) as payments
    from public.loan_funders f
    join public.loans l on l.id = f.loan_id
    where f.funder_user_id = auth.uid()
  ) r;
$$;

grant execute on function public.get_my_fundings() to authenticated;

-- =========================================================
-- LEMBRETES: 10, 7, 3 e 1 dia antes (e no dia do vencimento)
-- Idempotente: pode rodar quantas vezes quiser no dia, cada aviso sai uma vez só.
-- =========================================================
-- formata número no padrão brasileiro (1234,50), independente da configuração do servidor
create or replace function public._brl(p_value numeric)
returns text
language sql
immutable
as $$
  select replace(to_char(p_value, 'FM999999990.00'), '.', ',');
$$;

create or replace function public._loan_remind(p_loan uuid, p_user uuid, p_days int, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows int;
begin
  if p_user is null then
    return;
  end if;
  insert into public.loan_reminder_log (loan_id, user_id, days_before)
  values (p_loan, p_user, p_days)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    insert into public.notifications (user_id, loan_id, type, message)
    values (p_user, p_loan, 'loan_due', p_message);
  end if;
end;
$$;

create or replace function public.generate_loan_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  f record;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_when text;
  v_date text;
  v_total numeric;
  v_paid numeric;
  v_remaining numeric;
  v_payout_left numeric;
  v_f_left numeric;
  v_owner_name text;
  v_count int := 0;
begin
  for r in
    select l.*, (l.due_date - v_today) as days
    from public.loans l
    where not l.closed and (l.due_date - v_today) in (10, 7, 3, 1, 0)
  loop
    v_total := round(r.principal * (1 + r.borrower_rate / 100), 2);
    select coalesce(sum(amount), 0) into v_paid from public.loan_payments where loan_id = r.id;
    v_remaining := v_total - v_paid;

    v_when := case r.days
      when 0 then 'vence hoje'
      when 1 then 'vence amanhã'
      else 'vence em ' || r.days || ' dias'
    end;
    v_date := to_char(r.due_date, 'DD/MM/YYYY');

    select coalesce(nullif(name, ''), email) into v_owner_name from public.profiles where id = r.owner_id;

    -- tomador: quanto precisa pagar
    if v_remaining > 0.009 then
      perform public._loan_remind(
        r.id, r.borrower_user_id, r.days,
        'Seu empréstimo com ' || coalesce(v_owner_name, 'o credor') || ' ' || v_when
          || ' (' || v_date || '). Falta pagar R$ ' || public._brl(v_remaining) || '.'
      );
    end if;

    -- co-fundadores: quanto vão receber
    v_payout_left := 0;
    for f in select * from public.loan_funders where loan_id = r.id loop
      select round(f.amount * (1 + f.rate / 100), 2) - coalesce(sum(fp.amount), 0)
        into v_f_left from public.funder_payments fp where fp.funder_id = f.id;
      v_f_left := coalesce(v_f_left, round(f.amount * (1 + f.rate / 100), 2));
      if v_f_left > 0.009 then
        v_payout_left := v_payout_left + v_f_left;
        perform public._loan_remind(
          r.id, f.funder_user_id, r.days,
          'Você tem R$ ' || public._brl(v_f_left) || ' a receber de '
            || coalesce(v_owner_name, 'o dono do empréstimo') || ': ' || v_when || ' (' || v_date || ').'
        );
      end if;
    end loop;

    -- dono: quanto entra e quanto precisa repassar
    if v_remaining > 0.009 or v_payout_left > 0.009 then
      perform public._loan_remind(
        r.id, r.owner_id, r.days,
        'Empréstimo de ' || r.borrower_name || ' ' || v_when || ' (' || v_date || '). '
          || 'A receber R$ ' || public._brl(greatest(v_remaining, 0))
          || '; a repassar aos co-fundadores R$ ' || public._brl(v_payout_left) || '.'
      );
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public._loan_remind(uuid, uuid, int, text) from public, anon, authenticated;
grant execute on function public.generate_loan_reminders() to authenticated;

-- agenda todo dia às 08:00 (Brasília) quando pg_cron estiver disponível.
-- Se não estiver, o app também chama generate_loan_reminders() sempre que alguém abre.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('loan-reminders-daily', '0 11 * * *', 'select public.generate_loan_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron não configurado: %', sqlerrm;
end;
$$;
