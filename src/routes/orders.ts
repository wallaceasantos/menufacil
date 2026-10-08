import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { sendOrderStatusNotification } from '../lib/whatsapp'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import { eventBus } from '../lib/eventBus'
import { notifyPush } from '../lib/pushNotify'
import { printOrder } from './printer'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

const VALID_STATUSES = ['pending', 'preparing', 'completed', 'cancelled']
const DEDUCT_STATUSES = ['preparing', 'completed']

function toNumber(value: any): number {
  return value === null || value === undefined ? 0 : Number(value)
}

async function calculateAverageCost(itemId: string): Promise<number> {
  const batches = await prisma.inventoryBatch.findMany({
    where: { inventoryItemId: itemId, remainingQuantity: { gt: 0 } },
  })
  if (batches.length === 0) return 0
  const totalValue = batches.reduce((acc, b) => acc + toNumber(b.remainingQuantity) * toNumber(b.unitCost), 0)
  const totalQuantity = batches.reduce((acc, b) => acc + toNumber(b.remainingQuantity), 0)
  return totalQuantity > 0 ? totalValue / totalQuantity : 0
}

async function deductFromBatches(itemId: string, quantity: number) {
  const batches = await prisma.inventoryBatch.findMany({
    where: { inventoryItemId: itemId, remainingQuantity: { gt: 0 } },
    orderBy: { createdAt: 'asc' },
  })

  let remaining = quantity
  for (const batch of batches) {
    if (remaining <= 0) break
    const deduct = Math.min(toNumber(batch.remainingQuantity), remaining)
    await prisma.inventoryBatch.update({
      where: { id: batch.id },
      data: { remainingQuantity: { decrement: deduct } },
    })
    remaining -= deduct
  }
}

async function deductInventoryItem(inventoryItemId: string, quantity: number, tenantId: string, orderId: string, reason: string) {
  const item = await prisma.inventoryItem.findFirst({
    where: { id: inventoryItemId, tenantId },
  })
  if (!item) return

  await deductFromBatches(inventoryItemId, quantity)

  const newStock = toNumber(item.currentStock) - quantity
  const averageCost = await calculateAverageCost(inventoryItemId)

  await prisma.inventoryItem.update({
    where: { id: inventoryItemId },
    data: { currentStock: newStock, averageCost },
  })

  await prisma.stockMovement.create({
    data: {
      tenantId,
      inventoryItemId,
      orderId,
      type: 'saida',
      quantity,
      reason,
    },
  })
}

async function deductStockForOrder(orderId: string, tenantId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      items: {
        include: {
          product: { include: { recipes: true } },
          orderItemComponents: true,
          orderItemChoices: true,
        },
      },
    },
  })

  if (!order || order.stockDeducted) return

  for (const item of order.items) {
    if (item.product.autoDeductStock === false) continue

    // Base recipe
    for (const recipe of item.product.recipes) {
      const qty = toNumber(recipe.quantity) * item.quantity
      await deductInventoryItem(recipe.inventoryItemId, qty, tenantId, orderId, `Pedido ${orderId.slice(0, 8)} - ${item.product.name}`)
    }

    // Selected components with deductStock
    for (const comp of item.orderItemComponents) {
      if (!comp.deductStock || !comp.inventoryItemId) continue
      const qty = toNumber(comp.quantity) * item.quantity
      await deductInventoryItem(comp.inventoryItemId, qty, tenantId, orderId, `Pedido ${orderId.slice(0, 8)} - ${comp.name}`)
    }

    // Selected choices with deductStock
    for (const choice of item.orderItemChoices) {
      if (!choice.deductStock || !choice.inventoryItemId) continue
      const qty = toNumber(choice.quantity) * item.quantity
      await deductInventoryItem(choice.inventoryItemId, qty, tenantId, orderId, `Pedido ${orderId.slice(0, 8)} - ${choice.optionName}`)
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { stockDeducted: true },
  })
}

function mapStatusToLabel(status: string): string {
  const map: Record<string, string> = {
    pending: 'Pendente',
    preparing: 'Preparando',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  }
  return map[status] || status
}

function formatOrderItem(item: any): string {
  const base = `${item.quantity}x ${item.product.name}`
  const comps = item.orderItemComponents?.map((c: any) => c.name).filter(Boolean) || []
  const choices = item.orderItemChoices?.map((ch: any) => ch.optionName).filter(Boolean) || []
  const extras = [...comps, ...choices]
  return extras.length > 0 ? `${base} (${extras.join(', ')})` : base
}

