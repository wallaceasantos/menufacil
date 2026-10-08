import webpush from 'web-push'

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || ''
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || ''

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(
    'mailto:suporte@menufacil.com',
    VAPID_PUBLIC,
    VAPID_PRIVATE,
  )
}

export async function sendPushNotification(
  subscription: { endpoint: string; keys: { auth: string; p256dh: string } },
  payload: { title: string; message: string; url?: string; tag?: string },
) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload))
    return true
  } catch (err: any) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      return 'expired'
    }
    console.error('[WebPush] Error:', err.message)
    return false
  }
}
