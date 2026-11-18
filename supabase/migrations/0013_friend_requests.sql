-- Skeello Cash — amizade com solicitação (precisa aceitar) e fotos dos amigos
-- Rode depois de 0001 a 0012.
--
--  * Qualquer usuário pode pedir amizade pelo @usuário. Só vira amigo quando a outra pessoa aceita.
--  * Ao aceitar, cada lado ganha o outro em "Pessoas" (já ligado à conta e com a foto), e passam a
--    aparecer como sugestão em dívidas e empréstimos.
--  * sync_friend_photos() mantém a foto das pessoas ligadas igual à foto atual do perfil delas.

-- =========================================================
-- TABELA
-- =========================================================
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  from_person_id uuid references public.people(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (from_user <> to_user)
);

create index if not exists friend_requests_to_idx on public.friend_requests(to_user, status);
create index if not exists friend_requests_from_idx on public.friend_requests(from_user, status);

alter table public.friend_requests enable row level security;

drop policy if exists "friend_requests_involved_select" on public.friend_requests;
create policy "friend_requests_involved_select" on public.friend_requests
  for select using (auth.uid() = from_user or auth.uid() = to_user);
-- sem policies de insert/update/delete: tudo passa pelas funções abaixo

-- novos tipos de notificação
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in (
    'due_today', 'due_soon', 'overdue', 'summary', 'debt_invite', 'debt_accepted', 'contact_added',
    'loan_shared', 'loan_due', 'loan_joined', 'reminder', 'friend_request', 'friend_accepted'
  ));

-- "adicionou você como contato" não precisa sair quando é a amizade aceita que está ligando as contas
create or replace function public.notify_contact_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_adder_name text;
begin
  if current_setting('skeello.skip_contact_notify', true) = '1' then
    return new;
  end if;
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

-- =========================================================
-- AUXILIARES
-- =========================================================
create or replace function public._are_friends(a uuid, b uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.friend_requests
    where status = 'accepted'
      and ((from_user = a and to_user = b) or (from_user = b and to_user = a))
  );
$$;

revoke all on function public._are_friends(uuid, uuid) from public, anon, authenticated;

