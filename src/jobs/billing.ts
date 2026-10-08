import { prisma } from '../lib/prisma'
import { logPlanChange } from '../lib/planLog'
import { logger, errorMeta } from '../lib/logger'

const LOCAL_MODE = process.env.MP_LOCAL_MODE === 'true'

export async function billingCron(): Promise<void> {
  try {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    const toBill = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'authorized',
        nextBillingDate: { lte: new Date(todayStr) },
        plan: 'completo',
      },
    })

    for (const tenant of toBill) {
      if (LOCAL_MODE) {
        const nextBilling = new Date()
        nextBilling.setDate(nextBilling.getDate() + 30)

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            paymentStatus: 'paid',
            overdueDays: 0,
            lastBillingDate: new Date(),
            nextBillingDate: nextBilling,
          },
        })
        logger.info(`[Billing] Cobrança local OK para tenant ${tenant.id} — próxima em ${nextBilling.toISOString().split('T')[0]}`)
      } else {
        logger.info(`[Billing] Tenant ${tenant.id} aguardando cobrança do MP`)
      }
    }

    const overdueThreshold = new Date()
    overdueThreshold.setDate(overdueThreshold.getDate() - 31)

    const missed = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'authorized',
        paymentStatus: 'paid',
        lastBillingDate: { lte: overdueThreshold },
        plan: 'completo',
      },
    })

    for (const tenant of missed) {
      const daysSinceLastBilling = tenant.lastBillingDate
        ? Math.floor((now.getTime() - new Date(tenant.lastBillingDate).getTime()) / (1000 * 60 * 60 * 24)) - 30
        : 1

      const actualOverdue = Math.max(1, daysSinceLastBilling)
      const updateData: any = { overdueDays: actualOverdue }

      if (actualOverdue >= 30) {
        updateData.plan = 'basico'
        updateData.subscriptionStatus = 'cancelled'
        updateData.cardLastFour = null
        updateData.nextBillingDate = null
        updateData.paymentStatus = 'overdue'

        await logPlanChange({
          tenantId: tenant.id,
          oldPlan: tenant.plan,
          newPlan: 'basico',
          source: 'downgrade',
          changedBy: 'system',
        })
        logger.info(`[Billing] Tenant ${tenant.id} rebaixado para BASICO após ${actualOverdue} dias em atraso`)
      } else {
        if (actualOverdue >= 3 && tenant.paymentStatus !== 'overdue') {
          updateData.paymentStatus = 'overdue'
        }
        logger.info(`[Billing] Tenant ${tenant.id} em atraso — dia ${actualOverdue}`)
      }

      await prisma.tenant.update({ where: { id: tenant.id }, data: updateData })
    }
  } catch (err) {
    logger.error('[Billing] Erro no cron de cobrança', errorMeta(err))
  }
}