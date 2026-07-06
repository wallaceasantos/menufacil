type EventType = 'new_order' | 'order_status_changed' | 'inventory_low' | 'new_customer'

export interface RealtimeEvent {
  type: EventType
  tenantId: string
  data: any
  timestamp: string
}

type Listener = (event: RealtimeEvent) => void

class EventBus {
  private listeners: Map<string, Set<Listener>> = new Map()
  private recentEvents: Map<string, RealtimeEvent[]> = new Map()
  private maxRecent = 50

  subscribe(tenantId: string, listener: Listener): () => void {
    if (!this.listeners.has(tenantId)) {
      this.listeners.set(tenantId, new Set())
    }
    this.listeners.get(tenantId)!.add(listener)

    const recent = this.recentEvents.get(tenantId) || []
    for (const event of recent) {
      try {
        listener(event)
      } catch {}
    }

    return () => {
      this.listeners.get(tenantId)?.delete(listener)
      if (this.listeners.get(tenantId)?.size === 0) {
        this.listeners.delete(tenantId)
      }
    }
  }

  emit(tenantId: string, type: EventType, data: any) {
    const event: RealtimeEvent = {
      type,
      tenantId,
      data,
      timestamp: new Date().toISOString(),
    }

    if (!this.recentEvents.has(tenantId)) {
      this.recentEvents.set(tenantId, [])
    }
    const recent = this.recentEvents.get(tenantId)!
    recent.push(event)
    if (recent.length > this.maxRecent) {
      recent.shift()
    }

    const tenantListeners = this.listeners.get(tenantId)
    if (tenantListeners) {
      for (const listener of tenantListeners) {
        try {
          listener(event)
        } catch (err) {
          console.error('[EventBus] Listener error:', err)
        }
      }
    }

    console.log(`[EventBus] ${type} -> tenant ${tenantId.substring(0, 8)} (${tenantListeners?.size || 0} listeners)`)
  }

  getStats() {
    return {
      tenants: this.listeners.size,
      totalListeners: Array.from(this.listeners.values()).reduce((sum, s) => sum + s.size, 0),
    }
  }
}

export const eventBus = new EventBus()
