-- Skeello Cash — privacidade, código de empréstimo, admin por e-mail, amigos e lembretes do usuário
-- Rode depois de 0001 a 0009.
--
-- O que muda:
--  1. Admin passa a ser só o e-mail do dono (matheusdavid13723@gmail.com) e ninguém consegue se promover.
--  2. Cada empréstimo ganha um CÓDIGO. Devedor e co-fundador entram digitando o código.
--  3. O devedor vê só o TOTAL. O co-fundador vê só o que ELE recebe (nunca o que o dono cobra por cima).
--  4. Só o admin enxerga a lista de todos os usuários. Os outros acham alguém só pelo @usuário exato.
--  5. Painel admin com o detalhe completo de cada perfil e de qualquer empréstimo.
--  6. Lembretes criados pelo próprio usuário ("avisar 1 dia antes do que eu tenho a receber/pagar").

-- =========================================================
-- 1. ADMIN: só o e-mail do dono, e ninguém se auto-promove
-- =========================================================
create or replace function public._is_owner_email(p_email text)
returns boolean
language sql
immutable
as $$
  select lower(coalesce(p_email, '')) = 'matheusdavid13723@gmail.com';
$$;

-- tira o admin de todo mundo e deixa só o e-mail do dono
update public.profiles set is_admin = public._is_owner_email(email);

-- a policy profiles_update_own deixava qualquer um mudar a própria linha, inclusive is_admin.
-- Este gatilho trava o campo quando a alteração vem de um usuário logado.
create or replace function public.protect_is_admin()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.is_admin := public._is_owner_email(new.email);
  elsif auth.uid() is not null then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_is_admin on public.profiles;
create trigger trg_protect_is_admin
  before insert or update on public.profiles
  for each row execute function public.protect_is_admin();

create or replace function public._assert_admin()
returns void
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Acesso restrito ao administrador.';
  end if;
end;
$$;

revoke all on function public._assert_admin() from public, anon, authenticated;

-- =========================================================
-- 2. CÓDIGO DO EMPRÉSTIMO
-- =========================================================
alter table public.loans add column if not exists share_code text;

create or replace function public._new_share_code()
returns text
language plpgsql
volatile
as $$
declare
  v_code text;
begin
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    exit when not exists (select 1 from public.loans where share_code = v_code);
  end loop;
  return v_code;
end;
$$;

update public.loans set share_code = public._new_share_code() where share_code is null;

create unique index if not exists loans_share_code_key on public.loans(share_code);

create or replace function public.set_loan_share_code()
returns trigger
language plpgsql
as $$
begin
  if new.share_code is null or new.share_code = '' then
    new.share_code := public._new_share_code();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_loan_share_code on public.loans;
create trigger trg_set_loan_share_code
  before insert on public.loans
  for each row execute function public.set_loan_share_code();

