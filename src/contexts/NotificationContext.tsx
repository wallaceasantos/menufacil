import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from 'react'
import { API_URL } from '../lib/api'
import { useAuth } from './AuthContext'

export type NotificationType = 'new_order' | 'order_status_changed' | 'inventory_low' | 'new_customer' | 'connected'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  data?: any
  timestamp: string
  read: boolean
}

interface NotificationContextType {
  notifications: AppNotification[]
  unreadCount: number
  connected: boolean
  markAllAsRead: () => void
  markAsRead: (id: string) => void
  clearAll: () => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

const MAX_NOTIFICATIONS = 50

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [connected, setConnected] = useState(false)
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'read'>) => {
    const notification: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      read: false,
    }
    setNotifications((prev) => {
      const updated = [notification, ...prev]
      return updated.slice(0, MAX_NOTIFICATIONS)
    })
  }, [])

  const formatEvent = useCallback((event: any): Omit<AppNotification, 'id' | 'read'> | null => {
    const { type, data } = event
    if (type === 'new_order') {
      return {
        type,
        title: 'Novo pedido!',
        message: `${data?.customerName || 'Cliente'} - R$ ${Number(data?.totalAmount || 0).toFixed(2).replace('.', ',')}`,
        data,
        timestamp: event.timestamp || new Date().toISOString(),
      }
    }
    if (type === 'order_status_changed') {
      const statusLabels: Record<string, string> = {
        pending: 'pendente',
        preparing: 'em preparo',
        completed: 'concluído',
        cancelled: 'cancelado',
      }
      return {
        type,
        title: 'Status do pedido alterado',
        message: `Pedido #${data?.orderId?.slice(0, 8) || '?'} agora está ${statusLabels[data?.status] || data?.status}`,
        data,
        timestamp: event.timestamp || new Date().toISOString(),
      }
    }
    if (type === 'inventory_low') {
      return {
        type,
        title: 'Estoque baixo ⚠️',
        message: `${data?.itemName || 'Item'} — ${data?.currentStock || 0} ${data?.unit || 'un'} restantes (mín: ${data?.minStock || 0})`,
        data,
        timestamp: event.timestamp || new Date().toISOString(),
      }
    }
    if (type === 'new_customer') {
      return {
        type,
        title: 'Novo cliente',
        message: `${data?.name || 'Cliente'} fez o primeiro pedido`,
        data,
        timestamp: event.timestamp || new Date().toISOString(),
      }
    }
    return null
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnected(false)
      return
    }

    const token = sessionStorage.getItem('jwt_token')
    if (!token) return

    const connect = () => {
      try {
        const params = new URLSearchParams({ token })
        const userSlug = user?.tenantSlug
        if (userSlug) params.set('tenantSlug', userSlug)
        const url = `${API_URL}/events/stream?${params.toString()}`
        const es = new EventSource(url)
        eventSourceRef.current = es

        es.addEventListener('connected', () => {
          setConnected(true)
          reconnectAttemptsRef.current = 0
        })

        const eventTypes: Array<NotificationType> = ['new_order', 'order_status_changed', 'inventory_low', 'new_customer']
        eventTypes.forEach((evtType) => {
          es.addEventListener(evtType, (e: MessageEvent) => {
            try {
              const data = JSON.parse(e.data)
              const formatted = formatEvent({ type: evtType, data, timestamp: new Date().toISOString() })
              if (formatted) addNotification(formatted)
            } catch (err) {
              console.error('[SSE] Parse error:', err)
            }
          })
        })

        es.onerror = () => {
          setConnected(false)
          es.close()
          eventSourceRef.current = null

          const attempts = reconnectAttemptsRef.current
          const delay = Math.min(1000 * Math.pow(2, attempts), 30000)
          reconnectAttemptsRef.current = attempts + 1
          reconnectTimeoutRef.current = window.setTimeout(connect, delay)
        }
      } catch (err) {
        console.error('[SSE] Connection error:', err)
        reconnectTimeoutRef.current = window.setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setConnected(false)
    }
  }, [isAuthenticated, user?.id, addNotification, formatEvent])

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [])

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
  }, [])

  const clearAll = useCallback(() => {
    setNotifications([])
  }, [])

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, connected, markAllAsRead, markAsRead, clearAll, removeNotification }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationContext)
  if (ctx === undefined) {
    throw new Error('useNotifications must be used within NotificationProvider')
  }
  return ctx
}
