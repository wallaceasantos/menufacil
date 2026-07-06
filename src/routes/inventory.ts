import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import { eventBus } from '../lib/eventBus'
import { notifyPush } from '../lib/pushNotify'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

function toNumber(value: any): number {
  return value === null || value === undefined ? 0 : Number(value)
}

function mapItem(item: any) {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    currentStock: toNumber(item.currentStock),
    minStock: toNumber(item.minStock),
    cost: toNumber(item.referenceCost),
    averageCost: toNumber(item.averageCost),
    markup: toNumber(item.markup),
  }
}

function mapBatch(batch: any) {
  return {
    id: batch.id,
    inventoryItemId: batch.inventoryItemId,
    quantity: toNumber(batch.quantity),
    remainingQuantity: toNumber(batch.remainingQuantity),
    unitCost: toNumber(batch.unitCost),
    expirationDate: batch.expirationDate ? batch.expirationDate.toISOString().split('T')[0] : undefined,
    manufacturingDate: batch.manufacturingDate ? batch.manufacturingDate.toISOString().split('T')[0] : undefined,
    supplierId: batch.supplierId || undefined,
    purchaseOrderId: batch.purchaseOrderId || undefined,
    createdAt: batch.createdAt.toISOString(),
  }
}

function mapMovement(movement: any) {
  return {
    id: movement.id,
    inventoryItemId: movement.inventoryItemId,
    type: movement.type,
    quantity: toNumber(movement.quantity),
    reason: movement.reason || '',
    createdAt: movement.createdAt.toISOString(),
    orderId: movement.orderId || undefined,
    batchId: movement.inventoryBatchId || undefined,
  }
}

function mapSupplier(supplier: any) {
  return {
    id: supplier.id,
    name: supplier.name,
    phone: supplier.phone || undefined,
    email: supplier.email || undefined,
    address: supplier.address || undefined,
  }
}

