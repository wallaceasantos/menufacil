import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { PLANS } from '../data/plans'
import { authenticate, requireAdmin } from '../middleware/auth'
import { hashPassword } from '../utils/password'

const router = Router()

router.use(authenticate)
router.use(requireAdmin)

function mapTenant(tenant: any) {
  return {
    id: tenant.id,
    name: tenant.name,
    type: tenant.type,
    email: tenant.email,
    plan: tenant.plan,
    status: tenant.status,
    paymentStatus: tenant.paymentStatus,
    overdueDays: tenant.overdueDays || 0,
    createdAt: tenant.createdAt.toISOString(),
  }
}

router.get('/tenants', async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } })
    res.json(tenants.map(mapTenant))
  } catch (err) {
    next(err)
  }
})

router.patch('/tenants/:id/status', async (req, res, next) => {
  try {
    const { id } = req.params
    const tenant = await prisma.tenant.findUnique({ where: { id } })
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }
    const newStatus = tenant.status === 'active' ? 'inactive' : 'active'
    const updated = await prisma.tenant.update({
      where: { id },
      data: { status: newStatus },
    })
    res.json(mapTenant(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/tenants/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.tenant.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.get('/finance', async (req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany()
    const completeCount = tenants.filter((t) => t.plan === 'completo').length
    const defaulters = tenants.filter((t) => t.paymentStatus === 'overdue')
    const mrr = completeCount * PLANS.completo.price
    const defaultAmount = defaulters.length * PLANS.completo.price
    res.json({ mrr, defaultAmount, completeCount, defaultersCount: defaulters.length })
  } catch (err) {
    next(err)
  }
})

router.get('/announcement', async (req, res, next) => {
  try {
    const announcement = await prisma.globalAnnouncement.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ message: announcement?.message || '' })
  } catch (err) {
    next(err)
  }
})

router.post('/announcement', async (req, res, next) => {
  try {
    const { message } = req.body
    await prisma.globalAnnouncement.updateMany({ data: { isActive: false } })
    const announcement = await prisma.globalAnnouncement.create({
      data: { message: message || '', isActive: true },
    })
    res.json({ message: announcement.message })
  } catch (err) {
    next(err)
  }
})

router.delete('/announcement', async (req, res, next) => {
  try {
    await prisma.globalAnnouncement.updateMany({ data: { isActive: false } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

router.get('/tickets', async (req, res, next) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      include: { user: { select: { name: true } }, messages: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(
      tickets.map((t) => ({
        id: t.id,
        userId: t.userId,
        userName: t.user.name,
        subject: t.subject,
        description: t.description,
        status: t.status,
        createdAt: t.createdAt.toISOString(),
        messages: t.messages.map((m) => ({
          id: m.id,
          sender: m.senderRole === 'admin' ? 'admin' : 'user',
          text: m.message,
          createdAt: m.createdAt.toISOString(),
        })),
      }))
    )
  } catch (err) {
    next(err)
  }
})

router.get('/plan-history', async (req, res, next) => {
  try {
    const logs = await prisma.planChangeLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { tenant: { select: { name: true, email: true } } },
    })
    res.json(
      logs.map((l) => ({
        id: l.id,
        tenantId: l.tenantId,
        tenantName: l.tenant.name,
        tenantEmail: l.tenant.email,
        oldPlan: l.oldPlan,
        newPlan: l.newPlan,
        changedBy: l.changedBy,
        source: l.source,
        createdAt: l.createdAt.toISOString(),
      }))
    )
  } catch (err) {
    next(err)
  }
})

router.post('/reset-db', async (_req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Reset de banco não permitido em produção' })
      return
    }
    // Delete all data in correct order (children first)
    await prisma.stockMovement.deleteMany()
    await prisma.inventoryBatch.deleteMany()
    await prisma.purchaseOrderItem.deleteMany()
    await prisma.purchaseOrder.deleteMany()
    await prisma.productRecipe.deleteMany()
    await prisma.productChoiceOption.deleteMany()
    await prisma.productChoiceGroup.deleteMany()
    await prisma.productComponent.deleteMany()
    await prisma.orderItemComponent.deleteMany()
    await prisma.orderItemChoice.deleteMany()
    await prisma.orderItem.deleteMany()
    await prisma.printJob.deleteMany()
    await prisma.printerConfig.deleteMany()
    await prisma.pushSubscription.deleteMany()
    await prisma.supportTicket.deleteMany()
    await prisma.ticketMessage.deleteMany()
    await prisma.ticketAttachment.deleteMany()
    await prisma.invoice.deleteMany()
    await prisma.planChangeLog.deleteMany()
    await prisma.discount.deleteMany()
    await prisma.deliveryZone.deleteMany()
    await prisma.order.deleteMany()
    await prisma.product.deleteMany()
    await prisma.category.deleteMany()
    await prisma.inventoryItem.deleteMany()
    await prisma.supplier.deleteMany()
    await prisma.customer.deleteMany()
    await prisma.invite.deleteMany()
    await prisma.whatsAppConfig.deleteMany()
    await prisma.paymentConfig.deleteMany()
    await prisma.user.deleteMany()
    await prisma.tenant.deleteMany()
    await prisma.globalAnnouncement.deleteMany()

    // Recreate admin user
    const passwordHash = await hashPassword('S100cem%')
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: 'admin@menufacil.com',
        passwordHash,
        role: 'admin',
      },
    })

    console.log('[Admin] Database reset complete - admin@menufacil recreated')
    res.json({ message: 'Banco de dados resetado com sucesso. Admin: admin@menufacil / S100cem%' })
  } catch (err) {
    next(err)
  }
})

export default router
