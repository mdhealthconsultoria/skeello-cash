// Edge Function: pluggy-sync
// Busca contas e transações de um "item" (conexão bancária) na Pluggy e grava no Supabase.
// Roda toda vez que o widget termina a conexão (onSuccess) ou quando o usuário pede "Atualizar".
//
// Secrets necessários: PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET
// Deploy: supabase functions deploy pluggy-sync
// Chamada pelo app via: supabase.functions.invoke('pluggy-sync', { body: { itemId } })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLUGGY_API = 'https://api.pluggy.ai'

async function pluggyApiKey(clientId: string, clientSecret: string) {
  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  })
  if (!res.ok) throw new Error(`Falha ao autenticar na Pluggy: ${await res.text()}`)
  const { apiKey } = await res.json()
  return apiKey as string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { status: 401 })
  }

  const { itemId } = await req.json().catch(() => ({ itemId: undefined }))
  if (!itemId) {
    return new Response(JSON.stringify({ error: 'itemId é obrigatório' }), { status: 400 })
  }

  const clientId = Deno.env.get('PLUGGY_CLIENT_ID')
  const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({ error: 'PLUGGY_CLIENT_ID / PLUGGY_CLIENT_SECRET não configurados.' }), {
      status: 500,
    })
  }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    const apiKey = await pluggyApiKey(clientId, clientSecret)
    const headers = { 'X-API-KEY': apiKey }

    // item (dados da instituição + status da conexão)
    const itemRes = await fetch(`${PLUGGY_API}/items/${itemId}`, { headers })
    if (!itemRes.ok) throw new Error(`Falha ao buscar item: ${await itemRes.text()}`)
    const item = await itemRes.json()

    const { data: connection, error: connError } = await admin
      .from('bank_connections')
      .upsert(
        {
          user_id: user.id,
          pluggy_item_id: itemId,
          institution_name: item.connector?.name ?? 'Instituição',
          institution_image_url: item.connector?.imageUrl ?? null,
          status: item.status ?? 'UPDATED',
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: 'pluggy_item_id' }
      )
      .select()
      .single()
    if (connError) throw connError

    // contas
    const accountsRes = await fetch(`${PLUGGY_API}/accounts?itemId=${itemId}`, { headers })
    if (!accountsRes.ok) throw new Error(`Falha ao buscar contas: ${await accountsRes.text()}`)
    const { results: accounts } = await accountsRes.json()

    let transactionCount = 0

    for (const acc of accounts ?? []) {
      const { data: savedAccount, error: accError } = await admin
        .from('bank_accounts')
        .upsert(
          {
            connection_id: connection.id,
            user_id: user.id,
            pluggy_account_id: acc.id,
            name: acc.name,
            type: acc.type,
            balance: acc.balance ?? 0,
            currency_code: acc.currencyCode ?? 'BRL',
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'pluggy_account_id' }
        )
        .select()
        .single()
      if (accError) throw accError

      // transações dos últimos 90 dias
      const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const txRes = await fetch(
        `${PLUGGY_API}/transactions?accountId=${acc.id}&from=${from}&pageSize=500`,
        { headers }
      )
      if (!txRes.ok) throw new Error(`Falha ao buscar transações: ${await txRes.text()}`)
      const { results: transactions } = await txRes.json()

      const rows = (transactions ?? []).map((t: Record<string, unknown>) => ({
        account_id: savedAccount.id,
        user_id: user.id,
        pluggy_transaction_id: t.id,
        description: t.description,
        amount: t.amount,
        date: String(t.date).slice(0, 10),
        category: t.category ?? null,
      }))

      if (rows.length) {
        const { error: txError } = await admin.from('bank_transactions').upsert(rows, { onConflict: 'pluggy_transaction_id' })
        if (txError) throw txError
        transactionCount += rows.length
      }
    }

    return new Response(JSON.stringify({ accounts: accounts?.length ?? 0, transactions: transactionCount }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }), {
      status: 500,
    })
  }
})
