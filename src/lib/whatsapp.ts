import { prisma } from './prisma'

const STATUS_LABELS: Record<string, string> = {
  pending: 'recebido',
  preparing: 'em preparo',
  completed: 'pronto/entregue',
  cancelled: 'cancelado',
}

export async function sendWhatsAppText(tenantId: string, phone: string, text: string) {
  const config = await prisma.whatsAppConfig.findUnique({
    where: { tenantId },
  })

  if (!config || !config.connected || !config.apiUrl || !config.apiKey || !config.instanceName) {
    return { sent: false, reason: 'not_configured' }
  }

  const cleanPhone = phone.replace(/\D/g, '')
  if (!cleanPhone || cleanPhone.length < 10) {
    return { sent: false, reason: 'invalid_phone' }
  }

  try {
    const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
      },
      body: JSON.stringify({
        number: cleanPhone,
        text,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { sent: false, reason: 'api_error', details: errorData }
    }

    return { sent: true }
  } catch (err) {
    return { sent: false, reason: 'connection_error', error: err }
  }
}

export async function sendOrderStatusNotification(
  tenantId: string,
  orderId: string,
  status: string
) {
  const config = await prisma.whatsAppConfig.findUnique({
    where: { tenantId },
  })

  if (!config || !config.connected || !config.apiUrl || !config.apiKey || !config.instanceName) {
    return { sent: false, reason: 'not_configured' }
  }

  const shouldNotify =
    (status === 'pending' && config.notifyReceived) ||
    (status === 'preparing' && config.notifyPreparing) ||
    (status === 'completed' && config.notifyCompleted) ||
    (status === 'cancelled' && config.notifyCancelled)

  if (!shouldNotify) {
    return { sent: false, reason: 'notification_disabled' }
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
  })

  if (!order) {
    return { sent: false, reason: 'order_not_found' }
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  })
  const appUrl = process.env.APP_URL || 'http://localhost:3000'
  const trackingUrl = `${appUrl}/rastrear/${tenant?.slug || ''}?orderId=${order.id}`

  const phone = order.customerPhone?.replace(/\D/g, '')
  if (!phone || phone.length < 10) {
    return { sent: false, reason: 'invalid_phone' }
  }

  const template =
    config.defaultMessage || 'Olá {cliente}! Seu pedido #{pedido} foi atualizado para: {status}.'

  const message = template
    .replace(/\{cliente\}/g, order.customerName)
    .replace(/\{pedido\}/g, order.id.slice(0, 8).toUpperCase())
    .replace(/\{status\}/g, STATUS_LABELS[status] || status)

  const msgWithLink = `${message}\n\nAcompanhe seu pedido: ${trackingUrl}`

  try {
    const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: config.apiKey,
      },
      body: JSON.stringify({
        number: phone,
        text: msgWithLink,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return { sent: false, reason: 'api_error', details: errorData }
    }

    return { sent: true }
  } catch (err) {
    return { sent: false, reason: 'connection_error', error: err }
  }
}
