-- Skeello Cash — painel administrativo (só pro primeiro usuário cadastrado)
-- Rode depois de 0001 a 0007.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- marca o usuário mais antigo (primeiro cadastro) como admin — ninguém mais vira admin automaticamente
update public.profiles
set is_admin = true
where id = (select id from public.profiles order by created_at asc limit 1)
  and not exists (select 1 from public.profiles where is_admin = true);

-- =========================================================
-- RPC: visão geral (só admin — bloqueado no banco, não só escondido na tela)
-- =========================================================
create or replace function public.admin_get_overview()
returns table(total_users int, total_receivable numeric, total_payable numeric)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  return query
  select
    (select count(*)::int from public.profiles),
    (select coalesce(sum(dt.remaining_amount), 0)
       from public.debts d join public.debt_totals dt on dt.debt_id = d.id
       where d.type = 'receivable' and d.status <> 'cancelled'),
    (select coalesce(sum(dt.remaining_amount), 0)
       from public.debts d join public.debt_totals dt on dt.debt_id = d.id
       where d.type = 'payable' and d.status <> 'cancelled');
end;
$$;

-- =========================================================
-- RPC: lista de todos os usuários com nome, e-mail e totais de dívida
-- =========================================================
create or replace function public.admin_list_users()
returns table(
  id uuid,
  name text,
  email text,
  username text,
  created_at timestamptz,
  total_receivable numeric,
  total_payable numeric
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin = true) then
    raise exception 'Acesso restrito ao administrador.';
  end if;

  return query
  select
    p.id, p.name, p.email, p.username, p.created_at,
    coalesce((
      select sum(dt.remaining_amount) from public.debts d
      join public.debt_totals dt on dt.debt_id = d.id
      where d.user_id = p.id and d.type = 'receivable' and d.status <> 'cancelled'
    ), 0) as total_receivable,
    coalesce((
      select sum(dt.remaining_amount) from public.debts d
      join public.debt_totals dt on dt.debt_id = d.id
      where d.user_id = p.id and d.type = 'payable' and d.status <> 'cancelled'
    ), 0) as total_payable
  from public.profiles p
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_get_overview() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
