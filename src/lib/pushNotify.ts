import { prisma } from './prisma'
import { sendPushNotification } from './webPush'

export async function notifyPush(tenantId: string, type: 'new_order' | 'order_status_changed' | 'inventory_low', data: any) {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({ where: { tenantId } })
    if (subscriptions.length === 0) return

    let title = ''
    let message = ''

    if (type === 'new_order') {
      title = 'Novo pedido!'
      message = `${data?.customerName || 'Cliente'} fez um pedido de R$ ${Number(data?.totalAmount || 0).toFixed(2).replace('.', ',')}`
    } else if (type === 'order_status_changed') {
      const labels: Record<string, string> = { pending: 'pendente', preparing: 'em preparo', completed: 'concluído', cancelled: 'cancelado' }
      title = 'Status atualizado'
      message = `Pedido #${data?.orderId?.slice(0, 8)} está ${labels[data?.status] || data?.status}`
    } else if (type === 'inventory_low') {
      title = 'Estoque baixo!'
      message = `${data?.itemName || 'Item'} está com apenas ${data?.currentStock || 0} ${data?.unit || 'un'} no estoque`
    }

    if (!title) return

    for (const sub of subscriptions) {
      const result = await sendPushNotification(
        { endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
        { title, message, url: '/dashboard/orders', tag: type },
      )
      if (result === 'expired') {
        await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
      }
    }
  } catch (err) {
    console.error('[PushNotify] Error:', err)
  }
}
