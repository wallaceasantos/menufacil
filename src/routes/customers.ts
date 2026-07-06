import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

function mapCustomer(c: any) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email || null,
    notes: c.notes || null,
    totalOrders: c.totalOrders,
    totalSpent: Number(c.totalSpent),
    isBlocked: c.isBlocked,
    isVip: c.isVip,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

function mapOrder(o: any) {
  return {
    id: o.id,
    customerName: o.customerName,
    status: o.status,
    totalAmount: Number(o.totalAmount),
    paymentMethod: o.paymentMethod,
    createdAt: o.createdAt.toISOString(),
    items: o.items?.map((i: any) => ({
      productName: i.product?.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
    })),
  }
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant!
    const { search, page = '1', limit = '50' } = req.query as Record<string, string>
    const skip = (parseInt(page) - 1) * parseInt(limit)
    const take = parseInt(limit)
    const isBasic = tenant.plan === 'basico'

    const where: any = { tenantId: tenant.id }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search.replace(/\D/g, '') } },
      ]
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { totalOrders: 'desc' },
        skip,
        take: Math.min(take, isBasic ? 50 : 500),
      }),
      prisma.customer.count({ where }),
    ])

    res.json({
      data: customers.map(mapCustomer),
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / take),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant!
    const [total, vipCount, blockedCount, topCustomers] = await Promise.all([
      prisma.customer.count({ where: { tenantId: tenant.id } }),
      prisma.customer.count({ where: { tenantId: tenant.id, isVip: true } }),
      prisma.customer.count({ where: { tenantId: tenant.id, isBlocked: true } }),
      prisma.customer.findMany({
        where: { tenantId: tenant.id },
        orderBy: { totalSpent: 'desc' },
        take: 5,
      }),
    ])

    const totalSpent = await prisma.customer.aggregate({
      where: { tenantId: tenant.id },
      _sum: { totalSpent: true },
    })

    res.json({
      total,
      vipCount,
      blockedCount,
      totalSpent: Number(totalSpent._sum.totalSpent || 0),
      topCustomers: topCustomers.map((c) => ({
        id: c.id,
        name: c.name,
        totalOrders: c.totalOrders,
        totalSpent: Number(c.totalSpent),
      })),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant!
    const { q, phone } = req.query as Record<string, string>

    const where: any = { tenantId: tenant.id }
    if (phone) where.phone = phone.replace(/\D/g, '')
    else if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q.replace(/\D/g, '') } },
      ]
    }

    const customers = await prisma.customer.findMany({
      where,
      take: 10,
      orderBy: { totalOrders: 'desc' },
    })

    res.json(customers.map(mapCustomer))
  } catch (err) {
    next(err)
  }
})

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: tenant.id },
    })

    if (!customer) {
      res.status(404).json({ error: 'Cliente não encontrado' })
      return
    }

    res.json(mapCustomer(customer))
  } catch (err) {
    next(err)
  }
})

router.get('/:id/orders', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params

    const orders = await prisma.order.findMany({
      where: { customerId: id, tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: { select: { name: true } } } } },
    })

    res.json(orders.map(mapOrder))
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params
    const { name, email, notes, isVip, isBlocked, phone } = req.body

    if (tenant.plan === 'basico') {
      res.status(403).json({ error: 'Funcionalidade exclusiva do plano Completo' })
      return
    }

    const data: any = {}
    if (name !== undefined) data.name = name
    if (email !== undefined) data.email = email
    if (notes !== undefined) data.notes = notes
    if (isVip !== undefined) data.isVip = isVip
    if (isBlocked !== undefined) data.isBlocked = isBlocked
    if (phone !== undefined) data.phone = phone?.replace(/\D/g, '')

    const customer = await prisma.customer.update({
      where: { id, tenantId: tenant.id },
      data,
    })

    res.json(mapCustomer(customer))
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params

    await prisma.customer.delete({ where: { id, tenantId: tenant.id } })

    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export async function upsertCustomerFromOrder(params: {
  tenantId: string
  name: string
  phone: string
  amount: number
  orderId: string
}) {
  const { tenantId, name, phone, amount, orderId } = params
  const cleanPhone = phone.replace(/\D/g, '')

  if (!cleanPhone) return

  const customer = await prisma.customer.upsert({
    where: { tenantId_phone: { tenantId, phone: cleanPhone } },
    create: {
      tenantId,
      name,
      phone: cleanPhone,
      totalOrders: 1,
      totalSpent: amount,
    },
    update: {
      name,
      totalOrders: { increment: 1 },
      totalSpent: { increment: amount },
    },
  })

  await prisma.order.update({
    where: { id: orderId },
    data: { customerId: customer.id },
  })
}

export default router
