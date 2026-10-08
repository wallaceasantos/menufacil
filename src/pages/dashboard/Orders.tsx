import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  Search, Filter, Clock, CheckCircle2, XCircle, ChefHat, ShoppingBag,
  ChevronRight, RefreshCw, Loader2, Ban, Phone, MapPin, DollarSign,
  ArrowUp, ArrowDown,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

interface OrderItem {
  id: string
  rawId: string
  customer: string
  phone: string
  address: string
  items: string[]
  total: string
  rawTotal: number
  status: string
  rawStatus: string
  createdAt: string
  stockDeducted: boolean
  paymentMethod: string | null
  mpPaymentStatus: string | null
  rating: number | null
}

interface OrderResponse {
  data: OrderItem[]
  total: number
  page: number
  totalPages: number
  counts: Record<string, number>
}

interface OrderDetail {
  id: string
  rawId: string
  customer: string
  phone: string
  address: string
  items: {
    productName: string
    quantity: number
    unitPrice: number
    notes: string | null
    components: { name: string; quantity: number; unitPrice: number }[]
    choices: { groupName: string; optionName: string; quantity: number; unitPrice: number }[]
  }[]
  total: string
  rawTotal: number
  status: string
  rawStatus: string
  paymentMethod: string | null
  mpPaymentStatus: string | null
  rating: number | null
  createdAt: string
  updatedAt: string
  stockDeducted: boolean
}

const STATUSES = [
  { key: '', label: 'Todos', icon: ShoppingBag, color: 'slate' },
  { key: 'pending', label: 'Pendentes', icon: Clock, color: 'amber' },
  { key: 'preparing', label: 'Preparando', icon: ChefHat, color: 'blue' },
  { key: 'completed', label: 'Concluídos', icon: CheckCircle2, color: 'emerald' },
  { key: 'cancelled', label: 'Cancelados', icon: XCircle, color: 'red' },
]

const NEXT_STATUS: Record<string, { status: string; label: string }[]> = {
  pending: [{ status: 'preparing', label: 'Preparar' }, { status: 'cancelled', label: 'Cancelar' }],
  preparing: [{ status: 'completed', label: 'Concluir' }, { status: 'cancelled', label: 'Cancelar' }],
  completed: [{ status: 'cancelled', label: 'Cancelar' }],
  cancelled: [{ status: 'pending', label: 'Reabrir' }],
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400',
  preparing: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-400',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400',
}

