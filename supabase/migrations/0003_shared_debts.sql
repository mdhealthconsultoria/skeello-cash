-- Skeello Cash — dívidas compartilhadas entre usuários reais do app (tipo Splitwise)
-- Rode depois de 0001_init.sql e 0002_bank_integration.sql.

-- =========================================================
-- NOVAS COLUNAS
-- =========================================================
alter table public.people
  add column if not exists linked_user_id uuid references auth.users(id) on delete set null;

alter table public.debts
  add column if not exists counterparty_user_id uuid references auth.users(id) on delete set null,
  add column if not exists share_status text not null default 'none'
    check (share_status in ('none', 'pending', 'accepted', 'declined')),
  add column if not exists mirror_debt_id uuid references public.debts(id) on delete set null;

alter table public.payments
  add column if not exists synced_from_payment_id uuid references public.payments(id) on delete set null;

create index if not exists debts_counterparty_user_id_idx on public.debts(counterparty_user_id);
create index if not exists people_linked_user_id_idx on public.people(linked_user_id);

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('due_today', 'due_soon', 'overdue', 'summary', 'debt_invite', 'debt_accepted'));

-- =========================================================
-- RPC: buscar usuário do app por e-mail exato (sem expor diretório inteiro)
-- =========================================================
create or replace function public.find_user_by_email(p_email text)
returns table(id uuid, name text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.avatar_url
  from public.profiles p
  where lower(p.email) = lower(p_email)
    and p.id <> auth.uid()
  limit 1;
$$;

grant execute on function public.find_user_by_email(text) to authenticated;

-- =========================================================
-- RPC: aceitar ou recusar um convite de dívida compartilhada
-- retorna o id da dívida espelhada criada (ou null se recusado)
-- =========================================================
create or replace function public.respond_to_debt_invite(p_debt_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt record;
  v_creator_name text;
  v_person_id uuid;
  v_mirror_id uuid;
begin
  select * into v_debt from public.debts where id = p_debt_id;

  if v_debt is null then
    raise exception 'Convite não encontrado';
  end if;
  if v_debt.counterparty_user_id is distinct from auth.uid() then
    raise exception 'Você não tem permissão para responder a este convite';
  end if;
  if v_debt.share_status <> 'pending' then
    raise exception 'Este convite já foi respondido';
  end if;

  if not p_accept then
    update public.debts set share_status = 'declined', updated_at = now() where id = p_debt_id;
    return null;
  end if;

  select coalesce(name, email) into v_creator_name from public.profiles where id = v_debt.user_id;

  select id into v_person_id from public.people
    where user_id = auth.uid() and linked_user_id = v_debt.user_id
    limit 1;

  if v_person_id is null then
    insert into public.people (user_id, name, linked_user_id)
    values (auth.uid(), coalesce(v_creator_name, 'Usuário Skeello Cash'), v_debt.user_id)
    returning id into v_person_id;
  end if;

  insert into public.debts (
    user_id, person_id, type, amount, description, issue_date, due_date,
    installments, notes, counterparty_user_id, share_status, mirror_debt_id
  ) values (
    auth.uid(), v_person_id,
    case when v_debt.type = 'receivable' then 'payable' else 'receivable' end,
    v_debt.amount, v_debt.description, v_debt.issue_date, v_debt.due_date,
    v_debt.installments, v_debt.notes, v_debt.user_id, 'accepted', p_debt_id
  ) returning id into v_mirror_id;

  update public.debts
  set share_status = 'accepted', mirror_debt_id = v_mirror_id, updated_at = now()
  where id = p_debt_id;

  update public.notifications set read = true
  where debt_id = p_debt_id and type = 'debt_invite' and user_id = auth.uid();

  insert into public.notifications (user_id, debt_id, type, message)
  values (
    v_debt.user_id,
    p_debt_id,
    'debt_accepted',
    (select coalesce(name, email) from public.profiles where id = auth.uid()) || ' aceitou a dívida compartilhada.'
  );

  return v_mirror_id;
end;
$$;

grant execute on function public.respond_to_debt_invite(uuid, boolean) to authenticated;

-- =========================================================
-- TRIGGER: notifica o convidado quando uma dívida compartilhada é criada
-- =========================================================
create or replace function public.notify_debt_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_name text;
begin
  if new.share_status = 'pending' and new.counterparty_user_id is not null then
    select coalesce(name, email) into v_creator_name from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, debt_id, type, message)
    values (
      new.counterparty_user_id,
      new.id,
      'debt_invite',
      coalesce(v_creator_name, 'Alguém') || ' quer registrar uma dívida compartilhada com você.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_debt_invite on public.debts;
create trigger trg_notify_debt_invite
  after insert on public.debts
  for each row execute function public.notify_debt_invite();

-- =========================================================
-- TRIGGER: espelhar pagamentos entre as duas pontas de uma dívida compartilhada
-- =========================================================
create or replace function public.sync_mirror_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mirror_debt_id uuid;
  v_mirror_user_id uuid;
begin
  if new.synced_from_payment_id is not null then
    return new;
  end if;

  select mirror_debt_id into v_mirror_debt_id from public.debts where id = new.debt_id;
  if v_mirror_debt_id is null then
    return new;
  end if;

  select user_id into v_mirror_user_id from public.debts where id = v_mirror_debt_id;

  insert into public.payments (debt_id, user_id, amount, payment_date, method, notes, synced_from_payment_id)
  values (v_mirror_debt_id, v_mirror_user_id, new.amount, new.payment_date, new.method, new.notes, new.id);

  return new;
end;
$$;

drop trigger if exists trg_sync_mirror_payment on public.payments;
create trigger trg_sync_mirror_payment
  after insert on public.payments
  for each row execute function public.sync_mirror_payment();

-- =========================================================
-- TRIGGER: ao excluir uma dívida compartilhada aceita, remove o espelho também
-- =========================================================
create or replace function public.sync_mirror_debt_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.mirror_debt_id is not null then
    update public.debts set mirror_debt_id = null where id = old.mirror_debt_id;
    delete from public.debts where id = old.mirror_debt_id;
  end if;
  return old;
end;
$$;

drop trigger if exists trg_sync_mirror_debt_delete on public.debts;
create trigger trg_sync_mirror_debt_delete
  before delete on public.debts
  for each row execute function public.sync_mirror_debt_delete();

-- =========================================================
-- RLS extra
-- =========================================================

-- o convidado precisa ver a dívida pendente antes de aceitar (ainda não é "dele")
create policy "debts_select_invited" on public.debts for select
  using (auth.uid() = counterparty_user_id and share_status = 'pending');

-- o convidado precisa ver o perfil de quem está convidando (nome/foto), só enquanto pendente
create policy "profiles_select_if_invited" on public.profiles for select
  using (
    exists (
      select 1 from public.debts d
      where d.user_id = profiles.id
        and d.counterparty_user_id = auth.uid()
        and d.share_status = 'pending'
    )
  );