function mapPurchaseOrder(order: any) {
  return {
    id: order.id,
    supplierId: order.supplierId || '',
    status: order.status === 'received' ? 'recebido' : order.status === 'cancelled' ? 'cancelado' : 'pendente',
    totalCost: toNumber(order.totalCost),
    notes: order.notes || undefined,
    createdAt: order.createdAt.toISOString(),
    receivedAt: order.receivedAt ? order.receivedAt.toISOString() : undefined,
    items: order.items.map((it: any) => ({
      inventoryItemId: it.inventoryItemId,
      quantity: toNumber(it.quantity),
      unitCost: toNumber(it.unitCost),
      expirationDate: it.expirationDate ? it.expirationDate.toISOString().split('T')[0] : undefined,
      manufacturingDate: it.manufacturingDate ? it.manufacturingDate.toISOString().split('T')[0] : undefined,
    })),
  }
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

async function deductFromBatches(itemId: string, quantity: number, movementId: string, tenantId: string) {
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

router.get('/', async (req, res, next) => {
  try {
    const tenant = req.tenant!

    const [items, batches, movements, suppliers, purchaseOrders, recipes] = await Promise.all([
      prisma.inventoryItem.findMany({ where: { tenantId: tenant.id } }),
      prisma.inventoryBatch.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.stockMovement.findMany({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.supplier.findMany({ where: { tenantId: tenant.id } }),
      prisma.purchaseOrder.findMany({
        where: { tenantId: tenant.id },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.productRecipe.findMany({
        where: { product: { tenantId: tenant.id } },
        include: { product: { select: { id: true, name: true, autoDeductStock: true } } },
      }),
    ])

    const recipesByProduct: Record<string, { productId: string; ingredients: any[]; autoDeduct: boolean }> = {}
    recipes.forEach((r) => {
      if (!recipesByProduct[r.productId]) {
        recipesByProduct[r.productId] = {
          productId: r.productId,
          ingredients: [],
          autoDeduct: r.product.autoDeductStock ?? true,
        }
      }
      recipesByProduct[r.productId].ingredients.push({
        inventoryItemId: r.inventoryItemId,
        quantity: toNumber(r.quantity),
      })
    })

    res.json({
      items: items.map(mapItem),
      batches: batches.map(mapBatch),
      movements: movements.map(mapMovement),
      suppliers: suppliers.map(mapSupplier),
      purchaseOrders: purchaseOrders.map(mapPurchaseOrder),
      recipes: Object.values(recipesByProduct),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/alerts', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const items = await prisma.inventoryItem.findMany({
      where: { tenantId: tenant.id },
    })
    const lowStock = items.filter((i) => toNumber(i.currentStock) > 0 && toNumber(i.currentStock) <= toNumber(i.minStock))
    const outOfStock = items.filter((i) => toNumber(i.currentStock) <= 0)
    res.json({
      count: lowStock.length + outOfStock.length,
      lowStock: lowStock.map(mapItem),
      outOfStock: outOfStock.map(mapItem),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/items', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { name, unit, currentStock, minStock, cost, averageCost, markup } = req.body

    const item = await prisma.inventoryItem.create({
      data: {
        tenantId: tenant.id,
        name,
        unit: unit || 'un',
        currentStock: currentStock || 0,
        minStock: minStock || 0,
        referenceCost: cost || 0,
        averageCost: averageCost || 0,
        markup: markup || 2.5,
      },
    })

    res.status(201).json(mapItem(item))
  } catch (err) {
    next(err)
  }
})

router.patch('/items/:id', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params
    const { name, unit, currentStock, minStock, cost, averageCost, markup } = req.body

    const item = await prisma.inventoryItem.update({
      where: { id, tenantId: tenant.id },
      data: {
        name,
        unit,
        currentStock,
        minStock,
        referenceCost: cost,
        averageCost,
        markup,
      },
    })

    res.json(mapItem(item))
  } catch (err) {
    next(err)
  }
})

router.delete('/items/:id', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params
    await prisma.inventoryItem.delete({ where: { id, tenantId: tenant.id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.post('/movements', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { inventoryItemId, type, quantity, reason } = req.body

    if (!inventoryItemId || !type || quantity === undefined) {
      res.status(400).json({ error: 'Dados incompletos' })
      return
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id: inventoryItemId, tenantId: tenant.id },
    })
    if (!item) {
      res.status(404).json({ error: 'Insumo não encontrado' })
      return
    }

    let newStock = toNumber(item.currentStock)

    if (type === 'entrada') {
      newStock += quantity
    } else if (type === 'saida' || type === 'perda') {
      newStock -= quantity
      await deductFromBatches(inventoryItemId, quantity, '', tenant.id)
    } else if (type === 'ajuste') {
      newStock = quantity
    }

    const [movement] = await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          tenantId: tenant.id,
          inventoryItemId,
          type,
          quantity,
          reason: reason || '',
        },
      }),
      prisma.inventoryItem.update({
        where: { id: inventoryItemId },
        data: {
          currentStock: newStock,
          averageCost: await calculateAverageCost(inventoryItemId),
        },
      }),
    ])

    res.status(201).json(mapMovement(movement))

    // Check and emit inventory low alert
    const lowItem = await prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { name: true, unit: true, currentStock: true, minStock: true } })
    if (lowItem && Number(lowItem.currentStock) <= Number(lowItem.minStock) && Number(lowItem.minStock) > 0) {
      eventBus.emit(tenant.id, 'inventory_low', {
        itemId: inventoryItemId,
        itemName: lowItem.name,
        currentStock: Number(lowItem.currentStock),
        minStock: Number(lowItem.minStock),
        unit: lowItem.unit,
      })
      notifyPush(tenant.id, 'inventory_low', {
        itemName: lowItem.name,
        currentStock: Number(lowItem.currentStock),
        unit: lowItem.unit,
      }).catch(() => {})
    }
  } catch (err) {
    next(err)
  }
})

router.post('/suppliers', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id, name, phone, email, address } = req.body

    const supplier = id
      ? await prisma.supplier.update({
          where: { id, tenantId: tenant.id },
          data: { name, phone, email, address },
        })
      : await prisma.supplier.create({
          data: {
            tenantId: tenant.id,
            name,
            phone,
            email,
            address,
          },
        })

    res.status(id ? 200 : 201).json(mapSupplier(supplier))
  } catch (err) {
    next(err)
  }
})