-- garante que "owner" tem o amigo em Pessoas (ligado à conta, com a foto)
create or replace function public._link_friend_person(p_owner uuid, p_friend uuid, p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_avatar text;
begin
  select coalesce(nullif(name, ''), email), avatar_url into v_name, v_avatar from public.profiles where id = p_friend;

  if exists (select 1 from public.people where user_id = p_owner and linked_user_id = p_friend) then
    update public.people set photo_url = coalesce(v_avatar, photo_url), archived = false
    where user_id = p_owner and linked_user_id = p_friend;
  elsif p_person_id is not null and exists (select 1 from public.people where id = p_person_id and user_id = p_owner) then
    update public.people
    set linked_user_id = p_friend, photo_url = coalesce(v_avatar, photo_url), updated_at = now()
    where id = p_person_id;
  else
    insert into public.people (user_id, name, photo_url, linked_user_id)
    values (p_owner, coalesce(v_name, 'Amigo'), v_avatar, p_friend);
  end if;
end;
$$;

revoke all on function public._link_friend_person(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function public._accept_friendship(p_from uuid, p_to uuid, p_from_person uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('skeello.skip_contact_notify', '1', true);
  perform public._link_friend_person(p_from, p_to, p_from_person);
  perform public._link_friend_person(p_to, p_from, null);
  perform set_config('skeello.skip_contact_notify', '0', true);
end;
$$;

revoke all on function public._accept_friendship(uuid, uuid, uuid) from public, anon, authenticated;

-- =========================================================
-- AÇÕES
-- =========================================================
create or replace function public.send_friend_request(p_to uuid, p_person_id uuid default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me text;
  v_back public.friend_requests;
begin
  if p_to = auth.uid() then
    raise exception 'Você não pode adicionar a si mesmo.';
  end if;
  if not exists (select 1 from public.profiles where id = p_to) then
    raise exception 'Usuário não encontrado.';
  end if;
  if public._are_friends(auth.uid(), p_to) then
    raise exception 'Vocês já são amigos.';
  end if;
  if exists (select 1 from public.friend_requests where from_user = auth.uid() and to_user = p_to and status = 'pending') then
    raise exception 'Você já enviou uma solicitação para essa pessoa.';
  end if;

  -- a outra pessoa já tinha pedido a minha amizade: aceita na hora
  select * into v_back from public.friend_requests where from_user = p_to and to_user = auth.uid() and status = 'pending' limit 1;
  if found then
    update public.friend_requests set status = 'accepted', responded_at = now() where id = v_back.id;
    perform public._accept_friendship(v_back.from_user, v_back.to_user, v_back.from_person_id);
    -- o pedido que eu faria vira vínculo também na minha lista
    perform public._link_friend_person(auth.uid(), p_to, p_person_id);
    return 'accepted';
  end if;

  -- pedido antigo recusado pode ser refeito
  delete from public.friend_requests where from_user = auth.uid() and to_user = p_to and status = 'declined';

  insert into public.friend_requests (from_user, to_user, from_person_id) values (auth.uid(), p_to, p_person_id);

  select coalesce(nullif(name, ''), email) into v_me from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, type, message)
  values (p_to, 'friend_request', coalesce(v_me, 'Alguém') || ' quer ser seu amigo no Skeello Cash. Aceite em Pessoas > Solicitações.');
  return 'pending';
end;
$$;

grant execute on function public.send_friend_request(uuid, uuid) to authenticated;

create or replace function public.respond_friend_request(p_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.friend_requests;
  v_me text;
begin
  select * into r from public.friend_requests where id = p_id and to_user = auth.uid() and status = 'pending';
  if not found then
    raise exception 'Solicitação não encontrada.';
  end if;

  if p_accept then
    update public.friend_requests set status = 'accepted', responded_at = now() where id = r.id;
    perform public._accept_friendship(r.from_user, r.to_user, r.from_person_id);
    select coalesce(nullif(name, ''), email) into v_me from public.profiles where id = auth.uid();
    insert into public.notifications (user_id, type, message)
    values (r.from_user, 'friend_accepted', coalesce(v_me, 'Alguém') || ' aceitou sua solicitação. Vocês já podem enviar cobranças um ao outro.');
  else
    update public.friend_requests set status = 'declined', responded_at = now() where id = r.id;
  end if;
end;
$$;

grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;

create or replace function public.cancel_friend_request(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.friend_requests where id = p_id and from_user = auth.uid() and status = 'pending';
$$;

grant execute on function public.cancel_friend_request(uuid) to authenticated;

create or replace function public.remove_friend(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friend_requests
  where status = 'accepted'
    and ((from_user = auth.uid() and to_user = p_user) or (from_user = p_user and to_user = auth.uid()));
  -- os dois deixam de estar ligados à conta (a pessoa continua na lista, só sem vínculo)
  perform set_config('skeello.skip_contact_notify', '1', true);
  update public.people set linked_user_id = null where user_id = auth.uid() and linked_user_id = p_user;
  update public.people set linked_user_id = null where user_id = p_user and linked_user_id = auth.uid();
  perform set_config('skeello.skip_contact_notify', '0', true);
end;
$$;

grant execute on function public.remove_friend(uuid) to authenticated;

-- =========================================================
-- LISTAS
-- =========================================================
create or replace function public.list_friend_requests()
returns table(id uuid, direction text, user_id uuid, name text, avatar_url text, username text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select r.id,
         case when r.to_user = auth.uid() then 'in' else 'out' end,
         p.id,
         coalesce(nullif(p.name, ''), p.email),
         p.avatar_url,
         p.username,
         r.created_at
  from public.friend_requests r
  join public.profiles p on p.id = case when r.to_user = auth.uid() then r.from_user else r.to_user end
  where r.status = 'pending' and (r.to_user = auth.uid() or r.from_user = auth.uid())
  order by r.created_at desc;
$$;

grant execute on function public.list_friend_requests() to authenticated;

create or replace function public.list_friends()
returns table(id uuid, name text, avatar_url text, username text, since timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, coalesce(nullif(p.name, ''), p.email), p.avatar_url, p.username, r.responded_at
  from public.friend_requests r
  join public.profiles p on p.id = case when r.to_user = auth.uid() then r.from_user else r.to_user end
  where r.status = 'accepted' and (r.to_user = auth.uid() or r.from_user = auth.uid())
  order by coalesce(nullif(p.name, ''), p.email);
$$;

grant execute on function public.list_friends() to authenticated;

-- sugestões: amigos aceitos + contatos que já estavam ligados a uma conta
create or replace function public.list_following()
returns table(id uuid, name text, avatar_url text, username text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct on (u.id) u.id, u.name, u.avatar_url, u.username
  from (
    select p.id, coalesce(nullif(p.name, ''), p.email) as name, p.avatar_url, p.username
    from public.friend_requests r
    join public.profiles p on p.id = case when r.to_user = auth.uid() then r.from_user else r.to_user end
    where r.status = 'accepted' and (r.to_user = auth.uid() or r.from_user = auth.uid())
    union all
    select pr.id, pr.name, pr.avatar_url, pr.username
    from public.people pe
    join public.profiles pr on pr.id = pe.linked_user_id
    where pe.user_id = auth.uid() and not pe.archived
  ) u
  order by u.id;
$$;

grant execute on function public.list_following() to authenticated;

-- mantém a foto de quem é ligado a uma conta igual à foto atual do perfil
create or replace function public.sync_friend_photos()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.people pe
  set photo_url = pr.avatar_url
  from public.profiles pr
  where pe.user_id = auth.uid()
    and pe.linked_user_id = pr.id
    and pr.avatar_url is not null
    and pe.photo_url is distinct from pr.avatar_url;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.sync_friend_photos() to authenticated;
