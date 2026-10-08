import { logger, errorMeta } from './logger'
import { getRedis, isRedisAvailable } from './redis'

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>

const handlers = new Map<string, JobHandler>()
const memoryQueues = new Map<string, Record<string, unknown>[]>()
const memoryRunning = new Map<string, boolean>()

const QUEUE_PREFIX = 'queue:'

export function registerHandler(jobName: string, handler: JobHandler): void {
  handlers.set(jobName, handler)
}

export async function enqueue(jobName: string, payload: Record<string, unknown> = {}): Promise<void> {
  const redis = getRedis()

  if (redis && isRedisAvailable()) {
    await redis.rpush(`${QUEUE_PREFIX}${jobName}`, JSON.stringify({ jobName, payload, enqueuedAt: new Date().toISOString() }))
    return
  }

  const list = memoryQueues.get(jobName) || []
  list.push(payload)
  memoryQueues.set(jobName, list)
  setTimeout(() => { drainMemoryQueue(jobName) }, 0)
}

async function drainMemoryQueue(jobName: string): Promise<void> {
  if (memoryRunning.get(jobName)) return
  memoryRunning.set(jobName, true)

  const handler = handlers.get(jobName)
  const list = memoryQueues.get(jobName) || []

  while (list.length > 0) {
    const payload = list.shift()!
    if (!handler) continue
    try {
      await handler(payload)
    } catch (err) {
      logger.error(`[Queue] Erro no job ${jobName}`, errorMeta(err))
    }
  }

  memoryRunning.set(jobName, false)
}

async function consumeRedis(jobName: string): Promise<void> {
  const redis = getRedis()
  if (!redis || !isRedisAvailable()) return

  const handler = handlers.get(jobName)
  if (!handler) return

  const raw = await redis.lpop(`${QUEUE_PREFIX}${jobName}`)
  if (!raw) return

  try {
    const { payload } = JSON.parse(raw)
    await handler(payload || {})
  } catch (err) {
    logger.error(`[Queue] Erro no job ${jobName}`, errorMeta(err))
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