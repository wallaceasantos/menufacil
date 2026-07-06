const cache = new Map<string, { data: any; expiry: number }>()

export function getCached(key: string): any | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiry) {
    cache.delete(key)
    return null
  }
  return entry.data
}

export function setCache(key: string, data: any, ttlMs: number = 60000): void {
  cache.set(key, JSON.parse(JSON.stringify(data)))
  if (cache.size > 100) {
    const first = cache.keys().next().value
    if (first) cache.delete(first)
  }
}
