-- Skeello Cash — diretório de usuários, notificação de "adicionou você como contato",
-- e contagem total de usuários. Rode depois de 0001 a 0004.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('due_today', 'due_soon', 'overdue', 'summary', 'debt_invite', 'debt_accepted', 'contact_added'));

-- =========================================================
-- TRIGGER: avisa quando alguém te adiciona como contato vinculado
-- =========================================================
create or replace function public.notify_contact_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adder_name text;
begin
  if new.linked_user_id is not null
     and (tg_op = 'INSERT' or old.linked_user_id is distinct from new.linked_user_id) then
    select coalesce(name, email) into v_adder_name from public.profiles where id = new.user_id;
    insert into public.notifications (user_id, debt_id, type, message)
    values (
      new.linked_user_id,
      null,
      'contact_added',
      coalesce(v_adder_name, 'Alguém') || ' adicionou você como contato no Skeello Cash.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_contact_added on public.people;
create trigger trg_notify_contact_added
  after insert or update on public.people
  for each row execute function public.notify_contact_added();

-- =========================================================
-- RPC: listar usuários do app (diretório), paginado, só campos públicos
-- =========================================================
create or replace function public.list_users(p_limit int default 30, p_offset int default 0)
returns table(id uuid, name text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.avatar_url
  from public.profiles p
  where p.id <> auth.uid()
  order by p.created_at desc
  limit least(p_limit, 50)
  offset greatest(p_offset, 0);
$$;

grant execute on function public.list_users(int, int) to authenticated;

-- =========================================================
-- RPC: total de usuários cadastrados (contador leve, sem tempo real)
-- =========================================================
create or replace function public.get_total_users_count()
returns int
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.profiles;
$$;

grant execute on function public.get_total_users_count() to authenticated;
