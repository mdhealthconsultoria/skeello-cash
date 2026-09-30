-- Skeello Cash — busca de usuários por nome (estilo rede social)
-- Rode depois de 0001, 0002 e 0003.

-- Retorna só nome + foto (nunca e-mail) de usuários cujo nome bate com a busca.
-- Limitado a 10 resultados, exige pelo menos 2 caracteres, nunca retorna o próprio usuário.
create or replace function public.search_users_by_name(p_query text)
returns table(id uuid, name text, avatar_url text)
language sql
security definer
set search_path = public
stable
as $$
  select p.id, p.name, p.avatar_url
  from public.profiles p
  where length(trim(p_query)) >= 2
    and p.name ilike '%' || trim(p_query) || '%'
    and p.id <> auth.uid()
  order by p.name
  limit 10;
$$;

grant execute on function public.search_users_by_name(text) to authenticated;
