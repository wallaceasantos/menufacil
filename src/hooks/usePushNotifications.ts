import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { apiWithTenant, API_URL } from '../lib/api'
import { getTenantSlug } from '../data/tenantStorage'

export function usePushNotifications() {
  const { user, isAuthenticated } = useAuth()
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)

  const slug = getTenantSlug(user)

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
    const raw = window.atob(base64)
    return new Uint8Array([...raw].map((c) => c.charCodeAt(0)))
  }

  useEffect(() => {
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window)
    if (!pushSupported || !isAuthenticated) return

    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        setPushSubscribed(!!sub)
      })
    })
  }, [isAuthenticated, pushSupported])

  const subscribe = useCallback(async () => {
    if (!pushSupported || !slug) return
    setPushLoading(true)

    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const vapidKey = await apiWithTenant<{ publicKey: string }>('/push/vapid-key', slug)

      if (!vapidKey?.publicKey) {
        console.error('VAPID public key not available')
        return
      }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey.publicKey),
      })

      const json = sub.toJSON()
      await apiWithTenant('/push/subscribe', slug, {
        method: 'POST',
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { auth: json.keys?.auth, p256dh: json.keys?.p256dh },
        }),
      })

      setPushSubscribed(true)
    } catch (err) {
      console.error('[Push] Subscribe error:', err)
    } finally {
      setPushLoading(false)
    }
  }, [pushSupported, slug])

  const unsubscribe = useCallback(async () => {
    if (!pushSupported || !slug) return
    setPushLoading(true)

    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await apiWithTenant('/push/unsubscribe', slug, {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
      }
      setPushSubscribed(false)
    } catch (err) {
      console.error('[Push] Unsubscribe error:', err)
    } finally {
      setPushLoading(false)
    }
  }, [pushSupported, slug])

  return { pushSupported, pushSubscribed, pushLoading, subscribe, unsubscribe }
}