router.delete('/suppliers/:id', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params
    await prisma.supplier.delete({ where: { id, tenantId: tenant.id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.post('/purchase-orders', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id, supplierId, notes, items: orderItems, status, receivedAt } = req.body

    if (!supplierId || !orderItems || orderItems.length === 0) {
      res.status(400).json({ error: 'Fornecedor e itens são obrigatórios' })
      return
    }

    const totalCost = orderItems.reduce((acc: number, it: any) => acc + toNumber(it.quantity) * toNumber(it.unitCost), 0)

    const order = id
      ? await prisma.purchaseOrder.update({
          where: { id, tenantId: tenant.id },
          data: {
            supplierId,
            notes,
            totalCost,
            status: status === 'recebido' ? 'received' : status === 'cancelado' ? 'cancelled' : 'pending',
            receivedAt: receivedAt ? new Date(receivedAt) : null,
            items: {
              deleteMany: {},
              create: orderItems.map((it: any) => ({
                inventoryItemId: it.inventoryItemId,
                quantity: it.quantity,
                unitCost: it.unitCost,
                expirationDate: it.expirationDate ? new Date(it.expirationDate) : null,
                manufacturingDate: it.manufacturingDate ? new Date(it.manufacturingDate) : null,
              })),
            },
          },
          include: { items: true },
        })
      : await prisma.purchaseOrder.create({
          data: {
            tenantId: tenant.id,
            supplierId,
            notes,
            totalCost,
            status: 'pending',
            items: {
              create: orderItems.map((it: any) => ({
                inventoryItemId: it.inventoryItemId,
                quantity: it.quantity,
                unitCost: it.unitCost,
                expirationDate: it.expirationDate ? new Date(it.expirationDate) : null,
                manufacturingDate: it.manufacturingDate ? new Date(it.manufacturingDate) : null,
              })),
            },
          },
          include: { items: true },
        })

    res.status(id ? 200 : 201).json(mapPurchaseOrder(order))
  } catch (err) {
    next(err)
  }
})

router.delete('/purchase-orders/:id', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params
    await prisma.purchaseOrder.delete({ where: { id, tenantId: tenant.id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.post('/purchase-orders/:id/receive', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params

    const order = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId: tenant.id },
      include: { items: true },
    })

    if (!order) {
      res.status(404).json({ error: 'Compra não encontrada' })
      return
    }

    if (order.status !== 'pending') {
      res.status(400).json({ error: 'Compra já foi processada' })
      return
    }

    for (const poItem of order.items) {
      const item = await prisma.inventoryItem.findFirst({
        where: { id: poItem.inventoryItemId, tenantId: tenant.id },
      })
      if (!item) continue

      const batch = await prisma.inventoryBatch.create({
        data: {
          tenantId: tenant.id,
          inventoryItemId: poItem.inventoryItemId,
          purchaseOrderId: order.id,
          supplierId: order.supplierId,
          quantity: poItem.quantity,
          remainingQuantity: poItem.quantity,
          unitCost: poItem.unitCost,
          expirationDate: poItem.expirationDate,
          manufacturingDate: poItem.manufacturingDate,
        },
      })

      const newStock = toNumber(item.currentStock) + toNumber(poItem.quantity)
      await prisma.inventoryItem.update({
        where: { id: item.id },
        data: {
          currentStock: newStock,
          averageCost: await calculateAverageCost(item.id),
        },
      })

      await prisma.stockMovement.create({
        data: {
          tenantId: tenant.id,
          inventoryItemId: item.id,
          inventoryBatchId: batch.id,
          type: 'entrada',
          quantity: toNumber(poItem.quantity),
          reason: `Recebimento da compra ${order.id.slice(0, 8)}`,
        },
      })
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'received', receivedAt: new Date() },
      include: { items: true },
    })

    res.json(mapPurchaseOrder(updated))
  } catch (err) {
    next(err)
  }
})

export default router
