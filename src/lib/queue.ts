import { logger, errorMeta } from './logger'
import { getRedis, isRedisAvailable } from './redis'

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>

interface JobEnvelope {
  payload: Record<string, unknown>
  attempts: number
  maxAttempts: number
  enqueuedAt: string
}

const handlers = new Map<string, JobHandler>()
const memoryQueues = new Map<string, JobEnvelope[]>()
const memoryRunning = new Map<string, boolean>()

const QUEUE_PREFIX = 'queue:'
const DEFAULT_MAX_ATTEMPTS = 3

export function registerHandler(jobName: string, handler: JobHandler): void {
  handlers.set(jobName, handler)
}

export async function enqueue(
  jobName: string,
  payload: Record<string, unknown> = {},
  options: { maxAttempts?: number } = {}
): Promise<void> {
  const envelope: JobEnvelope = {
    payload,
    attempts: 0,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    enqueuedAt: new Date().toISOString(),
  }

  const redis = getRedis()

  if (redis && isRedisAvailable()) {
    await redis.rpush(`${QUEUE_PREFIX}${jobName}`, JSON.stringify(envelope))
    return
  }

  const list = memoryQueues.get(jobName) || []
  list.push(envelope)
  memoryQueues.set(jobName, list)
  setTimeout(() => { drainMemoryQueue(jobName) }, 0)
}

async function runJob(jobName: string, envelope: JobEnvelope): Promise<void> {
  const handler = handlers.get(jobName)
  if (!handler) return

  try {
    await handler(envelope.payload)
  } catch (err) {
    envelope.attempts += 1
    if (envelope.attempts < envelope.maxAttempts) {
      logger.warn(`[Queue] Job ${jobName} falhou (tentativa ${envelope.attempts}/${envelope.maxAttempts}) — reenfileirando`, errorMeta(err))
      await requeue(jobName, envelope)
    } else {
      logger.error(`[Queue] Job ${jobName} descartado após ${envelope.attempts} tentativas`, errorMeta(err))
    }
  }
}

async function requeue(jobName: string, envelope: JobEnvelope): Promise<void> {
  const redis = getRedis()

  if (redis && isRedisAvailable()) {
    await redis.rpush(`${QUEUE_PREFIX}${jobName}`, JSON.stringify(envelope)).catch(() => {})
    return
  }

  setTimeout(() => {
    const list = memoryQueues.get(jobName) || []
    list.push(envelope)
    memoryQueues.set(jobName, list)
    drainMemoryQueue(jobName)
  }, 500 * envelope.attempts)
}

async function drainMemoryQueue(jobName: string): Promise<void> {
  if (memoryRunning.get(jobName)) return
  memoryRunning.set(jobName, true)

  const list = memoryQueues.get(jobName) || []

  while (list.length > 0) {
    await runJob(jobName, list.shift()!)
  }

  memoryRunning.set(jobName, false)
}

async function consumeRedis(jobName: string): Promise<void> {
  const redis = getRedis()
  if (!redis || !isRedisAvailable()) return

  const raw = await redis.lpop(`${QUEUE_PREFIX}${jobName}`)
  if (!raw) return

  try {
    const envelope = JSON.parse(raw) as JobEnvelope
    await runJob(jobName, envelope)
  } catch (err) {
    logger.error(`[Queue] Erro ao processar job ${jobName}`, errorMeta(err))
  }
}

let pollTimer: NodeJS.Timeout | null = null

export function startQueueWorker(pollMs = 2000): void {
  if (pollTimer) return

  pollTimer = setInterval(async () => {
    if (!isRedisAvailable()) return
    for (const jobName of handlers.keys()) {
      await consumeRedis(jobName)
    }
  }, pollMs)
}

export async function stopQueueWorker(): Promise<void> {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}