-- o app mostra o código em grupos de 5 (ABCDE-12345); aqui só normalizamos a entrada
create or replace function public._norm_code(p_code text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

-- dono gera um código novo (o antigo deixa de valer)
create or replace function public.regenerate_loan_code(p_loan_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  v_code := public._new_share_code();
  update public.loans set share_code = v_code, updated_at = now()
  where id = p_loan_id and owner_id = auth.uid();
  if not found then
    raise exception 'Empréstimo não encontrado.';
  end if;
  return v_code;
end;
$$;

grant execute on function public.regenerate_loan_code(uuid) to authenticated;

-- 1º passo de quem recebeu o código: ver de quem é e quais vagas estão abertas.
-- Não devolve valor, juros nem nome do devedor.
create or replace function public.lookup_loan_code(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  l public.loans;
begin
  select * into l from public.loans where share_code = public._norm_code(p_code);
  if not found then
    raise exception 'Código não encontrado. Confira com quem te enviou.';
  end if;
  if l.owner_id = auth.uid() then
    raise exception 'Esse empréstimo é seu. Envie o código para as outras pessoas.';
  end if;
  if l.borrower_user_id = auth.uid()
     or exists (select 1 from public.loan_funders f where f.loan_id = l.id and f.funder_user_id = auth.uid()) then
    raise exception 'Você já tem acesso a esse empréstimo.';
  end if;

  return jsonb_build_object(
    'owner_name', (select coalesce(nullif(name, ''), email) from public.profiles where id = l.owner_id),
    'due_date', l.due_date,
    'borrower_open', l.borrower_user_id is null,
    'funders_open', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'name', f.funder_name) order by f.created_at)
      from public.loan_funders f where f.loan_id = l.id and f.funder_user_id is null
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.lookup_loan_code(text) to authenticated;

-- 2º passo: entrar no empréstimo como devedor ou como co-fundador (numa vaga ainda livre)
create or replace function public.redeem_loan_code(p_code text, p_role text, p_funder_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  l public.loans;
  v_me text;
begin
  select * into l from public.loans where share_code = public._norm_code(p_code);
  if not found then
    raise exception 'Código não encontrado. Confira com quem te enviou.';
  end if;
  if l.owner_id = auth.uid() then
    raise exception 'Esse empréstimo é seu.';
  end if;
  if l.borrower_user_id = auth.uid()
     or exists (select 1 from public.loan_funders f where f.loan_id = l.id and f.funder_user_id = auth.uid()) then
    raise exception 'Você já tem acesso a esse empréstimo.';
  end if;

  select coalesce(nullif(name, ''), email) into v_me from public.profiles where id = auth.uid();

  if p_role = 'borrower' then
    update public.loans set borrower_user_id = auth.uid(), updated_at = now()
    where id = l.id and borrower_user_id is null;
    if not found then
      raise exception 'Esse empréstimo já tem um devedor vinculado. Peça ao dono para liberar a vaga.';
    end if;
    insert into public.notifications (user_id, loan_id, type, message)
    values (l.owner_id, l.id, 'loan_joined', coalesce(v_me, 'Alguém') || ' entrou no empréstimo de ' || l.borrower_name || ' como devedor.');
  elsif p_role = 'funder' then
    update public.loan_funders set funder_user_id = auth.uid()
    where id = p_funder_id and loan_id = l.id and funder_user_id is null;
    if not found then
      raise exception 'Essa vaga de co-fundador não está mais livre. Peça ao dono para liberar.';
    end if;
    insert into public.notifications (user_id, loan_id, type, message)
    values (l.owner_id, l.id, 'loan_joined', coalesce(v_me, 'Alguém') || ' entrou no empréstimo de ' || l.borrower_name || ' como co-fundador.');
  else
    raise exception 'Escolha se você é o devedor ou o co-fundador.';
  end if;

  return l.id;
end;
$$;

grant execute on function public.redeem_loan_code(text, text, uuid) to authenticated;

-- =========================================================
-- 3. PRIVACIDADE: o que cada lado enxerga
-- =========================================================
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'due_today', 'due_soon', 'overdue', 'summary', 'debt_invite', 'debt_accepted', 'contact_added',
    'loan_shared', 'loan_due', 'loan_joined', 'reminder'
  ));

-- Devedor: só o TOTAL e o que já pagou. Sem valor emprestado, sem % de juros.
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

-- Co-fundador: só o que ELE colocou, a % dele e o que ele recebe.
-- Nada do valor total do devedor nem do que o dono cobra por cima.
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

-- =========================================================
-- 4. AMIGOS: só o admin vê todo mundo; os outros acham por @usuário exato
-- =========================================================
create or replace function public.list_users(p_limit int default 30, p_offset int default 0)
returns table(id uuid, name text, avatar_url text, username text)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public._assert_admin();
  return query
  select p.id, p.name, p.avatar_url, p.username
  from public.profiles p
  where p.id <> auth.uid()
  order by p.created_at desc
  limit least(p_limit, 50)
  offset greatest(p_offset, 0);
end;
$$;

create or replace function public.get_total_users_count()
returns int
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public._assert_admin();
  return (select count(*)::int from public.profiles);
end;
$$;

-- mesma assinatura de antes, mas agora só casa o @usuário EXATO (sem listar nem adivinhar por pedaço de nome)
create or replace function public.search_users_by_name(p_query text)
returns table(id uuid, name text, avatar_url text, username text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.avatar_url, p.username
  from public.profiles p
  where length(trim(ltrim(p_query, '@'))) >= 3
    and lower(p.username) = lower(trim(ltrim(p_query, '@')))
    and p.id <> auth.uid()
  limit 1;
$$;

-- quem eu sigo = pessoas minhas ligadas a um usuário do app
create or replace function public.list_following()
returns table(id uuid, name text, avatar_url text, username text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (pr.id) pr.id, pr.name, pr.avatar_url, pr.username
  from public.people pe
  join public.profiles pr on pr.id = pe.linked_user_id
  where pe.user_id = auth.uid() and not pe.archived
  order by pr.id;
$$;

grant execute on function public.list_following() to authenticated;

-- =========================================================
-- 5. LEMBRETES DO USUÁRIO
-- =========================================================
create table if not exists public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('receive', 'pay')),
  days_before int not null check (days_before between 0 and 60),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, kind, days_before)
);

