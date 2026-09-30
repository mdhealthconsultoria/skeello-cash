import { supabase } from './supabase'

/** Dispara uma notificação push pro usuário (fire-and-forget — nunca trava a ação principal). */
export function sendPush(userId: string, title: string, body: string, url = '/') {
  supabase.functions.invoke('send-push', { body: { userId, title, body, url } }).catch(() => {
    /* notificação push é um "bônus" — se falhar, a notificação já existe dentro do app mesmo assim */
  })
}
