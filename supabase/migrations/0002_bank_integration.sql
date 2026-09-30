-- Skeello Cash — integração bancária via Pluggy (Open Finance Brasil)
-- Rode depois de 0001_init.sql.

create extension if not exists "pgcrypto";

-- =========================================================
-- BANK CONNECTIONS (um "item" da Pluggy = uma conexão com uma instituição)
-- =========================================================
create table if not exists public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pluggy_item_id text not null unique,
  institution_name text not null,
  institution_image_url text,
  status text not null default 'UPDATING'
    check (status in ('UPDATING', 'UPDATED', 'LOGIN_ERROR', 'OUTDATED', 'ERROR')),
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists bank_connections_user_id_idx on public.bank_connections(user_id);

-- =========================================================
-- BANK ACCOUNTS (contas dentro de uma conexão: corrente, poupança, cartão...)
-- =========================================================
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.bank_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pluggy_account_id text not null unique,
  name text not null,
  type text,
  balance numeric(14,2) not null default 0,
  currency_code text not null default 'BRL',
  updated_at timestamptz not null default now()
);

create index if not exists bank_accounts_user_id_idx on public.bank_accounts(user_id);
create index if not exists bank_accounts_connection_id_idx on public.bank_accounts(connection_id);

-- =========================================================
-- BANK TRANSACTIONS (importadas da Pluggy; somente leitura no app)
-- =========================================================
create table if not exists public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.bank_accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  pluggy_transaction_id text not null unique,
  description text not null,
  amount numeric(14,2) not null,
  date date not null,
  category text,
  linked_debt_id uuid references public.debts(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists bank_transactions_user_id_idx on public.bank_transactions(user_id);
create index if not exists bank_transactions_account_id_idx on public.bank_transactions(account_id);
create index if not exists bank_transactions_date_idx on public.bank_transactions(date);

-- =========================================================
-- RLS
-- =========================================================
alter table public.bank_connections enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.bank_transactions enable row level security;

-- As Edge Functions usam a service_role key (que ignora RLS) para popular estas tabelas;
-- o usuário comum só pode LER as próprias linhas — nunca inserir/editar diretamente.
create policy "bank_connections_select_own" on public.bank_connections for select using (auth.uid() = user_id);
create policy "bank_connections_delete_own" on public.bank_connections for delete using (auth.uid() = user_id);

create policy "bank_accounts_select_own" on public.bank_accounts for select using (auth.uid() = user_id);

create policy "bank_transactions_select_own" on public.bank_transactions for select using (auth.uid() = user_id);
create policy "bank_transactions_update_own" on public.bank_transactions for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
