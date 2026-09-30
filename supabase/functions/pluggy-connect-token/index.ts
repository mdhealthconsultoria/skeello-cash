// Edge Function: pluggy-connect-token
// Gera um connect token de curta duração para o widget Pluggy Connect abrir no navegador.
// As credenciais da Pluggy (CLIENT_ID/CLIENT_SECRET) nunca chegam ao frontend.
//
// Secrets necessários (Project Settings > Edge Functions > Secrets, ou `supabase secrets set`):
//   PLUGGY_CLIENT_ID
//   PLUGGY_CLIENT_SECRET
//
// Deploy: supabase functions deploy pluggy-connect-token
// Chamada pelo app via: supabase.functions.invoke('pluggy-connect-token', { body: { itemId? } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLUGGY_API = 'https://api.pluggy.ai'

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 })
  }

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { status: 401 })
  }

  const clientId = Deno.env.get('PLUGGY_CLIENT_ID')
  const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    return new Response(
      JSON.stringify({ error: 'PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET não configurados nos secrets da Edge Function.' }),
      { status: 500 }
    )
  }

  const { itemId } = await req.json().catch(() => ({ itemId: undefined }))

  // 1. autentica na Pluggy com as credenciais do app (clientId/clientSecret) → apiKey
  const authRes = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  })
  if (!authRes.ok) {
    return new Response(JSON.stringify({ error: 'Falha ao autenticar na Pluggy', details: await authRes.text() }), {
      status: 502,
    })
  }
  const { apiKey } = await authRes.json()

  // 2. gera o connect token, vinculado ao usuário logado (clientUserId)
  const tokenRes = await fetch(`${PLUGGY_API}/connect_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
    body: JSON.stringify({
      itemId: itemId ?? undefined,
      options: { clientUserId: user.id },
    }),
  })
  if (!tokenRes.ok) {
    return new Response(JSON.stringify({ error: 'Falha ao gerar connect token', details: await tokenRes.text() }), {
      status: 502,
    })
  }
  const { accessToken } = await tokenRes.json()

  return new Response(JSON.stringify({ connectToken: accessToken }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
