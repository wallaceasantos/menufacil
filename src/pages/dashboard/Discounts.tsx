import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Tag, Plus, Edit3, Trash2, Loader2, X, Save, Ticket, CheckCircle2, XCircle,
  Percent, DollarSign, Calendar, ShoppingBag, Hash, Copy, Check,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { apiWithTenant } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

interface Discount {
  id: string
  code: string
  discountType: string
  value: number
  minOrderAmount: number | null
  maxUses: number | null
  usedCount: number
  startsAt: string
  expiresAt: string | null
  isActive: boolean
  appliesTo: string
  appliesToIds: string | null
}

const APPLIES_TO_LABELS: Record<string, string> = {
  all: 'Todo o cardápio',
  categories: 'Categorias específicas',
  products: 'Produtos específicos',
}

const emptyForm = {
  code: '',
  discountType: 'percentage',
  value: 10,
  minOrderAmount: 0,
  maxUses: 0,
  startsAt: new Date().toISOString().split('T')[0],
  expiresAt: '',
  isActive: true,
  appliesTo: 'all',
  appliesToIds: '',
}

export function Discounts() {
  const { user } = useAuth()
  const slug = getTenantSlug(user)

  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Discount | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  useEffect(() => { loadDiscounts() }, [])

  const loadDiscounts = async () => {
    setLoading(true)
    try {
      const resp = await apiWithTenant<{ discounts: Discount[] }>('/discounts', slug)
      setDiscounts(resp.discounts || [])
    } catch { toast.error('Erro ao carregar cupons') }
    finally { setLoading(false) }
  }

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (d: Discount) => {
    setEditing(d)
    setForm({
      code: d.code, discountType: d.discountType, value: Number(d.value),
      minOrderAmount: d.minOrderAmount ? Number(d.minOrderAmount) : 0,
      maxUses: d.maxUses || 0, startsAt: d.startsAt.split('T')[0],
      expiresAt: d.expiresAt ? d.expiresAt.split('T')[0] : '',
      isActive: d.isActive, appliesTo: d.appliesTo, appliesToIds: d.appliesToIds || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.code.trim()) { toast.error('Código do cupom é obrigatório'); return }
    if (form.value <= 0) { toast.error('Valor do desconto inválido'); return }
    if (form.discountType === 'percentage' && form.value > 100) { toast.error('Percentual não pode exceder 100%'); return }

    setSaving(true)
    try {
      const payload = {
        ...form,
        maxUses: form.maxUses > 0 ? form.maxUses : null,
        expiresAt: form.expiresAt || null,
        appliesToIds: form.appliesTo !== 'all' ? form.appliesToIds : null,
      }
      if (editing) {
        await apiWithTenant(`/discounts/${editing.id}`, slug, { method: 'PATCH', body: JSON.stringify(payload) })
        toast.success('Cupom atualizado!')
      } else {
        await apiWithTenant('/discounts', slug, { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Cupom criado!')
      }
      setShowModal(false)
      loadDiscounts()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este cupom?')) return
    try {
      await apiWithTenant(`/discounts/${id}`, slug, { method: 'DELETE' })
      loadDiscounts()
      toast.success('Removido')
    } catch { toast.error('Erro ao remover') }
  }

  const handleToggle = async (d: Discount) => {
    try {
      await apiWithTenant(`/discounts/${d.id}`, slug, { method: 'PATCH', body: JSON.stringify({ isActive: !d.isActive }) })
      loadDiscounts()
    } catch { toast.error('Erro ao atualizar') }
  }

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(code)
    toast.success('Código copiado!')
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const now = new Date()
  const formatDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')

  return (
    <div className="space-y-6 min-h-full bg-slate-50 dark:bg-[#09090b]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cupons de Desconto</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Crie cupons para atrair mais clientes e aumentar as vendas
          </p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-colors">
          <Plus className="w-5 h-5" /> Novo Cupom
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>
      ) : discounts.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626]">
          <Ticket className="w-14 h-14 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhum cupom criado</p>
          <p className="text-xs text-slate-400 mt-1">Crie cupons de desconto percentual ou valor fixo</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {discounts.map((d, i) => {
            const isExpired = d.expiresAt && new Date(d.expiresAt) < now
            const isUpcoming = new Date(d.startsAt) > now
            const isExhausted = d.maxUses && d.usedCount >= d.maxUses
            const isActive = d.isActive && !isExpired && !isUpcoming && !isExhausted

            let statusBadge = null
            if (!d.isActive) statusBadge = { label: 'Inativo', color: 'bg-slate-100 dark:bg-slate-500/10 text-slate-500', icon: XCircle }
            else if (isExpired) statusBadge = { label: 'Expirado', color: 'bg-red-100 dark:bg-red-500/10 text-red-600', icon: XCircle }
            else if (isUpcoming) statusBadge = { label: 'Agendado', color: 'bg-blue-100 dark:bg-blue-500/10 text-blue-600', icon: Calendar }
            else if (isExhausted) statusBadge = { label: 'Esgotado', color: 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600', icon: Hash }
            else statusBadge = { label: 'Ativo', color: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600', icon: CheckCircle2 }

            const BadgeIcon = statusBadge.icon
            const discountLabel = d.discountType === 'percentage'
              ? `${Number(d.value)}% OFF`
              : `R$ ${Number(d.value).toFixed(2).replace('.', ',')} OFF`

            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-white dark:bg-[#121214] border rounded-2xl p-5 transition-all ${isActive ? 'border-orange-200 dark:border-orange-500/20' : 'border-slate-200 dark:border-[#262626]'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isActive ? 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'bg-slate-100 dark:bg-slate-500/10 text-slate-400'}`}>
                      {d.discountType === 'percentage' ? <Percent className="w-5 h-5" /> : <DollarSign className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white">{d.code}</h3>
                        <button onClick={() => copyCode(d.code)} className="p-0.5 text-slate-400 hover:text-orange-500">
                          {copiedCode === d.code ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">{APPLIES_TO_LABELS[d.appliesTo] || 'Todo o cardápio'}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${statusBadge.color}`}>
                    <BadgeIcon className="w-3 h-3" /> {statusBadge.label}
                  </span>
                </div>

                <div className="bg-slate-50 dark:bg-[#09090b] rounded-xl p-4 mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Desconto</span>
                    <span className="text-sm font-extrabold text-orange-600 dark:text-orange-500">{discountLabel}</span>
                  </div>
                  {d.minOrderAmount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Pedido mínimo</span>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">R$ {Number(d.minOrderAmount).toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Válido</span>
                    <span className="text-xs text-slate-600 dark:text-slate-300">
                      {formatDate(d.startsAt)} {d.expiresAt ? `→ ${formatDate(d.expiresAt)}` : '• sem prazo'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Usos</span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white">{d.usedCount}{d.maxUses ? ` / ${d.maxUses}` : ''}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(d)} title={d.isActive ? 'Desativar' : 'Ativar'}
                    className={`p-2 rounded-lg transition-colors ${d.isActive ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-500/10'}`}>
                    {d.isActive ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(d)} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-lg transition-colors">
                    <Edit3 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button onClick={() => handleDelete(d.id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white dark:bg-[#18181B] border-b border-slate-200 dark:border-[#262626] p-5 flex items-center justify-between z-10">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{editing ? 'Editar Cupom' : 'Novo Cupom'}</h2>
                <button onClick={() => setShowModal(false)} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código do cupom</label>
                  <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: PROMO10" className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 font-bold tracking-wider text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                  <p className="text-xs text-slate-400 mt-1">O cliente usará este código no checkout</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de desconto</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'percentage', label: 'Percentual (%)', icon: Percent },
                      { key: 'fixed', label: 'Valor fixo (R$)', icon: DollarSign },
                    ].map((opt) => {
                      const Icon = opt.icon
                      return (
                        <button key={opt.key} type="button" onClick={() => setForm({ ...form, discountType: opt.key })}
                          className={`p-3 rounded-xl border-2 flex items-center gap-2 transition-colors ${
                            form.discountType === opt.key ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                          }`}>
                          <Icon className={`w-5 h-5 ${form.discountType === opt.key ? 'text-orange-500' : 'text-slate-400'}`} />
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{opt.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Valor {form.discountType === 'percentage' ? '(%)' : '(R$)'}
                  </label>
                  <input type="number" min={0} max={form.discountType === 'percentage' ? 100 : 99999} step="0.01"
                    value={form.value} onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pedido mínimo (R$)</label>
                    <input type="number" min={0} step="0.01" value={form.minOrderAmount || ''}
                      onChange={(e) => setForm({ ...form, minOrderAmount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Limite de usos</label>
                    <input type="number" min={0} placeholder="Ilimitado" value={form.maxUses || ''}
                      onChange={(e) => setForm({ ...form, maxUses: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Início</label>
                    <input type="date" value={form.startsAt}
                      onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Expira (opcional)</label>
                    <input type="date" value={form.expiresAt}
                      onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Aplicar em</label>
                  <select value={form.appliesTo}
                    onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500">
                    <option value="all">Todo o cardápio</option>
                    <option value="categories">Categorias específicas</option>
                    <option value="products">Produtos específicos</option>
                  </select>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#09090b] rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">Cupom ativo</p>
                    <p className="text-xs text-slate-500">Inativos não podem ser usados por clientes</p>
                  </div>
                  <button type="button" onClick={() => setForm({ ...form, isActive: !form.isActive })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-orange-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>

              <div className="sticky bottom-0 bg-white dark:bg-[#18181B] border-t border-slate-200 dark:border-[#262626] p-5 flex gap-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-[#3f3f46]">Cancelar</button>
                <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Salvando...' : editing ? 'Atualizar' : 'Criar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
