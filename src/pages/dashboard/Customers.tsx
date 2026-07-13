import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  Users, Search, Phone, Mail, Star, Ban, ChevronRight, MessageCircle,
  Clock, ShoppingBag, DollarSign, Crown, UserPlus, X, RefreshCw,
  ArrowUpRight, Loader2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { FeatureGate } from '../../components/FeatureGate'
import { api } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

interface Customer {
  id: string
  name: string
  phone: string
  email: string | null
  notes: string | null
  totalOrders: number
  totalSpent: number
  isBlocked: boolean
  isVip: boolean
  createdAt: string
  updatedAt: string
}

interface CustomerStats {
  total: number
  vipCount: number
  blockedCount: number
  totalSpent: number
  topCustomers: { id: string; name: string; totalOrders: number; totalSpent: number }[]
}

interface OrderHistory {
  id: string
  customerName: string
  status: string
  totalAmount: number
  paymentMethod: string | null
  createdAt: string
  items: { productName?: string; quantity: number; unitPrice: number }[]
}

export function Customers() {
  const { user } = useAuth()
  const isCompleto = user?.plan === 'completo'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const [stats, setStats] = useState<CustomerStats | null>(null)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerOrders, setCustomerOrders] = useState<OrderHistory[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [showDetail, setShowDetail] = useState(false)

  const [editMode, setEditMode] = useState(false)
  const [editData, setEditData] = useState({ name: '', email: '', notes: '', isVip: false, isBlocked: false })

  useEffect(() => { loadCustomers(); loadStats() }, [page, search])

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const slug = getTenantSlug(user!)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      const data = await api(`/customers?${params}`, { headers: { 'x-tenant-slug': slug } }) as any
      setCustomers(data.data)
      setTotal(data.total)
    } catch { toast.error('Erro ao carregar clientes') }
    finally { setLoading(false) }
  }

  const loadStats = async () => {
    if (!isCompleto) return
    try {
      const slug = getTenantSlug(user!)
      const data = await api('/customers/stats', { headers: { 'x-tenant-slug': slug } }) as CustomerStats
      setStats(data)
    } catch { }
  }

  const loadCustomerOrders = async (customerId: string) => {
    setLoadingOrders(true)
    try {
      const slug = getTenantSlug(user!)
      const data = await api(`/customers/${customerId}/orders`, { headers: { 'x-tenant-slug': slug } }) as OrderHistory[]
      setCustomerOrders(data)
    } catch { setCustomerOrders([]) }
    finally { setLoadingOrders(false) }
  }

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer)
    setEditData({ name: customer.name, email: customer.email || '', notes: customer.notes || '', isVip: customer.isVip, isBlocked: customer.isBlocked })
    setEditMode(false)
    setShowDetail(true)
    loadCustomerOrders(customer.id)
  }

  const handleSave = async () => {
    if (!selectedCustomer) return
    try {
      const slug = getTenantSlug(user!)
      const updated = await api(`/customers/${selectedCustomer.id}`, {
        method: 'PATCH',
        headers: { 'x-tenant-slug': slug },
        body: JSON.stringify(editData),
      }) as Customer
      setSelectedCustomer(updated)
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setEditMode(false)
      toast.success('Cliente atualizado!')
    } catch { toast.error('Erro ao atualizar') }
  }

  const handleBlock = async (customer: Customer) => {
    try {
      const slug = getTenantSlug(user!)
      const updated = await api(`/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'x-tenant-slug': slug },
        body: JSON.stringify({ isBlocked: !customer.isBlocked }),
      }) as Customer
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      if (selectedCustomer?.id === updated.id) setSelectedCustomer(updated)
      toast.success(customer.isBlocked ? 'Cliente desbloqueado!' : 'Cliente bloqueado!')
    } catch { toast.error('Erro ao alterar bloqueio') }
  }

  const handleToggleVip = async (customer: Customer) => {
    try {
      const slug = getTenantSlug(user!)
      const updated = await api(`/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'x-tenant-slug': slug },
        body: JSON.stringify({ isVip: !customer.isVip }),
      }) as Customer
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      if (selectedCustomer?.id === updated.id) setSelectedCustomer(updated)
      loadStats()
      toast.success(customer.isVip ? 'Tag VIP removida' : 'Cliente marcado como VIP!')
    } catch { toast.error('Erro ao alterar VIP') }
  }

  const openWhatsApp = (phone: string) => {
    window.open(`https://wa.me/55${phone.replace(/\D/g, '')}`, '_blank')
  }

  const statusLabel: Record<string, string> = {
    pending: 'Pendente', preparing: 'Preparando', completed: 'Concluído', cancelled: 'Cancelado',
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Clientes</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie seus clientes e acompanhe o histórico de pedidos</p>
        </div>
        <button onClick={() => loadCustomers().then(loadStats)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-[#3f3f46] transition-colors">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </button>
      </div>

      <FeatureGate featureId="customer-crm" fallback={null}>
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Clientes', value: stats.total, icon: Users, color: 'blue' },
              { label: 'Clientes VIP', value: stats.vipCount, icon: Crown, color: 'amber' },
              { label: 'Bloqueados', value: stats.blockedCount, icon: Ban, color: 'red' },
              { label: 'Total Gasto', value: `R$ ${stats.totalSpent.toFixed(2).replace('.', ',')}`, icon: DollarSign, color: 'emerald' },
            ].map((card) => (
              <div key={card.label} className="bg-white dark:bg-[#121214] p-4 rounded-2xl border border-slate-200 dark:border-[#262626]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">{card.label}</span>
                  <div className={`w-8 h-8 rounded-full bg-${card.color}-50 dark:bg-${card.color}-500/10 flex items-center justify-center`}>
                    <card.icon className={`w-4 h-4 text-${card.color}-600 dark:text-${card.color}-500`} />
                  </div>
                </div>
                <p className="text-xl font-bold text-slate-900 dark:text-white">{card.value}</p>
              </div>
            ))}
          </div>
        )}

        {(stats?.topCustomers?.length ?? 0) > 0 && (
          <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" /> Top Clientes
            </h3>
            <div className="grid gap-3">
              {stats?.topCustomers?.map((tc, i) => (
                <div key={tc.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#18181b] rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm">{tc.name}</p>
                      <p className="text-xs text-slate-500">{tc.totalOrders} pedidos</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {tc.totalSpent.toFixed(2).replace('.', ',')}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </FeatureGate>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text" placeholder="Buscar por nome ou telefone..."
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626]">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Nenhum cliente encontrado</h3>
          <p className="text-slate-500 text-sm">Os clientes são cadastrados automaticamente ao fazerem pedidos pela loja.</p>
        </div>
      ) : (
        <>
          <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#262626] text-sm text-slate-500 dark:text-slate-400">
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium hidden sm:table-cell">Contato</th>
                  <th className="px-4 py-3 font-medium text-center">Pedidos</th>
                  <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Total Gasto</th>
                  <th className="px-4 py-3 font-medium text-center hidden sm:table-cell">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-[#262626]">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-[#18181b]/50 transition-colors cursor-pointer" onClick={() => openDetail(c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {c.isVip && <Star className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />}
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white text-sm">{c.name}</p>
                          {c.isBlocked && <span className="text-xs text-red-500">Bloqueado</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-sm text-slate-500">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-semibold text-slate-900 dark:text-white">{c.totalOrders}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden md:table-cell">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">R$ {c.totalSpent.toFixed(2).replace('.', ',')}</span>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        {c.isVip && <Crown className="w-4 h-4 text-amber-500" />}
                        {c.isBlocked && <Ban className="w-4 h-4 text-red-500" />}
                        {!c.isVip && !c.isBlocked && <span className="text-xs text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => openWhatsApp(c.phone)} title="WhatsApp" className="p-2 text-slate-400 hover:text-emerald-500 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
                          <MessageCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => openDetail(c)} title="Detalhes" className="p-2 text-slate-400 hover:text-orange-500 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-4 py-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl text-sm disabled:opacity-50">Anterior</button>
              <span className="text-sm text-slate-500">Página {page} de {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="px-4 py-2 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl text-sm disabled:opacity-50">Próximo</button>
            </div>
          )}
        </>
      )}

      {/* Detail Modal */}
      {showDetail && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetail(false)}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#262626]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-lg">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  {editMode ? (
                    <input value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="text-lg font-bold bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-lg px-2 py-1 w-full" />
                  ) : (
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selectedCustomer.name}</h2>
                  )}
                  <p className="text-sm text-slate-500">{selectedCustomer.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowDetail(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(90vh-120px)] space-y-5">
              {/* Info Section */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Pedidos', value: selectedCustomer.totalOrders, icon: ShoppingBag },
                  { label: 'Total Gasto', value: `R$ ${selectedCustomer.totalSpent.toFixed(2).replace('.', ',')}`, icon: DollarSign },
                  { label: isCompleto ? (selectedCustomer.isVip ? 'VIP' : 'Normal') : '—', value: selectedCustomer.isVip ? 'Sim' : 'Não', icon: Crown },
                  { label: isCompleto ? (selectedCustomer.isBlocked ? 'Bloqueado' : 'Ativo') : '—', value: selectedCustomer.isBlocked ? 'Sim' : 'Não', icon: Ban },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 dark:bg-[#18181b] rounded-xl p-3 text-center">
                    <item.icon className="w-4 h-4 text-slate-400 mx-auto mb-1" />
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="font-bold text-slate-900 dark:text-white text-sm">{item.value}</p>
                  </div>
                ))}
              </div>

              {isCompleto && editMode && (
                <div className="space-y-3 bg-slate-50 dark:bg-[#18181b] rounded-xl p-4">
                  <div>
                    <label className="text-xs text-slate-500">Email</label>
                    <input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-lg p-2 text-sm mt-1" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Observações</label>
                    <textarea value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                      className="w-full bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-lg p-2 text-sm mt-1 h-20 resize-none" />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editData.isVip} onChange={(e) => setEditData({ ...editData, isVip: e.target.checked })}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                      <span className="text-sm font-medium flex items-center gap-1"><Crown className="w-4 h-4 text-amber-500" /> VIP</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={editData.isBlocked} onChange={(e) => setEditData({ ...editData, isBlocked: e.target.checked })}
                        className="rounded border-slate-300 text-red-500 focus:ring-red-500" />
                      <span className="text-sm font-medium flex items-center gap-1"><Ban className="w-4 h-4 text-red-500" /> Bloqueado</span>
                    </label>
                  </div>
                </div>
              )}

              {isCompleto && selectedCustomer.notes && !editMode && (
                <div className="bg-amber-50 dark:bg-amber-500/5 border border-amber-200 dark:border-amber-500/20 rounded-xl p-3">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-1">Observações</p>
                  <p className="text-sm text-amber-800 dark:text-amber-300">{selectedCustomer.notes}</p>
                </div>
              )}

              {/* Actions */}
              <FeatureGate featureId="customer-crm" fallback={<div className="text-xs text-slate-400 text-center py-2">Upgrade para o plano Completo para editar clientes</div>}>
                <div className="flex gap-2">
                  {!editMode ? (
                    <>
                      <button onClick={() => setEditMode(true)} className="flex-1 py-2 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-[#3f3f46]">Editar</button>
                      <button onClick={() => handleToggleVip(selectedCustomer)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${selectedCustomer.isVip ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300'}`}>
                        {selectedCustomer.isVip ? 'Remover VIP' : 'Marcar VIP'}
                      </button>
                      <button onClick={() => handleBlock(selectedCustomer)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium ${selectedCustomer.isBlocked ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                        {selectedCustomer.isBlocked ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => setEditMode(false)} className="flex-1 py-2 bg-slate-100 dark:bg-[#262626] rounded-lg text-sm">Cancelar</button>
                      <button onClick={handleSave} className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium">Salvar</button>
                    </>
                  )}
                  <button onClick={() => openWhatsApp(selectedCustomer.phone)} className="p-2 bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg"><MessageCircle className="w-5 h-5" /></button>
                </div>
              </FeatureGate>

              {/* Order History */}
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Histórico de Pedidos
                </h3>
                {loadingOrders ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-orange-500" /></div>
                ) : customerOrders.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhum pedido encontrado</p>
                ) : (
                  <div className="space-y-2">
                    {customerOrders.map((o) => (
                      <div key={o.id} className="bg-slate-50 dark:bg-[#18181b] rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-slate-900 dark:text-white">#{o.id.slice(0, 8)}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                              o.status === 'completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
                              o.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400' :
                              'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
                            }`}>{statusLabel[o.status] || o.status}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            {o.items.slice(0, 3).map((i) => i.productName || `${i.quantity}x item`).join(', ')}
                            {o.items.length > 3 && ` +${o.items.length - 3}`}
                          </p>
                          <p className="text-xs text-slate-400">{new Date(o.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">R$ {o.totalAmount.toFixed(2).replace('.', ',')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Info for basic plan users */}
      {!isCompleto && (
        <div className="bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#262626] rounded-xl p-4 text-center">
          <Crown className="w-8 h-8 text-orange-400 mx-auto mb-2" />
          <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">Recursos avançados do CRM disponíveis no plano Completo</p>
          <p className="text-xs text-slate-500 mt-1">VIP, bloqueio, notas e estatísticas de clientes</p>
        </div>
      )}
    </div>
  )
}
