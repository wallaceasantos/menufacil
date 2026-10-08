import { logger, errorMeta } from './logger'

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL || ''

const recentAlerts = new Map<string, number>()
const ALERT_THROTTLE_MS = 5 * 60 * 1000

export async function sendAlert(
  source: string,
  message: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const key = `${source}:${message}`
  const now = Date.now()

  for (const [k, ts] of recentAlerts) {
    if (now - ts > ALERT_THROTTLE_MS) recentAlerts.delete(k)
  }

  const last = recentAlerts.get(key)
  if (last && now - last < ALERT_THROTTLE_MS) return
  recentAlerts.set(key, now)

  logger.error(`[ALERT] ${source}: ${message}`, meta)

  if (!ALERT_WEBHOOK_URL) return

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source,
        message,
        meta,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch (err) {
    logger.warn('Falha ao enviar alerta externo', errorMeta(err))
  }
}