import Redis from 'ioredis'
import { logger } from './logger'

const REDIS_URL = process.env.REDIS_URL || ''

let client: Redis | null = null
let available = false

if (REDIS_URL) {
  client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 500, 5000),
    lazyConnect: true,
  })

  client.on('connect', () => {
    available = true
    logger.info('Redis conectado')
  })

  client.on('error', (err) => {
    if (available) logger.error('Redis error', { message: err.message })
    available = false
  })

  client.connect().catch((err) => {
    available = false
    logger.error('Falha ao conectar no Redis — seguindo com fallback em memória', { message: err.message })
  })
}

export function isRedisAvailable(): boolean {
  return available && client !== null
}

export function getRedis(): Redis | null {
  return isRedisAvailable() ? client : null
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit().catch(() => {})
    client = null
    available = false
  }
}