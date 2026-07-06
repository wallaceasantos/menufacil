import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { calculateItemPrice, validateChoices, validateComponents } from '../lib/menuValidation'
import { upsertCustomerFromOrder } from './customers'
import { calculateDeliveryFee } from './deliveryZones'
import { eventBus } from '../lib/eventBus'
import { notifyPush } from '../lib/pushNotify'
import { printOrder } from './printer'
import * as mp from '../lib/mercadopago'
import { validateDiscount } from './discounts'

const router = Router()

function toNumber(value: any): number {
  return value === null || value === undefined ? 0 : Number(value)
}

function mapRecipe(r: any) {
  return { inventoryItemId: r.inventoryItemId, quantity: toNumber(r.quantity) }
}

function mapOption(o: any) {
  return {
    id: o.id,
    name: o.name,
    inventoryItemId: o.inventoryItemId || null,
    quantity: toNumber(o.quantity),
    price: toNumber(o.price),
    includedInPrice: o.includedInPrice ?? false,
    deductStock: o.deductStock ?? true,
    isDefault: o.isDefault ?? false,
  }
}

function mapGroup(g: any) {
  return {
    id: g.id,
    name: g.name,
    minChoices: g.minChoices ?? 0,
    maxChoices: g.maxChoices ?? 1,
    required: g.required ?? false,
    options: (g.options || []).map(mapOption),
  }
}

function mapComponent(c: any) {
  return {
    id: c.id,
    name: c.name,
    inventoryItemId: c.inventoryItemId || null,
    quantity: toNumber(c.quantity),
    price: toNumber(c.price),
    includedInPrice: c.includedInPrice ?? true,
    deductStock: c.deductStock ?? true,
    isDefault: c.isDefault ?? true,
  }
}

router.post('/:slug/rate', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { id: true } })
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const { orderId, rating, comment } = req.body
    if (!orderId || !rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Pedido e avaliação (1-5) são obrigatórios' })
      return
    }

    const order = await prisma.order.findFirst({ where: { id: orderId, tenantId: tenant.id } })
    if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return }

    if (order.rating) { res.status(400).json({ error: 'Pedido já foi avaliado' }); return }

    await prisma.order.update({
      where: { id: orderId },
      data: { rating: Number(rating), ratingComment: comment || null, ratedAt: new Date() },
    })

    res.json({ success: true, rating: Number(rating), message: 'Avaliação registrada!' })
  } catch (err) { next(err) }
})

router.post('/:slug/delivery-fee', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true },
    })
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { address, cep } = req.body
    const result = await calculateDeliveryFee(tenant.id, address || '', cep || '')

    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/:slug', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        deliveryFee: true,
        minOrder: true,
        openingHours: true,
        closingHours: true,
        logoUrl: true,
        bannerUrl: true,
        latitude: true,
        longitude: true,
      },
    })

    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const paymentConfig = await prisma.paymentConfig.findUnique({
      where: { tenantId: tenant.id },
    })

    const ratingStats = await prisma.order.groupBy({
      by: ['tenantId'],
      where: { tenantId: tenant.id, rating: { not: null } },
      _avg: { rating: true },
      _count: { rating: true },
    })

    const zones = await prisma.deliveryZone.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        name: true,
        zoneType: true,
        fee: true,
        estimatedTime: true,
        minOrder: true,
        radiusKm: true,
        neighborhoodList: true,
        cepList: true,
        priority: true,
      },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    })

    res.json({
      ...tenant,
      paymentMethods: {
        pix: paymentConfig?.pixEnabled ?? false,
        pixKey: paymentConfig?.pixKey || undefined,
        pixKeyType: paymentConfig?.pixKeyType || 'cpf',
        pixBeneficiary: paymentConfig?.pixBeneficiary || undefined,
        pixBank: paymentConfig?.pixBank || undefined,
        pixOnDelivery: paymentConfig?.pixOnDelivery ?? false,
        pixInstructions: paymentConfig?.instructions || undefined,
        cash: paymentConfig?.cashEnabled ?? true,
        card: paymentConfig?.cardEnabled ?? true,
      },
      deliveryZones: zones,
      ratingAvg: ratingStats[0]?._avg?.rating
        ? Math.round(Number(ratingStats[0]._avg.rating) * 10) / 10
        : null,
      ratingCount: ratingStats[0]?._count?.rating || 0,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/:slug/produtos', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      include: {
        categories: {
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              where: { isActive: true },
              orderBy: { name: 'asc' },
              include: {
                productComponents: { orderBy: { sortOrder: 'asc' } },
                productChoiceGroups: {
                  orderBy: { sortOrder: 'asc' },
                  include: { options: { orderBy: { sortOrder: 'asc' } } },
                },
                recipes: true,
              },
            },
          },
        },
      },
    })

    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    // Time-based filtering: only show categories active at current time
    const now = req.query.now as string || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })
    const currentTime = now.replace(/[^0-9:]/g, '').substring(0, 5)

    function isCategoryActive(cat: any): boolean {
      if (!cat.startTime && !cat.endTime) return true
      if (cat.startTime && cat.endTime) {
        if (cat.startTime <= cat.endTime) {
          return currentTime >= cat.startTime && currentTime <= cat.endTime
        } else {
          // Overnight schedule (e.g., 22:00-02:00)
          return currentTime >= cat.startTime || currentTime <= cat.endTime
        }
      }
      if (cat.startTime) return currentTime >= cat.startTime
      if (cat.endTime) return currentTime <= cat.endTime
      return true
    }

    const categories = tenant.categories
      .filter((c) => isCategoryActive(c))
      .map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        startTime: category.startTime,
        endTime: category.endTime,
        products: category.products.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description || '',
        price: toNumber(product.price),
        image: product.imageUrl || undefined,
        productType: product.productType || 'simple',
        autoDeductStock: product.autoDeductStock ?? true,
        recipe: (product.recipes || []).map(mapRecipe),
        components: (product.productComponents || []).map(mapComponent),
        choiceGroups: (product.productChoiceGroups || []).map(mapGroup),
      })),
    }))

    res.json(categories)
  } catch (err) {
    next(err)
  }
})

