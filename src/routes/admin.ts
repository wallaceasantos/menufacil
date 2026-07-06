import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { PLANS } from '../data/plans'
import { authenticate, requireAdmin } from '../middleware/auth'

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

export default router
