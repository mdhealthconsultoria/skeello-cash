import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

export function usePushNotifications() {
  const { user } = useAuth()
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  )
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  const checkSubscribed = useCallback(async () => {
    if (permission === 'unsupported' || !('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    setSubscribed(Boolean(sub))
  }, [permission])

  useEffect(() => {
    checkSubscribed()
  }, [checkSubscribed])

  async function enable() {
    if (permission === 'unsupported' || !user) return { error: 'Seu navegador não suporta notificações push.' }

    const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
    if (!vapidPublicKey) return { error: 'Notificações push não configuradas.' }

    setLoading(true)
    const result = await Notification.requestPermission()
    setPermission(result)

    if (result !== 'granted') {
      setLoading(false)
      return { error: 'Você precisa permitir notificações pro Skeello Cash poder te avisar.' }
    }

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })
      const json = sub.toJSON()

      const { error } = await supabase.from('push_subscriptions').insert({
        user_id: user.id,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      })

      setLoading(false)
      if (error && !error.message.includes('duplicate')) return { error: error.message }
      setSubscribed(true)
      return { error: null }
    } catch {
      setLoading(false)
      return { error: 'Não deu pra ativar as notificações agora.' }
    }
  }

  async function disable() {
    if (!('serviceWorker' in navigator)) return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    setSubscribed(false)
  }

  return { permission, subscribed, loading, enable, disable }
}