router.get('/', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { search, status, dateFrom, dateTo, page = '1', limit = '30' } = req.query as Record<string, string>

    const where: any = { tenantId: tenant.id }

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status
    }

    if (search) {
      const s = String(search)
      where.OR = [
        { customerName: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s.replace(/\D/g, '') } },
        { id: { startsWith: s } },
      ]
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`)
    }

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)

    const [orders, total, statusCounts] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          items: {
            include: {
              product: { select: { name: true } },
              orderItemComponents: true,
              orderItemChoices: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
      prisma.order.groupBy({
        by: ['status'],
        where: { tenantId: tenant.id },
        _count: { status: true },
      }),
    ])

    const counts: Record<string, number> = { pending: 0, preparing: 0, completed: 0, cancelled: 0 }
    statusCounts.forEach((g) => { counts[g.status] = g._count.status })

    const formatted = orders.map((order) => ({
      id: `#${order.id.slice(0, 8)}`,
      rawId: order.id,
      customer: order.customerName,
      phone: order.customerPhone,
      address: order.deliveryAddress || 'Retirada no Local',
      items: order.items.map((i: any) => `${i.quantity}x ${i.product?.name || 'Item'}`),
      total: `R$ ${Number(order.totalAmount).toFixed(2).replace('.', ',')}`,
      rawTotal: Number(order.totalAmount),
      status: mapStatusToLabel(order.status),
      rawStatus: order.status,
      createdAt: order.createdAt.toISOString(),
      stockDeducted: order.stockDeducted,
      paymentMethod: order.paymentMethod,
      mpPaymentStatus: order.mpPaymentStatus,
      rating: order.rating,
    }))

    res.json({ data: formatted, total, page: parseInt(page), totalPages: Math.ceil(total / take), counts })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params

    const order = await prisma.order.findFirst({
      where: { OR: [{ id }, { id: id.replace(/^#/, '') }], tenantId: tenant.id },
      include: {
        items: {
          include: {
            product: true,
            orderItemComponents: true,
            orderItemChoices: true,
          },
        },
      },
    })

    if (!order) {
      res.status(404).json({ error: 'Pedido não encontrado' })
      return
    }

    res.json({
      id: `#${order.id.slice(0, 8)}`,
      rawId: order.id,
      customer: order.customerName,
      phone: order.customerPhone,
      address: order.deliveryAddress || 'Retirada no Local',
      items: order.items.map((i: any) => ({
        productName: i.product?.name,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        notes: i.notes,
        components: i.orderItemComponents?.map((c: any) => ({ name: c.name, quantity: c.quantity, unitPrice: Number(c.unitPrice) })),
        choices: i.orderItemChoices?.map((ch: any) => ({ groupName: ch.choiceGroupName, optionName: ch.optionName, quantity: ch.quantity, unitPrice: Number(ch.unitPrice) })),
      })),
      total: `R$ ${Number(order.totalAmount).toFixed(2).replace('.', ',')}`,
      rawTotal: Number(order.totalAmount),
      status: mapStatusToLabel(order.status),
      rawStatus: order.status,
      paymentMethod: order.paymentMethod,
      mpPaymentStatus: order.mpPaymentStatus,
      rating: order.rating,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      stockDeducted: order.stockDeducted,
    })
  } catch (err) {
    next(err)
  }
})

router.patch('/:id/status', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params
    const { status } = req.body

    if (!VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: 'Status inválido' })
      return
    }

    const order = await prisma.order.update({
      where: { id, tenantId: tenant.id },
      data: { status },
    })

    if (DEDUCT_STATUSES.includes(status)) {
      await deductStockForOrder(id, tenant.id)
    }

    eventBus.emit(tenant.id, 'order_status_changed', {
      orderId: id,
      status,
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount),
    })

    // Envia notificação pelo WhatsApp de forma assíncrona (não bloqueia a resposta)
    sendOrderStatusNotification(tenant.id, id, status).catch(() => {})

    res.json(order)

    printOrder(tenant.id, id, 'status_update').catch(() => {})
    notifyPush(tenant.id, 'order_status_changed', { orderId: id, status }).catch(() => {})
  } catch (err) {
    next(err)
  }
})

router.patch('/bulk-status', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { ids, status } = req.body

    if (!Array.isArray(ids) || ids.length === 0 || !VALID_STATUSES.includes(status)) {
      res.status(400).json({ error: 'IDs e status são obrigatórios' })
      return
    }

    const result = await prisma.order.updateMany({
      where: { id: { in: ids }, tenantId: tenant.id },
      data: { status },
    })

    if (DEDUCT_STATUSES.includes(status)) {
      for (const id of ids) {
        await deductStockForOrder(id, tenant.id)
      }
    }

    for (const id of ids) {
      sendOrderStatusNotification(tenant.id, id, status).catch(() => {})
    }

    res.json({ updated: result.count })
  } catch (err) {
    next(err)
  }
})

export default router
