import dotenv from 'dotenv'
dotenv.config()

import { billingCron } from './jobs/billing'
import { registerEmailJobs } from './jobs/email'
import { registerHandler, startQueueWorker, stopQueueWorker } from './lib/queue'
import { logger, errorMeta } from './lib/logger'
import { prisma } from './lib/prisma'
import { closeRedis } from './lib/redis'

registerHandler('billing:run', async () => {
  await billingCron()
})

registerHandler('billing:tenant', async (payload) => {
  const tenantId = String(payload.tenantId || '')
  if (!tenantId) return
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    logger.warn(`[Worker] Tenant ${tenantId} não encontrado`)
    return
  }
  logger.info(`[Worker] Job billing:tenant processado para ${tenant.slug}`)
})

startQueueWorker(2000)

registerEmailJobs()

setInterval(() => {
  billingCron().catch((err) => logger.error('[Worker] Erro no billing cron', errorMeta(err)))
}, 60 * 60 * 1000)

setTimeout(() => {
  billingCron().catch((err) => logger.error('[Worker] Erro no billing cron', errorMeta(err)))
}, 15 * 1000)

logger.info('[Worker] Iniciado — billing cron + filas ativos')

async function shutdown(signal: string) {
  logger.info(`[Worker] Recebido ${signal}, encerrando...`)
  const force = setTimeout(() => { logger.info('[Worker] Timeout — forçando saída'); process.exit(1) }, 10_000)
  force.unref()
  await stopQueueWorker()
  await closeRedis()
  await prisma.$disconnect()
  process.exit(0)
}

process.on('SIGTERM', () => { shutdown('SIGTERM').catch(() => process.exit(1)) })
process.on('SIGINT', () => { shutdown('SIGINT').catch(() => process.exit(1)) })