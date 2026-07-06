import { prisma } from './prisma'

export async function logPlanChange(params: {
  tenantId: string
  oldPlan: string
  newPlan: string
  source: 'upgrade' | 'webhook' | 'admin' | 'downgrade' | 'local'
  changedBy?: string
}) {
  const { tenantId, oldPlan, newPlan, source, changedBy = 'system' } = params
  if (oldPlan === newPlan) return
  await prisma.planChangeLog.create({
    data: { tenantId, oldPlan, newPlan, source, changedBy },
  })
}