router.post('/:slug/orders', async (req, res, next) => {
  try {
    const { slug } = req.params
    const {
      customerName,
      customerPhone,
      deliveryAddress,
      paymentMethod,
      items,
      totalAmount,
    } = req.body

    if (!customerName || !customerPhone || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Nome, telefone e itens são obrigatórios' })
      return
    }

    const tenant = await prisma.tenant.findUnique({ where: { slug } })
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const productIds = items.map((item: any) => item.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, tenantId: tenant.id, isActive: true },
      include: {
        productComponents: true,
        productChoiceGroups: { include: { options: true } },
      },
    })

    const productById = new Map(products.map((p) => [p.id, p]))

    let calculatedTotal = 0
    const itemCreates: any[] = []

    for (const item of items) {
      const product = productById.get(item.productId)
      if (!product) {
        res.status(400).json({ error: `Produto não encontrado: ${item.productId}` })
        return
      }

      const components = (item.components || []).map((c: any) => ({
        componentId: c.componentId,
        name: c.name,
        quantity: Number(c.quantity || 1),
        unitPrice: toNumber(c.unitPrice),
        inventoryItemId: c.inventoryItemId || null,
        deductStock: c.deductStock ?? true,
      }))

      const choices = (item.choices || []).map((ch: any) => ({
        choiceGroupId: ch.choiceGroupId,
        choiceGroupName: ch.choiceGroupName,
        optionId: ch.optionId,
        optionName: ch.optionName,
        quantity: Number(ch.quantity || 1),
        unitPrice: toNumber(ch.unitPrice),
        inventoryItemId: ch.inventoryItemId || null,
        deductStock: ch.deductStock ?? true,
      }))

      const config = {
        id: product.id,
        price: toNumber(product.price),
        productType: product.productType || 'simple',
        components: product.productComponents.map(mapComponent),
        choiceGroups: product.productChoiceGroups.map(mapGroup),
      }

      const componentError = validateComponents(config, components)
      if (componentError) {
        res.status(400).json({ error: componentError })
        return
      }

      const choiceError = validateChoices(config, choices)
      if (choiceError) {
        res.status(400).json({ error: choiceError })
        return
      }

      const expectedPrice = calculateItemPrice(config, components, choices)
      const submittedUnitPrice = toNumber(item.unitPrice)
      if (Math.abs(submittedUnitPrice - expectedPrice) > 0.02) {
        res.status(400).json({ error: `Preço do item ${product.name} não confere` })
        return
      }

      calculatedTotal += expectedPrice * Number(item.quantity || 1)

      itemCreates.push({
        productId: item.productId,
        quantity: Number(item.quantity || 1),
        unitPrice: submittedUnitPrice,
        notes: item.notes || null,
        orderItemComponents: { create: components },
        orderItemChoices: { create: choices },
      })
    }

    const orderTotal = totalAmount ? Number(totalAmount) : calculatedTotal

    const order = await prisma.order.create({
      data: {
        tenantId: tenant.id,
        customerName,
        customerPhone,
        deliveryAddress: deliveryAddress || null,
        paymentMethod: paymentMethod || null,
        totalAmount: orderTotal,
        items: { create: itemCreates },
      },
      include: {
        items: { include: { orderItemComponents: true, orderItemChoices: true } },
      },
    })

    eventBus.emit(tenant.id, 'new_order', {
      orderId: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      totalAmount: Number(order.totalAmount),
      paymentMethod: order.paymentMethod,
      itemsCount: order.items.length,
      createdAt: order.createdAt,
    })

    // Generate PIX payment if method is PIX
    let pixData: any = null
    const LOCAL_MODE = process.env.MP_LOCAL_MODE === 'true'
    const WEBHOOK_URL = process.env.MP_WEBHOOK_URL || ''

    if (paymentMethod && paymentMethod.toLowerCase() === 'pix') {
      try {
        if (LOCAL_MODE) {
          const fakeId = `local_pix_order_${Date.now()}`
          const fakePayload = `00020126580014br.gov.bcb.pix0136${fakeId}5204000053039865405${orderTotal.toFixed(2).replace('.', '')}5802BR5914MenuFacil6009SaoPaulo62070503***6304A1B2`
          pixData = {
            paymentId: fakeId,
            encodedImage: '',
            payload: fakePayload,
            status: 'pending',
          }
          await prisma.order.update({
            where: { id: order.id },
            data: {
              mpPaymentId: fakeId,
              mpPaymentStatus: 'pending',
              mpPixPayload: fakePayload,
              mpPixQrCode: '',
            },
          })
        } else {
          const nameParts = tenant.name.split(' ')
          const payment = await mp.createPayment({
            transaction_amount: orderTotal,
            description: `Pedido MenuFácil - ${order.id.slice(0, 8)}`,
            payment_method_id: 'pix',
            payer: {
              email: tenant.email,
              first_name: nameParts[0] || tenant.name,
              last_name: nameParts.slice(1).join(' ') || undefined,
            },
            external_reference: order.id,
            notification_url: WEBHOOK_URL ? `${WEBHOOK_URL}/api/mp/webhook` : undefined,
          })
          const txData = payment.point_of_interaction?.transaction_data
          pixData = {
            paymentId: String(payment.id),
            encodedImage: txData?.qr_code_base64 || '',
            payload: txData?.qr_code || '',
            ticketUrl: txData?.ticket_url || '',
            status: payment.status,
          }
          await prisma.order.update({
            where: { id: order.id },
            data: {
              mpPaymentId: String(payment.id),
              mpPaymentStatus: payment.status,
              mpPixPayload: txData?.qr_code || '',
              mpPixQrCode: txData?.qr_code_base64 || '',
            },
          })
        }
      } catch (err) {
        console.error('[PIX] Failed to generate PIX for order:', err)
      }
    }

    res.status(201).json({
      ...order,
      trackingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/rastrear/${slug}?orderId=${order.id}`,
      pixData,
    })

    printOrder(tenant.id, order.id, 'new_order').catch(() => {})
    notifyPush(tenant.id, 'new_order', {
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount),
    }).catch(() => {})

    upsertCustomerFromOrder({
      tenantId: tenant.id,
      name: customerName,
      phone: customerPhone,
      amount: orderTotal,
      orderId: order.id,
    }).catch(() => {})
  } catch (err) {
    next(err)
  }
})

router.post('/:slug/validate-coupon', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { id: true } })
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const { code, orderTotal } = req.body
    if (!code) { res.status(400).json({ error: 'Código do cupom é obrigatório' }); return }

    const result = await validateDiscount(tenant.id, code, Number(orderTotal) || 0)
    res.json(result)
  } catch (err) { next(err) }
})

router.post('/:slug/track', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { id: true, name: true, phone: true } })
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const { phone, orderId } = req.body
    if (!phone) { res.status(400).json({ error: 'Telefone é obrigatório' }); return }

    const cleanPhone = phone.replace(/\D/g, '')

    const cleanOrderId = orderId ? orderId.replace(/^#/, '').trim() : null

    const where: any = { tenantId: tenant.id }
    if (cleanOrderId) {
      where.id = { startsWith: cleanOrderId }
    }

    const orders = await prisma.order.findMany({
      where: {
        ...where,
        customerPhone: { contains: cleanPhone.slice(-8) },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        customerName: true,
        status: true,
        totalAmount: true,
        paymentMethod: true,
        deliveryAddress: true,
        createdAt: true,
        items: {
          select: {
            quantity: true,
            unitPrice: true,
            product: { select: { name: true } },
          },
        },
      },
    })

    if (orders.length === 0) {
      res.status(404).json({ error: 'Nenhum pedido encontrado para este telefone' })
      return
    }

    res.json({
      storeName: tenant.name,
      storePhone: tenant.phone,
      orders: orders.map((o) => ({
        id: o.id,
        shortId: `#${o.id.slice(0, 8)}`,
        customerName: o.customerName,
        status: o.status,
        total: Number(o.totalAmount),
        paymentMethod: o.paymentMethod || 'Não informado',
        deliveryAddress: o.deliveryAddress || 'Retirada no Local',
        itemsSummary: o.items.map((i) => `${i.quantity}x ${i.product?.name}`).join(', '),
        createdAt: o.createdAt,
      })),
    })
  } catch (err) { next(err) }
})

