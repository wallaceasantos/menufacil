import type { Store, ClientRateLimitInfo, Options } from 'express-rate-limit'
import { getRedis, isRedisAvailable } from './redis'

const memory = new Map<string, { count: number; resetTime: number }>()
const DEFAULT_WINDOW_MS = 60_000

export class RedisRateLimitStore implements Store {
  prefix: string
  windowMs: number = DEFAULT_WINDOW_MS

  constructor(prefix = 'rl:') {
    this.prefix = prefix
  }

  init(options: Options): void {
    this.windowMs = options.windowMs || DEFAULT_WINDOW_MS
  }

  private key(key: string): string {
    return `${this.prefix}${key}`
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const redis = getRedis()

    if (redis && isRedisAvailable()) {
      const raw = await redis.get(this.key(key))
      const ttl = await redis.ttl(this.key(key))
      if (raw === null || ttl <= 0) return undefined
      return { totalHits: Number(raw), resetTime: new Date(Date.now() + ttl * 1000) }
    }

    const entry = memory.get(this.key(key))
    if (!entry || entry.resetTime <= Date.now()) return undefined
    return { totalHits: entry.count, resetTime: new Date(entry.resetTime) }
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const redis = getRedis()

    if (!redis || !isRedisAvailable()) {
      const now = Date.now()
      const entry = memory.get(this.key(key))
      if (!entry || entry.resetTime <= now) {
        memory.set(this.key(key), { count: 1, resetTime: now + this.windowMs })
        return { totalHits: 1, resetTime: new Date(now + this.windowMs) }
      }
      entry.count += 1
      return { totalHits: entry.count, resetTime: new Date(entry.resetTime) }
    }

    const ttl = await redis.ttl(this.key(key))
    if (ttl <= 0) {
      await redis.set(this.key(key), '1', 'PX', this.windowMs)
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) }
    }

    const totalHits = await redis.incr(this.key(key))
    return { totalHits, resetTime: new Date(Date.now() + ttl * 1000) }
  }

  async decrement(key: string): Promise<void> {
    const redis = getRedis()
    if (redis && isRedisAvailable()) {
      await redis.decr(this.key(key)).catch(() => {})
      return
    }
    const entry = memory.get(this.key(key))
    if (entry && entry.count > 0) entry.count -= 1
  }

  async resetKey(key: string): Promise<void> {
    const redis = getRedis()
    if (redis && isRedisAvailable()) {
      await redis.del(this.key(key)).catch(() => {})
      return
    }
    memory.delete(this.key(key))
  }

  async resetAll(): Promise<void> {
    const redis = getRedis()
    if (redis && isRedisAvailable()) {
      const keys = await redis.keys(`${this.prefix}*`)
      if (keys.length > 0) await redis.del(...keys).catch(() => {})
      return
    }
    for (const k of memory.keys()) {
      if (k.startsWith(this.prefix)) memory.delete(k)
    }
  }

  shutdown(): void {}
}