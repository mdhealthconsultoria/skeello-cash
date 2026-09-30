-- Skeello Cash — schema inicial
-- Rode este arquivo no SQL editor do seu projeto Supabase (ou via `supabase db push`).

create extension if not exists "pgcrypto";

-- =========================================================
-- PROFILES
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text not null,
  avatar_url text,
  currency text not null default 'BRL',
  created_at timestamptz not null default now()
);

-- =========================================================
-- USER SETTINGS
-- =========================================================
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  currency text not null default 'BRL',
  date_format text not null default 'dd/MM/yyyy',
  notify_due boolean not null default true,
  notify_overdue boolean not null default true,
  notify_summary boolean not null default true,
  demo_seeded boolean not null default false,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- CATEGORIES
-- =========================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'tag',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

-- =========================================================
-- PEOPLE
-- =========================================================
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  nickname text,
  phone text,
  email text,
  notes text,
  photo_url text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists people_user_id_idx on public.people(user_id);

-- =========================================================
-- DEBTS  (dinheiro a receber ou a pagar)
-- =========================================================
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('receivable', 'payable')),
  amount numeric(12,2) not null check (amount > 0),
  description text,
  agreed_payment_method text,
  issue_date date not null default current_date,
  due_date date,
  installments int not null default 1 check (installments >= 1),
  status text not null default 'pending'
    check (status in ('pending', 'partially_paid', 'paid', 'overdue', 'cancelled')),
  notes text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists debts_user_id_idx on public.debts(user_id);
create index if not exists debts_person_id_idx on public.debts(person_id);
create index if not exists debts_status_idx on public.debts(status);
create index if not exists debts_due_date_idx on public.debts(due_date);

-- =========================================================
-- PAYMENTS  (baixas, parciais ou totais, de uma debt)
-- =========================================================
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_date date not null default current_date,
  method text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payments_debt_id_idx on public.payments(debt_id);
create index if not exists payments_user_id_idx on public.payments(user_id);

-- =========================================================
-- NOTIFICATIONS
-- =========================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debt_id uuid references public.debts(id) on delete cascade,
  type text not null check (type in ('due_today', 'due_soon', 'overdue', 'summary')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on public.notifications(user_id);

-- =========================================================
-- VIEW: totals paid per debt + remaining amount
-- =========================================================
create or replace view public.debt_totals
with (security_invoker = on)
as
select
  d.id as debt_id,
  d.amount as original_amount,
  coalesce(sum(p.amount), 0) as paid_amount,
  d.amount - coalesce(sum(p.amount), 0) as remaining_amount
from public.debts d
left join public.payments p on p.debt_id = d.id
group by d.id, d.amount;

-- =========================================================
-- FUNCTION + TRIGGER: keep debts.status in sync with payments
-- =========================================================
create or replace function public.sync_debt_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_debt_id uuid;
  v_amount numeric(12,2);
  v_paid numeric(12,2);
  v_due date;
begin
  v_debt_id := coalesce(new.debt_id, old.debt_id);

  select amount, due_date into v_amount, v_due
  from public.debts where id = v_debt_id;

  select coalesce(sum(amount), 0) into v_paid
  from public.payments where debt_id = v_debt_id;

  update public.debts
  set status = case
        when v_paid >= v_amount then 'paid'
        when v_paid > 0 then 'partially_paid'
        when v_due is not null and v_due < current_date then 'overdue'
        else 'pending'
      end,
      updated_at = now()
  where id = v_debt_id
    and status <> 'cancelled';

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_debt_status_ins on public.payments;
create trigger trg_sync_debt_status_ins
  after insert on public.payments
  for each row execute function public.sync_debt_status();

drop trigger if exists trg_sync_debt_status_upd on public.payments;
create trigger trg_sync_debt_status_upd
  after update on public.payments
  for each row execute function public.sync_debt_status();

drop trigger if exists trg_sync_debt_status_del on public.payments;
create trigger trg_sync_debt_status_del
  after delete on public.payments
  for each row execute function public.sync_debt_status();

-- Mark overdue debts daily (call via pg_cron or Edge Function scheduler if desired)
create or replace function public.refresh_overdue_status()
returns void
language sql
security definer
set search_path = public
as $$
  update public.debts
  set status = 'overdue', updated_at = now()
  where status = 'pending'
    and due_date is not null
    and due_date < current_date;
$$;

-- =========================================================
-- FUNCTION + TRIGGER: new auth user -> profile + settings + default categories
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''), new.email);

  insert into public.user_settings (user_id)
  values (new.id);

  insert into public.categories (user_id, name, icon, is_default)
  values
    (new.id, 'Empréstimo', 'hand-coins', true),
    (new.id, 'Comida', 'utensils', true),
    (new.id, 'Transporte', 'car', true),
    (new.id, 'Compras', 'shopping-bag', true),
    (new.id, 'Moradia', 'home', true),
    (new.id, 'Estudos', 'graduation-cap', true),
    (new.id, 'Trabalho', 'briefcase', true),
    (new.id, 'Lazer', 'popcorn', true),
    (new.id, 'Saúde', 'heart-pulse', true),
    (new.id, 'Serviços', 'wrench', true),
    (new.id, 'Outros', 'more-horizontal', true);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- RLS
-- =========================================================
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.categories enable row level security;
alter table public.people enable row level security;
alter table public.debts enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

-- profiles
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- user_settings
create policy "settings_select_own" on public.user_settings for select using (auth.uid() = user_id);
create policy "settings_update_own" on public.user_settings for update using (auth.uid() = user_id);
create policy "settings_insert_own" on public.user_settings for insert with check (auth.uid() = user_id);

-- categories (global defaults have user_id null and are readable by everyone; custom ones are private)
create policy "categories_select" on public.categories
  for select using (user_id is null or auth.uid() = user_id);
create policy "categories_insert_own" on public.categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on public.categories
  for update using (auth.uid() = user_id);
create policy "categories_delete_own" on public.categories
  for delete using (auth.uid() = user_id);

-- people
create policy "people_select_own" on public.people for select using (auth.uid() = user_id);
create policy "people_insert_own" on public.people for insert with check (auth.uid() = user_id);
create policy "people_update_own" on public.people for update using (auth.uid() = user_id);
create policy "people_delete_own" on public.people for delete using (auth.uid() = user_id);

-- debts
-- (the related person must also belong to the same user)
create policy "debts_select_own" on public.debts for select using (auth.uid() = user_id);
create policy "debts_insert_own" on public.debts for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid())
);
create policy "debts_update_own" on public.debts for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.people p where p.id = person_id and p.user_id = auth.uid())
);
create policy "debts_delete_own" on public.debts for delete using (auth.uid() = user_id);

-- payments
-- (a payment must belong to a debt owned by the same user, so users can't tamper with each other's balances)
create policy "payments_select_own" on public.payments for select using (auth.uid() = user_id);
create policy "payments_insert_own" on public.payments for insert with check (
  auth.uid() = user_id
  and exists (select 1 from public.debts d where d.id = debt_id and d.user_id = auth.uid())
);
create policy "payments_update_own" on public.payments for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from public.debts d where d.id = debt_id and d.user_id = auth.uid())
);
create policy "payments_delete_own" on public.payments for delete using (auth.uid() = user_id);

-- notifications
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);
create policy "notifications_delete_own" on public.notifications for delete using (auth.uid() = user_id);

-- =========================================================
-- STORAGE: bucket para fotos de pessoas e avatares
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatar_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatar_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatar_owner_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatar_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