router.get('/:slug/track/:orderId', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      select: { id: true, name: true, phone: true, logoUrl: true, bannerUrl: true },
    })
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const order = await prisma.order.findFirst({
      where: { tenantId: tenant.id, id: req.params.orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            orderItemComponents: true,
            orderItemChoices: true,
          },
        },
      },
    })

    if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return }

    res.json({
      id: order.id,
      shortId: `#${order.id.slice(0, 8)}`,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,
      total: Number(order.totalAmount),
      paymentMethod: order.paymentMethod || 'Não informado',
      deliveryAddress: order.deliveryAddress || 'Retirada no Local',
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((i) => ({
        name: i.product?.name || 'Produto',
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        notes: i.notes,
        components: i.orderItemComponents.map((c) => ({ name: c.name, quantity: c.quantity })),
        choices: i.orderItemChoices.map((ch) => ({ group: ch.choiceGroupName, option: ch.optionName })),
      })),
      storeName: tenant.name,
      storePhone: tenant.phone,
      storeLogo: tenant.logoUrl || null,
      storeBanner: tenant.bannerUrl || null,
      storeSlug: req.params.slug,
      rating: order.rating || null,
      ratingComment: order.ratingComment || null,
      pixPayload: order.mpPixPayload || null,
      pixQrCode: order.mpPixQrCode || null,
      mpPaymentStatus: order.mpPaymentStatus || null,
    })
  } catch (err) { next(err) }
})