create index if not exists notification_rules_user_idx on public.notification_rules(user_id);

create table if not exists public.reminder_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid not null references public.notification_rules(id) on delete cascade,
  due_date date not null,
  sent_at timestamptz not null default now(),
  primary key (rule_id, due_date)
);

alter table public.notification_rules enable row level security;
alter table public.reminder_log enable row level security;

create policy "notification_rules_own_all" on public.notification_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- reminder_log: sem policies, só as funções security definer mexem

-- todo mundo começa com "1 dia antes" pra receber e pra pagar
insert into public.notification_rules (user_id, kind, days_before)
select p.id, k.kind, 1 from public.profiles p cross join (values ('receive'), ('pay')) as k(kind)
on conflict do nothing;

create or replace function public.add_default_reminder_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_rules (user_id, kind, days_before)
  values (new.id, 'receive', 1), (new.id, 'pay', 1)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_default_reminder_rules on public.profiles;
create trigger trg_default_reminder_rules
  after insert on public.profiles
  for each row execute function public.add_default_reminder_rules();

-- Soma o que o usuário tem a receber ou a pagar numa data (dívidas + empréstimos) e avisa uma vez só.
create or replace function public._run_reminders(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
  v_target date;
  v_total numeric;
  v_rows int;
  v_when text;
  v_count int := 0;
  v_notify boolean;
begin
  select notify_due into v_notify from public.user_settings where user_id = p_user;
  if v_notify is false then
    return 0;
  end if;

  for r in select * from public.notification_rules where user_id = p_user and enabled loop
    v_target := v_today + r.days_before;

    if r.kind = 'receive' then
      select
        coalesce((
          select sum(dt.remaining_amount) from public.debts d
          join public.debt_totals dt on dt.debt_id = d.id
          where d.user_id = p_user and d.type = 'receivable' and d.due_date = v_target
            and d.status not in ('paid', 'cancelled') and not d.archived
        ), 0)
        + coalesce((
          select sum(greatest(round(l.principal * (1 + l.borrower_rate / 100), 2)
                 - coalesce((select sum(lp.amount) from public.loan_payments lp where lp.loan_id = l.id), 0), 0))
          from public.loans l where l.owner_id = p_user and not l.closed and l.due_date = v_target
        ), 0)
        + coalesce((
          select sum(greatest(round(f.amount * (1 + f.rate / 100), 2)
                 - coalesce((select sum(fp.amount) from public.funder_payments fp where fp.funder_id = f.id), 0), 0))
          from public.loan_funders f join public.loans l on l.id = f.loan_id
          where f.funder_user_id = p_user and not l.closed and l.due_date = v_target
        ), 0)
      into v_total;
    else
      select
        coalesce((
          select sum(dt.remaining_amount) from public.debts d
          join public.debt_totals dt on dt.debt_id = d.id
          where d.user_id = p_user and d.type = 'payable' and d.due_date = v_target
            and d.status not in ('paid', 'cancelled') and not d.archived
        ), 0)
        + coalesce((
          select sum(greatest(round(l.principal * (1 + l.borrower_rate / 100), 2)
                 - coalesce((select sum(lp.amount) from public.loan_payments lp where lp.loan_id = l.id), 0), 0))
          from public.loans l where l.borrower_user_id = p_user and not l.closed and l.due_date = v_target
        ), 0)
        + coalesce((
          select sum(greatest(round(f.amount * (1 + f.rate / 100), 2)
                 - coalesce((select sum(fp.amount) from public.funder_payments fp where fp.funder_id = f.id), 0), 0))
          from public.loan_funders f join public.loans l on l.id = f.loan_id
          where l.owner_id = p_user and not l.closed and l.due_date = v_target
        ), 0)
      into v_total;
    end if;

    if v_total > 0.009 then
      insert into public.reminder_log (user_id, rule_id, due_date)
      values (p_user, r.id, v_target)
      on conflict do nothing;
      get diagnostics v_rows = row_count;

      if v_rows > 0 then
        v_when := case r.days_before
          when 0 then 'Hoje'
          when 1 then 'Amanhã'
          else 'Em ' || r.days_before || ' dias (' || to_char(v_target, 'DD/MM') || ')'
        end;
        insert into public.notifications (user_id, type, message)
        values (
          p_user, 'reminder',
          v_when || ' você tem R$ ' || public._brl(v_total)
            || case r.kind when 'receive' then ' a receber.' else ' a pagar.' end
        );
        v_count := v_count + 1;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function public._run_reminders(uuid) from public, anon, authenticated;

-- o app chama isso ao abrir (só para o próprio usuário)
create or replace function public.generate_my_reminders()
returns int
language sql
security definer
set search_path = public
as $$
  select public._run_reminders(auth.uid());
$$;

grant execute on function public.generate_my_reminders() to authenticated;

-- agendador (todos os usuários)
create or replace function public.generate_all_reminders()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  u uuid;
  v_count int := 0;
begin
  for u in select distinct user_id from public.notification_rules where enabled loop
    v_count := v_count + public._run_reminders(u);
  end loop;
  return v_count;
end;
$$;

revoke all on function public.generate_all_reminders() from public, anon, authenticated;

-- o aviso fixo antigo (10/7/3/1 dias para todo mundo) sai: agora cada um escolhe os seus
create or replace function public.generate_loan_reminders()
returns int
language sql
security definer
set search_path = public
as $$
  select public._run_reminders(auth.uid());
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('loan-reminders-daily');
  end if;
exception when others then
  raise notice 'unschedule: %', sqlerrm;
end;
$$;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('reminders-daily', '0 11 * * *', 'select public.generate_all_reminders()');
  end if;
exception when others then
  raise notice 'pg_cron não configurado: %', sqlerrm;
end;
$$;

-- =========================================================
-- 6. PAINEL ADMIN
-- =========================================================
create or replace function public._admin_loan_json(l public.loans)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select to_jsonb(l) || jsonb_build_object(
    'owner_name', (select coalesce(nullif(name, ''), email) from public.profiles where id = l.owner_id),
    'borrower_account', (select coalesce(nullif(name, ''), email) from public.profiles where id = l.borrower_user_id),
    'total', round(l.principal * (1 + l.borrower_rate / 100), 2),
    'paid', coalesce((select sum(amount) from public.loan_payments where loan_id = l.id), 0),
    'funders', coalesce((
      select jsonb_agg(to_jsonb(f) || jsonb_build_object(
        'account_name', (select coalesce(nullif(name, ''), email) from public.profiles where id = f.funder_user_id),
        'paid', coalesce((select sum(amount) from public.funder_payments where funder_id = f.id), 0)
      ) order by f.created_at)
      from public.loan_funders f where f.loan_id = l.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.paid_at desc) from public.loan_payments p where p.loan_id = l.id
    ), '[]'::jsonb)
  );