export function Orders() {
  const { user } = useAuth()
  const slug = getTenantSlug(user!)
  const [orders, setOrders] = useState<OrderItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [counts, setCounts] = useState<Record<string, number>>({ pending: 0, preparing: 0, completed: 0, cancelled: 0 })
  const [activeStatus, setActiveStatus] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => { loadOrders() }, [page, activeStatus, search])

  const loadOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' })
      if (activeStatus) params.set('status', activeStatus)
      if (search) params.set('search', search)
      const data = await api(`/orders?${params}`, { headers: { 'x-tenant-slug': slug } }) as OrderResponse
      setOrders(data.data)
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setCounts(data.counts)
    } catch { toast.error('Erro ao carregar pedidos') }
    finally { setLoading(false) }
  }

  const loadOrderDetail = async (rawId: string) => {
    try {
      const data = await api(`/orders/${rawId}`, { headers: { 'x-tenant-slug': slug } }) as OrderDetail
      setDetail(data)
      setShowDetail(true)
    } catch { toast.error('Erro ao carregar detalhes') }
  }

  const updateStatus = async (rawId: string, status: string) => {
    try {
      await api(`/orders/${rawId}/status`, {
        method: 'PATCH',
        headers: { 'x-tenant-slug': slug },
        body: JSON.stringify({ status }),
      })
      toast.success('Status atualizado!')
      loadOrders()
      if (detail?.rawId === rawId) loadOrderDetail(rawId)
    } catch { toast.error('Erro ao atualizar') }
  }

  const bulkUpdate = async (status: string) => {
    if (selected.size === 0) return
    setBulkUpdating(true)
    try {
      await api('/orders/bulk-status', {
        method: 'PATCH',
        headers: { 'x-tenant-slug': slug },
        body: JSON.stringify({ ids: Array.from(selected), status }),
      })
      toast.success(`${selected.size} pedido(s) atualizado(s)!`)
      setSelected(new Set())
      loadOrders()
    } catch { toast.error('Erro ao atualizar em lote') }
    finally { setBulkUpdating(false) }
  }

  const toggleSelect = (rawId: string) => {
    const next = new Set(selected)
    next.has(rawId) ? next.delete(rawId) : next.add(rawId)
    setSelected(next)
  }

  const toggleSelectAll = () => {
    if (selected.size === orders.length) setSelected(new Set())
    else setSelected(new Set(orders.map((o) => o.rawId)))
  }

  const todayOrders = orders.filter((o) =>
    new Date(o.createdAt).toDateString() === new Date().toDateString()
  )
  const todayTotal = todayOrders
    .filter((o) => o.rawStatus !== 'cancelled')
    .reduce((sum, o) => sum + o.rawTotal, 0)

  return (
    <div className="space-y-6 min-h-full bg-slate-50 dark:bg-[#09090b]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pedidos</h1>
          <p className="text-sm text-slate-500 mt-1">
            Hoje: {todayOrders.length} pedidos · R$ {todayTotal.toFixed(2).replace('.', ',')}
          </p>
        </div>
        <button onClick={loadOrders} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-[#3f3f46] transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => { setActiveStatus(s.key); setPage(1); setSelected(new Set()) }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm whitespace-nowrap transition-colors ${
              activeStatus === s.key
                ? 'bg-orange-600 text-white'
                : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] text-slate-600 dark:text-slate-400 hover:border-orange-300'
            }`}
          >
            <s.icon className="w-4 h-4" />
            {s.label}
            {s.key && counts[s.key] > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${
                activeStatus === s.key ? 'bg-white/20' : 'bg-slate-100 dark:bg-[#262626]'
              }`}>{counts[s.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search + Bulk Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" placeholder="Buscar por nome, telefone ou ID..."
            value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{selected.size} selecionado(s)</span>
            <button onClick={toggleSelectAll} className="text-xs text-orange-600 hover:underline">limpar</button>
            {STATUSES.filter((s) => s.key).map((s) => (
              <button key={s.key} onClick={() => bulkUpdate(s.key)} disabled={bulkUpdating}
                className={`px-3 py-2 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50 ${
                  s.key === 'cancelled' ? 'bg-red-600 hover:bg-red-700' :
                  s.key === 'completed' ? 'bg-emerald-600 hover:bg-emerald-700' :
                  s.key === 'preparing' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Order List */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626]">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Nenhum pedido encontrado</h3>
          <p className="text-slate-500 text-sm">Os pedidos aparecerão aqui quando forem realizados pela loja.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#262626] text-sm text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 w-10">
                  <input type="checkbox" checked={selected.size === orders.length && orders.length > 0}
                    onChange={toggleSelectAll} className="rounded border-slate-300" />
                </th>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Cliente</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Itens</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#262626]">
              {orders.map((o) => (
                <tr key={o.rawId} className={`hover:bg-slate-50 dark:hover:bg-[#18181b]/50 transition-colors ${selected.has(o.rawId) ? 'bg-orange-50 dark:bg-orange-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(o.rawId)}
                      onChange={() => toggleSelect(o.rawId)} className="rounded border-slate-300" />
                  </td>
                  <td className="px-4 py-3 cursor-pointer" onClick={() => loadOrderDetail(o.rawId)}>
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{o.id}</p>
                    <p className="text-xs text-slate-500">{new Date(o.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{o.customer}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {o.phone}</p>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xs truncate">
                      {o.items.join(', ')}
                    </p>
                    <p className="text-xs text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {o.address}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-bold text-slate-900 dark:text-white">{o.total}</p>
                    {o.rating && (
                      <div className="flex items-center justify-end gap-0.5 mt-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <svg key={n} className={`w-3 h-3 ${n <= o.rating! ? 'text-yellow-400' : 'text-slate-300 dark:text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    )}
                    {o.paymentMethod && (
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        <span className="text-xs text-slate-500">{o.paymentMethod}</span>
                        {o.paymentMethod === 'pix' && o.mpPaymentStatus && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            o.mpPaymentStatus === 'approved'
                              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                              : 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {o.mpPaymentStatus === 'approved' ? '✓ Pago' : 'Pendente'}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.rawStatus]}`}>
                        {o.status}
                      </span>
                      <div className="flex gap-1">
                        {(NEXT_STATUS[o.rawStatus] || []).map((ns) => (
                          <button key={ns.status} onClick={() => updateStatus(o.rawId, ns.status)}
                            className="px-2 py-0.5 text-[10px] font-medium rounded border border-slate-200 dark:border-[#3f3f46] hover:bg-slate-100 dark:hover:bg-[#262626] text-slate-600 dark:text-slate-400"
                            title={ns.label}>{ns.label}</button>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">{total} pedido(s)</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-lg text-sm disabled:opacity-50">Anterior</button>
            <span className="text-sm text-slate-500">Pág {page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-lg text-sm disabled:opacity-50">Próxima</button>
          </div>
        </div>
      )}

      {/* Order Detail Sidebar */}
      {showDetail && detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm" onClick={() => setShowDetail(false)}>
          <motion.div
            initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }}
            className="bg-white dark:bg-[#18181B] w-full max-w-md h-full overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white dark:bg-[#18181B] border-b border-slate-200 dark:border-[#262626] p-5 z-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{detail.id}</h2>
                  <p className="text-xs text-slate-500">
                    {new Date(detail.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
                <button onClick={() => setShowDetail(false)} className="p-2 text-slate-400 hover:text-slate-600"><XCircle className="w-5 h-5" /></button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[detail.rawStatus]}`}>
                  {detail.status}
                </span>
                {(NEXT_STATUS[detail.rawStatus] || []).map((ns) => (
                  <button key={ns.status} onClick={() => updateStatus(detail.rawId, ns.status)}
                    className="px-3 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-[#3f3f46] hover:bg-slate-100 dark:hover:bg-[#262626]">
                    {ns.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Customer */}
              <div className="bg-slate-50 dark:bg-[#09090b] rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cliente</h3>
                <p className="font-bold text-slate-900 dark:text-white">{detail.customer}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                  <Phone className="w-4 h-4" /> {detail.phone}
                </p>
                {detail.address !== 'Retirada no Local' && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {detail.address}
                  </p>
                )}
                {detail.paymentMethod && (
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> {detail.paymentMethod}
                    </p>
                    {detail.mpPaymentStatus && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        detail.mpPaymentStatus === 'approved'
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                          : detail.mpPaymentStatus === 'pending'
                            ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400'
                            : 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                      }`}>
                        {detail.mpPaymentStatus === 'approved' ? 'Pago' : detail.mpPaymentStatus === 'pending' ? 'Pendente' : detail.mpPaymentStatus}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Items */}
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Itens do Pedido</h3>
                <div className="space-y-3">
                  {detail.items.map((item, i) => (
                    <div key={i} className="bg-slate-50 dark:bg-[#09090b] rounded-xl p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white text-sm">
                            {item.quantity}x {item.productName}
                          </p>
                          {item.notes && <p className="text-xs text-slate-500 mt-1">Obs: {item.notes}</p>}
                        </div>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          R$ {(item.unitPrice * item.quantity).toFixed(2).replace('.', ',')}
                        </p>
                      </div>
                      {(item.components.length > 0 || item.choices.length > 0) && (
                        <div className="mt-2 pl-3 border-l-2 border-slate-200 dark:border-[#3f3f46] space-y-1">
                          {item.components.map((c, j) => (
                            <p key={j} className="text-xs text-slate-500">
                              + {c.quantity}x {c.name} {c.unitPrice > 0 && `(R$ ${c.unitPrice.toFixed(2).replace('.', ',')})`}
                            </p>
                          ))}
                          {item.choices.map((ch, j) => (
                            <p key={j} className="text-xs text-slate-500">
                              {ch.groupName}: {ch.quantity}x {ch.optionName} {ch.unitPrice > 0 && `(R$ ${ch.unitPrice.toFixed(2).replace('.', ',')})`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-slate-200 dark:border-[#262626] pt-4 flex justify-between items-center">
                <span className="text-lg font-bold text-slate-900 dark:text-white">Total</span>
                <span className="text-2xl font-extrabold text-orange-600 dark:text-orange-500">{detail.total}</span>
              </div>
              {detail.rating && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-slate-500">Avaliação:</span>
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <svg key={n} className={`w-4 h-4 ${n <= detail.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 dark:text-slate-600'}`} viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