router.get('/:slug/track/:orderId/stream', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: req.params.slug }, select: { id: true } })
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const orderId = req.params.orderId
    const order = await prisma.order.findFirst({ where: { tenantId: tenant.id, id: orderId } })
    if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    res.write(`event: connected\ndata: ${JSON.stringify({ orderId, status: order.status })}\n\n`)

    const unsubscribe = eventBus.subscribe(tenant.id, (event) => {
      if (event.type === 'order_status_changed' && event.data?.orderId === orderId) {
        try {
          res.write(`event: status_update\ndata: ${JSON.stringify({ status: event.data.status, orderId })}\n\n`)
        } catch {}
      }
    })

    const heartbeat = setInterval(() => { try { res.write(`: heartbeat ${Date.now()}\n\n`) } catch {} }, 25000)

    const cleanup = () => { clearInterval(heartbeat); unsubscribe(); try { res.end() } catch {} }
    req.on('close', cleanup)
    req.on('error', cleanup)
    res.on('close', cleanup)
  } catch (err) { next(err) }
})

router.post('/:slug/pix/simulate', async (req, res, next) => {
  try {
    const { orderId } = req.body
    if (!orderId) { res.status(400).json({ error: 'orderId é obrigatório' }); return }

    const order = await prisma.order.findFirst({
      where: { id: orderId },
    })
    if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return }

    if (!process.env.MP_LOCAL_MODE || process.env.MP_LOCAL_MODE !== 'true') {
      res.status(400).json({ error: 'Simulação disponível apenas em modo local' }); return
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { mpPaymentStatus: 'approved' },
    })

    res.json({ status: 'approved', message: 'Pagamento PIX simulado com sucesso!' })
  } catch (err) { next(err) }
})

router.get('/:slug/orders/:orderId/pix-status', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.orderId },
      select: { mpPaymentStatus: true, mpPixPayload: true, mpPixQrCode: true, mpPaymentId: true },
    })
    if (!order) { res.status(404).json({ error: 'Pedido não encontrado' }); return }
    res.json({
      status: order.mpPaymentStatus || 'unknown',
      paymentId: order.mpPaymentId,
      pixPayload: order.mpPixPayload,
      pixQrCode: order.mpPixQrCode,
    })
  } catch (err) { next(err) }
})

export default router
