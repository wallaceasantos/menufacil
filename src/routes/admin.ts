import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { PLANS } from '../data/plans'
import { authenticate, requireAdmin } from '../middleware/auth'
import { hashPassword } from '../utils/password'
import { auditFromRequest } from '../lib/audit'

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
    auditFromRequest(req, 'admin.tenant_status', 'tenant', id, { name: tenant.name, newStatus })
    res.json(mapTenant(updated))
  } catch (err) {
    next(err)
  }
})

router.delete('/tenants/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.tenant.delete({ where: { id } })
    auditFromRequest(req, 'admin.tenant_delete', 'tenant', id)
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
    auditFromRequest(req, 'admin.announcement_create', 'global_announcement', announcement.id, { message: message || '' })
    res.json({ message: announcement.message })
  } catch (err) {
    next(err)
  }
})

router.delete('/announcement', async (req, res, next) => {
  try {
    await prisma.globalAnnouncement.updateMany({ data: { isActive: false } })
    auditFromRequest(req, 'admin.announcement_delete', 'global_announcement')
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

router.get('/metrics', async (req, res, next) => {
  try {
    const now = new Date()
    const days = Math.min(Number(req.query.days) || 30, 365)
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

    const tenants = await prisma.tenant.findMany({
      select: { id: true, plan: true, status: true, paymentStatus: true, createdAt: true },
    })

    const activeCompleto = tenants.filter((t) => t.plan === 'completo' && t.status === 'active')
    const mrr = activeCompleto.length * PLANS.completo.price
    const arr = mrr * 12

    const changes = await prisma.planChangeLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    })

    const downgrades = changes.filter((c) => c.oldPlan === 'completo' && c.newPlan === 'basico')
    const upgrades = changes.filter((c) => c.oldPlan === 'basico' && c.newPlan === 'completo')

    const baseAtStart = activeCompleto.length + downgrades.length - upgrades.length
    const churnRate = baseAtStart > 0 ? Number(((downgrades.length / baseAtStart) * 100).toFixed(1)) : 0

    const newTenants = tenants.filter((t) => new Date(t.createdAt) >= since)

    const [resetRequested, resetCompleted] = await Promise.all([
      prisma.auditLog.count({ where: { action: 'auth.forgot_password', createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { action: 'auth.reset_password', createdAt: { gte: since } } }),
    ])

    const churnedTenantIds = [...new Set(downgrades.map((d) => d.tenantId))]
    const churnedTenants = churnedTenantIds.length
      ? await prisma.tenant.findMany({
          where: { id: { in: churnedTenantIds } },
          select: { id: true, name: true, slug: true },
        })
      : []

    const byDay = new Map<string, { upgrades: number; downgrades: number }>()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      byDay.set(d.toISOString().split('T')[0], { upgrades: 0, downgrades: 0 })
    }
    for (const c of changes) {
      const key = new Date(c.createdAt).toISOString().split('T')[0]
      const entry = byDay.get(key)
      if (!entry) continue
      if (c.oldPlan === 'basico' && c.newPlan === 'completo') entry.upgrades += 1
      if (c.oldPlan === 'completo' && c.newPlan === 'basico') entry.downgrades += 1
    }

    res.json({
      mrr,
      arr,
      churnRate,
      windowDays: days,
      activeSubscriptions: activeCompleto.length,
      upgrades: upgrades.length,
      downgrades: downgrades.length,
      newTenants: newTenants.length,
      totalTenants: tenants.length,
      passwordRecoveries: { requested: resetRequested, completed: resetCompleted },
      churnedTenants,
      timeline: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    })
  } catch (err) {
    next(err)
  }
})

router.get('/audit-logs', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    res.json(
      logs.map((l) => ({
        id: l.id,
        actorEmail: l.actorEmail,
        actorRole: l.actorRole,
        action: l.action,
        resource: l.resource,
        resourceId: l.resourceId,
        details: l.details,
        ip: l.ip,
        createdAt: l.createdAt?.toISOString() || null,
      }))
    )
  } catch (err) {
    next(err)
  }
})

router.post('/reset-db', async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Reset de banco não permitido em produção' })
      return
    }
    auditFromRequest(req, 'admin.reset_db', 'database')
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
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@menufacil.com'
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD
    if (!adminPassword) {
      res.status(500).json({ error: 'ADMIN_INITIAL_PASSWORD não configurada. Configure a variável de ambiente para recriar o admin.' })
      return
    }
    const passwordHash = await hashPassword(adminPassword)
    await prisma.user.create({
      data: {
        name: 'Admin',
        email: adminEmail,
        passwordHash,
        role: 'admin',
      },
    })

    console.log(`[Admin] Database reset complete - ${adminEmail} recreated`)
    res.json({ message: `Banco de dados resetado com sucesso. Admin: ${adminEmail}` })
  } catch (err) {
    next(err)
  }
})

export default router