$$;

revoke all on function public._admin_loan_json(public.loans) from public, anon, authenticated;

-- lista de usuários com contagens (substitui a versão antiga)
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table(
  id uuid,
  name text,
  email text,
  username text,
  created_at timestamptz,
  total_receivable numeric,
  total_payable numeric,
  loans_count int,
  loans_total numeric,
  participations_count int,
  people_count int
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public._assert_admin();

  return query
  select
    p.id, p.name, p.email, p.username, p.created_at,
    coalesce((
      select sum(dt.remaining_amount) from public.debts d
      join public.debt_totals dt on dt.debt_id = d.id
      where d.user_id = p.id and d.type = 'receivable' and d.status <> 'cancelled'
    ), 0),
    coalesce((
      select sum(dt.remaining_amount) from public.debts d
      join public.debt_totals dt on dt.debt_id = d.id
      where d.user_id = p.id and d.type = 'payable' and d.status <> 'cancelled'
    ), 0),
    (select count(*)::int from public.loans l where l.owner_id = p.id),
    coalesce((select sum(round(l.principal * (1 + l.borrower_rate / 100), 2)) from public.loans l where l.owner_id = p.id), 0),
    (select count(*)::int from public.loans l where l.borrower_user_id = p.id)
      + (select count(*)::int from public.loan_funders f where f.funder_user_id = p.id),
    (select count(*)::int from public.people pe where pe.user_id = p.id)
  from public.profiles p
  order by p.created_at desc;
end;
$$;

-- tudo de um perfil: configurações, lembretes, pessoas, dívidas e empréstimos (completos)
create or replace function public.admin_get_user_detail(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public._assert_admin();

  return jsonb_build_object(
    'profile', (select to_jsonb(p) from public.profiles p where p.id = p_user),
    'settings', (select to_jsonb(s) from public.user_settings s where s.user_id = p_user),
    'push_enabled', exists (select 1 from public.push_subscriptions ps where ps.user_id = p_user),
    'rules', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.kind, r.days_before)
      from public.notification_rules r where r.user_id = p_user
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', pe.id, 'name', pe.name, 'phone', pe.phone, 'email', pe.email,
        'archived', pe.archived, 'following', pe.linked_user_id is not null
      ) order by pe.name)
      from public.people pe where pe.user_id = p_user
    ), '[]'::jsonb),
    'debts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'type', d.type, 'person', pe.name, 'amount', d.amount,
        'paid', dt.paid_amount, 'remaining', dt.remaining_amount,
        'due_date', d.due_date, 'status', d.status, 'description', d.description
      ) order by d.due_date nulls last)
      from public.debts d
      join public.people pe on pe.id = d.person_id
      join public.debt_totals dt on dt.debt_id = d.id
      where d.user_id = p_user
    ), '[]'::jsonb),
    'loans_owned', coalesce((
      select jsonb_agg(public._admin_loan_json(l) order by l.due_date)
      from public.loans l where l.owner_id = p_user
    ), '[]'::jsonb),
    'loans_joined', coalesce((
      select jsonb_agg(public._admin_loan_json(l) order by l.due_date)
      from public.loans l
      where l.borrower_user_id = p_user
         or exists (select 1 from public.loan_funders f where f.loan_id = l.id and f.funder_user_id = p_user)
    ), '[]'::jsonb)
  );
end;
$$;

-- todos os empréstimos de todo mundo
create or replace function public.admin_list_loans()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  perform public._assert_admin();
  return coalesce((
    select jsonb_agg(public._admin_loan_json(l) order by l.due_date)
    from public.loans l
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_get_user_detail(uuid) to authenticated;
grant execute on function public.admin_list_loans() to authenticated;
