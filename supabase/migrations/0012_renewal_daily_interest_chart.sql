-- Skeello Cash — renovação só com juros, juros ao dia, gráfico liberado ao co-fundador
-- Rode depois de 0001 a 0011.
--
--  1. Juros ao dia: loans.daily_rate / loan_funders.daily_rate guardam o % ao dia combinado.
--     O % total (borrower_rate / rate) continua sendo o que as contas usam.
--  2. Renovação: quem só paga os juros renova o prazo. A função renew_loan() registra o
--     pagamento dos juros, empurra o vencimento e soma os juros do novo prazo.
--  3. loan_funders.can_see_chart: o dono libera o gráfico (valor x juros) para o co-fundador.
--  4. user_settings.default_daily_rate: o % ao dia padrão de cada usuário (Configurações).

alter table public.loans add column if not exists daily_rate numeric(8,4) check (daily_rate is null or daily_rate >= 0);
alter table public.loans add column if not exists term_rate numeric(7,2);
alter table public.loan_funders add column if not exists daily_rate numeric(8,4) check (daily_rate is null or daily_rate >= 0);
alter table public.loan_funders add column if not exists term_rate numeric(7,2);
alter table public.loan_funders add column if not exists can_see_chart boolean not null default false;
alter table public.user_settings add column if not exists default_daily_rate numeric(8,4) not null default 0 check (default_daily_rate >= 0);

-- term_rate = o % de UM prazo (o que se soma a cada renovação)
update public.loans set term_rate = borrower_rate where term_rate is null;
update public.loan_funders set term_rate = rate where term_rate is null;

create or replace function public.set_term_rate_loans()
returns trigger language plpgsql as $$
begin
  if new.term_rate is null then new.term_rate := new.borrower_rate; end if;
  return new;
end;
$$;

create or replace function public.set_term_rate_funders()
returns trigger language plpgsql as $$
begin
  if new.term_rate is null then new.term_rate := new.rate; end if;
  return new;
end;
$$;

drop trigger if exists trg_term_rate_loans on public.loans;
create trigger trg_term_rate_loans before insert on public.loans
  for each row execute function public.set_term_rate_loans();

drop trigger if exists trg_term_rate_funders on public.loan_funders;
create trigger trg_term_rate_funders before insert on public.loan_funders
  for each row execute function public.set_term_rate_funders();

-- histórico de renovações
create table if not exists public.loan_renewals (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  interest_paid numeric(12,2) not null default 0 check (interest_paid >= 0),
  old_due date not null,
  new_due date not null,
  term_rate numeric(7,2) not null default 0,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists loan_renewals_loan_idx on public.loan_renewals(loan_id);

alter table public.loan_renewals enable row level security;

drop policy if exists "loan_renewals_owner_all" on public.loan_renewals;
create policy "loan_renewals_owner_all" on public.loan_renewals
  for all using (auth.uid() = owner_id)
  with check (
    auth.uid() = owner_id
    and exists (select 1 from public.loans l where l.id = loan_id and l.owner_id = auth.uid())
  );

-- Renovar: o devedor pagou só os juros (p_interest_paid) e o empréstimo ganha novo prazo.
-- O valor emprestado continua o mesmo. Os juros do novo prazo (p_term_rate, em % do valor) são
-- somados ao % total; os co-fundadores também ganham os juros do novo prazo.
create or replace function public.renew_loan(
  p_loan_id uuid,
  p_interest_paid numeric,
  p_new_due date,
  p_term_rate numeric,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.loans;
  f record;
  v_days int;
  v_fterm numeric;
begin
  select * into l from public.loans where id = p_loan_id and owner_id = auth.uid() for update;
  if not found then
    raise exception 'Empréstimo não encontrado.';
  end if;
  if p_new_due <= l.due_date then
    raise exception 'O novo vencimento precisa ser depois do vencimento atual.';
  end if;
  if coalesce(p_term_rate, 0) < 0 or coalesce(p_interest_paid, 0) < 0 then
    raise exception 'Valores não podem ser negativos.';
  end if;

  v_days := p_new_due - l.due_date;

  if coalesce(p_interest_paid, 0) > 0 then
    insert into public.loan_payments (loan_id, owner_id, amount, paid_at, note)
    values (l.id, auth.uid(), p_interest_paid, current_date, coalesce(nullif(p_note, ''), 'Juros (renovação)'));
  end if;

  insert into public.loan_renewals (loan_id, owner_id, interest_paid, old_due, new_due, term_rate, note)
  values (l.id, auth.uid(), coalesce(p_interest_paid, 0), l.due_date, p_new_due, coalesce(p_term_rate, 0), p_note);

  update public.loans
  set borrower_rate = borrower_rate + coalesce(p_term_rate, 0),
      term_rate = coalesce(p_term_rate, 0),
      due_date = p_new_due,
      closed = false,
      updated_at = now()
  where id = l.id;

  for f in select * from public.loan_funders where loan_id = l.id loop
    v_fterm := case when f.daily_rate is not null then round(f.daily_rate * v_days, 2) else coalesce(f.term_rate, f.rate) end;
    update public.loan_funders set rate = rate + v_fterm, term_rate = v_fterm where id = f.id;
  end loop;
end;
$$;

grant execute on function public.renew_loan(uuid, numeric, date, numeric, text) to authenticated;

-- Co-fundador: igual a antes + se o dono liberou o gráfico
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
      f.can_see_chart,
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
