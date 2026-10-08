import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Bell, ShoppingBag, AlertTriangle, Users, CheckCircle2, X,
  Check, Trash2, Wifi, WifiOff, BellRing, BellOff,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotifications, type AppNotification } from '../contexts/NotificationContext'
import { usePushNotifications } from '../hooks/usePushNotifications'

const ICON_MAP: Record<string, any> = {
  new_order: ShoppingBag,
  order_status_changed: CheckCircle2,
  inventory_low: AlertTriangle,
  new_customer: Users,
}

const COLOR_MAP: Record<string, string> = {
  new_order: 'text-orange-500 bg-orange-100 dark:bg-orange-500/10',
  order_status_changed: 'text-blue-500 bg-blue-100 dark:bg-blue-500/10',
  inventory_low: 'text-red-500 bg-red-100 dark:bg-red-500/10',
  new_customer: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-500/10',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s atrás`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}min atrás`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h atrás`
  const days = Math.floor(hr / 24)
  return `${days}d atrás`
}

export function NotificationCenter() {
  const { notifications, unreadCount, connected, markAllAsRead, clearAll, markAsRead, removeNotification } = useNotifications()
  const { pushSupported, pushSubscribed, pushLoading, subscribe, unsubscribe } = usePushNotifications()
  const [open, setOpen] = useState(false)
  const [toastQueue, setToastQueue] = useState<AppNotification[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const previousIdsRef = useRef<Set<string>>(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    const newOnes: AppNotification[] = []
    for (const n of notifications) {
      if (!previousIdsRef.current.has(n.id) && n.type !== 'connected') {
        newOnes.push(n)
      }
    }
    previousIdsRef.current = new Set(notifications.map((n) => n.id))

    if (newOnes.length > 0) {
      setToastQueue((prev) => [...prev, ...newOnes].slice(-3))
    }
  }, [notifications])

  useEffect(() => {
    if (toastQueue.length === 0) return
    const timer = setTimeout(() => {
      setToastQueue((prev) => prev.slice(1))
    }, 5000)
    return () => clearTimeout(timer)
  }, [toastQueue])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleNotificationClick = (n: AppNotification) => {
    markAsRead(n.id)
    if (n.type === 'new_order' || n.type === 'order_status_changed') {
      setOpen(false)
      navigate('/dashboard/orders')
    }
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => { setOpen(!open); if (!open) markAllAsRead() }}
          className="relative p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626] transition-colors"
          title={connected ? 'Notificações em tempo real' : 'Desconectado'}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#121214]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
          <span
            className={`absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full ${
              connected ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
            } ring-2 ring-white dark:ring-[#121214]`}
            title={connected ? 'Conectado' : 'Desconectado'}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl overflow-hidden z-50"
            >
              <div className="p-4 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-white">Notificações</h3>
                  {connected ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <Wifi className="w-2.5 h-2.5" /> ao vivo
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-500/10 px-2 py-0.5 rounded-full">
                      <WifiOff className="w-2.5 h-2.5" /> offline
                    </span>
                  )}
                </div>
                {pushSupported && (
                  <button
                    onClick={() => pushSubscribed ? unsubscribe() : subscribe()}
                    disabled={pushLoading}
                    title={pushSubscribed ? 'Desativar notificações push' : 'Ativar notificações no celular'}
                    className="text-xs font-medium flex items-center gap-1 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {pushSubscribed ? (
                      <><BellRing className="w-3.5 h-3.5 text-orange-500" /> <span className="text-orange-600 dark:text-orange-500 hidden sm:inline">Ativo</span></>
                    ) : (
                      <><BellOff className="w-3.5 h-3.5 text-slate-400" /> <span className="text-slate-500 hidden sm:inline">Push</span></>
                    )}
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Limpar
                  </button>
                )}
              </div>

              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <Bell className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm">Nenhuma notificação</p>
                    <p className="text-xs mt-1 text-slate-400">Você verá aqui novos pedidos e alertas</p>
                    {pushSupported && !pushSubscribed && (
                      <button onClick={subscribe} disabled={pushLoading}
                        className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-orange-600 dark:text-orange-500 hover:text-orange-700 bg-orange-50 dark:bg-orange-500/10 px-3 py-1.5 rounded-lg transition-colors">
                        <BellRing className="w-3 h-3" />
                        {pushLoading ? 'Ativando...' : 'Receber notificações no celular'}
                      </button>
                    )}
                  </div>
                ) : (
                  notifications.map((n) => {
                    const Icon = ICON_MAP[n.type] || Bell
                    const colorClass = COLOR_MAP[n.type] || 'text-slate-500 bg-slate-100'
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-3 border-b border-slate-100 dark:border-[#262626] hover:bg-slate-50 dark:hover:bg-[#09090b] cursor-pointer transition-colors relative ${
                          !n.read ? 'bg-orange-50/30 dark:bg-orange-500/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-bold text-slate-900 dark:text-white">
                                {n.title}
                              </p>
                              {!n.read && (
                                <span className="w-2 h-2 bg-orange-500 rounded-full shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                              {timeAgo(n.timestamp)}
                            </p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeNotification(n.id) }}
                            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 border-t border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#09090b]">
                  <button
                    onClick={() => { setOpen(false); navigate('/dashboard/orders') }}
                    className="w-full text-sm text-orange-600 dark:text-orange-500 hover:text-orange-700 font-medium py-1"
                  >
                    Ver todos os pedidos
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
        <AnimatePresence>
          {toastQueue.map((n) => {
            const Icon = ICON_MAP[n.type] || Bell
            const colorClass = COLOR_MAP[n.type] || 'text-slate-500 bg-slate-100'
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                onClick={() => handleNotificationClick(n)}
                className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl shadow-2xl p-4 max-w-sm cursor-pointer pointer-events-auto"
              >
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{n.title}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">{n.message}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setToastQueue((prev) => prev.filter((t) => t.id !== n.id))
                    }}
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="mt-2 h-0.5 bg-slate-100 dark:bg-[#262626] rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: 0 }}
                    transition={{ duration: 5, ease: 'linear' }}
                    className="h-full bg-orange-500"
                  />
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </>
  )
}
