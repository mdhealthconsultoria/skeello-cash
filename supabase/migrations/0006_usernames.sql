-- Skeello Cash — nome de usuário único (@handle) pra busca e identificação
-- Rode depois de 0001 a 0005.

alter table public.profiles
  add column if not exists username text unique;

create index if not exists profiles_username_idx on public.profiles (lower(username));

-- gera um @usuário inicial pra quem já tem conta, a partir do nome + sufixo curto do id
update public.profiles
set username = lower(regexp_replace(coalesce(name, 'usuario'), '[^a-zA-Z0-9]+', '', 'g')) || substr(id::text, 1, 4)
where username is null;

alter table public.profiles alter column username set not null;

-- gera um @usuário por padrão pra quem criar conta a partir de agora
create or replace function public.generate_username(p_name text, p_id uuid)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(coalesce(nullif(trim(p_name), ''), 'usuario'), '[^a-zA-Z0-9]+', '', 'g')) || substr(p_id::text, 1, 4);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    new.email,
    public.generate_username(new.raw_user_meta_data->>'name', new.id)
  );

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

-- RPC: checar se um @usuário está disponível (antes de salvar em Configurações)
create or replace function public.is_username_available(p_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(p_username)
      and id <> auth.uid()
  );
$$;

grant execute on function public.is_username_available(text) to authenticated;

-- busca agora aceita nome OU @usuário
create or replace function public.search_users_by_name(p_query text)
returns table(id uuid, name text, avatar_url text, username text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.avatar_url, p.username
  from public.profiles p
  where length(trim(p_query)) >= 2
    and (p.name ilike '%' || trim(p_query) || '%' or p.username ilike trim(ltrim(p_query, '@')) || '%')
    and p.id <> auth.uid()
  order by p.name
  limit 10;
$$;

create or replace function public.find_user_by_email(p_email text)
returns table(id uuid, name text, avatar_url text, username text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.avatar_url, p.username
  from public.profiles p
  where lower(p.email) = lower(p_email)
    and p.id <> auth.uid()
  limit 1;
$$;

create or replace function public.list_users(p_limit int default 30, p_offset int default 0)
returns table(id uuid, name text, avatar_url text, username text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.avatar_url, p.username
  from public.profiles p
  where p.id <> auth.uid()
  order by p.created_at desc
  limit least(p_limit, 50)
  offset greatest(p_offset, 0);
$$;
