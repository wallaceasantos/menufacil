import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingBag, BarChart3,
  Loader2, Download, Calendar, Users, Award, XCircle, Package,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { apiWithTenant, apiWithTenantBlob } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'
import { useAuth } from '../../contexts/AuthContext'

type Period = 'today' | 'yesterday' | '7days' | '30days' | '90days' | 'custom'

interface Summary {
  totalOrders: number
  totalRevenue: number
  ticketMedio: number
  cancelledOrders: number
  cancellationRate: number
  revenueChange: number
  ordersChange: number
}

interface SalesByDay {
  date: string
  value: number
  orders: number
}

interface TopProduct {
  name: string
  quantity: number
  revenue: number
}

interface PaymentMethod {
  method: string
  count: number
  value: number
}

interface StatusDistribution {
  status: string
  count: number
}

interface TopCustomer {
  name: string
  phone: string
  orders: number
  spent: number
}

interface Weekday {
  day: number
  name: string
  orders: number
  revenue: number
}

interface Hour {
  hour: number
  orders: number
  revenue: number
}

interface ReportData {
  period: { from: string; to: string; type: string }
  summary: Summary
  salesByDay: SalesByDay[]
  topProducts: TopProduct[]
  paymentMethods: PaymentMethod[]
  statusDistribution: StatusDistribution[]
  topCustomers: TopCustomer[]
  byWeekday: Weekday[]
  byHour: Hour[]
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Hoje',
  yesterday: 'Ontem',
  '7days': 'Últimos 7 dias',
  '30days': 'Últimos 30 dias',
  '90days': 'Últimos 90 dias',
  custom: 'Período personalizado',
}

const PIE_COLORS = ['#f97316', '#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16']

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  preparing: 'Preparando',
  completed: 'Concluído',
  cancelled: 'Cancelado',
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  preparing: '#3b82f6',
  completed: '#10b981',
  cancelled: '#ef4444',
}

export function Reports() {
  const { user } = useAuth()
  const tenantSlug = getTenantSlug(user)

  const [period, setPeriod] = useState<Period>('30days')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReport()
  }, [period])

  const loadReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period })
      if (period === 'custom' && customFrom && customTo) {
        params.set('from', customFrom)
        params.set('to', customTo)
      }
      const report = await apiWithTenant<ReportData>(`/reports?${params}`, tenantSlug)
      setData(report)
    } catch (err) {
      toast.error('Erro ao carregar relatório')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ period })
      if (period === 'custom' && customFrom && customTo) {
        params.set('from', customFrom)
        params.set('to', customTo)
      }
      const blob = await apiWithTenantBlob(`/reports/export?${params}`, tenantSlug)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `relatorio-pedidos-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      toast.success('Relatório exportado!')
    } catch {
      toast.error('Erro ao exportar')
    }
  }

  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2).replace('.', ',')}`
  }

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00')
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!data) return null

  const { summary, salesByDay, topProducts, paymentMethods, statusDistribution, topCustomers, byWeekday, byHour } = data

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Relatórios</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Análise completa do seu desempenho
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-medium shadow-lg shadow-orange-900/20 transition-colors"
        >
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Period Filter */}
      <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-400 mr-2" />
          {(['today', 'yesterday', '7days', '30days', '90days', 'custom'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-orange-600 text-white'
                  : 'bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46]'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-2">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-2 bg-slate-100 dark:bg-[#262626] border border-slate-200 dark:border-[#3f3f46] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <span className="text-slate-400 text-sm">até</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-2 bg-slate-100 dark:bg-[#262626] border border-slate-200 dark:border-[#3f3f46] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <button
                onClick={loadReport}
                disabled={!customFrom || !customTo || loading}
                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Aplicar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            </div>
            {summary.revenueChange !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-bold ${
                summary.revenueChange > 0
                  ? 'text-emerald-600 dark:text-emerald-500'
                  : 'text-red-600 dark:text-red-500'
              }`}>
                {summary.revenueChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(summary.revenueChange).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Faturamento</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(summary.totalRevenue)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-500/10 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-blue-600 dark:text-blue-500" />
            </div>
            {summary.ordersChange !== 0 && (
              <span className={`flex items-center gap-0.5 text-xs font-bold ${
                summary.ordersChange > 0
                  ? 'text-emerald-600 dark:text-emerald-500'
                  : 'text-red-600 dark:text-red-500'
              }`}>
                {summary.ordersChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(summary.ordersChange).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Pedidos</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary.totalOrders}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-500/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ticket Médio</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {formatCurrency(summary.ticketMedio)}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-5"
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-500" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Cancelamentos</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            {summary.cancelledOrders}
            <span className="text-sm text-slate-500 dark:text-slate-400 ml-2 font-normal">
              ({summary.cancellationRate.toFixed(1)}%)
            </span>
          </p>
        </motion.div>
      </div>

      {/* Sales by Day Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Faturamento por Dia</h2>
        {salesByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesByDay.map((d) => ({ ...d, label: formatShortDate(d.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-[#262626]" />
              <XAxis dataKey="label" stroke="#94a3b8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} tickFormatter={(v) => `R$${v.toFixed(0)}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#18181b',
                  border: '1px solid #262626',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }} name="Faturamento" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            Sem dados no período selecionado
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-orange-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Produtos Mais Vendidos</h2>
          </div>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const max = topProducts[0]?.quantity || 1
                const pct = (p.quantity / max) * 100
                return (
                  <div key={p.name}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-slate-900 dark:text-white truncate">{p.name}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{p.quantity}x</p>
                        <p className="text-xs text-slate-500">{formatCurrency(p.revenue)}</p>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-[#262626] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">Sem dados</div>
          )}
        </motion.div>

        {/* Payment Methods */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Formas de Pagamento</h2>
          </div>
          {paymentMethods.length > 0 ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={paymentMethods}
                    dataKey="value"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                  >
                    {paymentMethods.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#18181b',
                      border: '1px solid #262626',
                      borderRadius: '12px',
                      color: '#fff',
                    }}
                    formatter={(value: any) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 w-full sm:w-auto sm:min-w-[160px]">
                {paymentMethods.map((m, i) => (
                  <div key={m.method} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-slate-700 dark:text-slate-300 flex-1 truncate">{m.method}</span>
                    <span className="font-bold text-slate-900 dark:text-white">{m.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">Sem dados</div>
          )}
        </motion.div>

        {/* By Weekday */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Vendas por Dia da Semana</h2>
          </div>
          {byWeekday.some((w) => w.orders > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byWeekday}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-[#262626]" />
                <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #262626',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  formatter={(value: any, name: any) => name === 'revenue' ? formatCurrency(value) : value}
                />
                <Bar dataKey="orders" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">Sem dados</div>
          )}
        </motion.div>

        {/* By Hour */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-purple-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Horários de Pico</h2>
          </div>
          {byHour.some((h) => h.orders > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byHour}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-[#262626]" />
                <XAxis dataKey="hour" stroke="#94a3b8" style={{ fontSize: '11px' }} tickFormatter={(h) => `${h}h`} />
                <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #262626',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  labelFormatter={(h) => `${h}h - ${(h as number) + 1}h`}
                />
                <Bar dataKey="orders" fill="#a855f7" radius={[6, 6, 0, 0]} name="Pedidos" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-slate-500 dark:text-slate-400">Sem dados</div>
          )}
        </motion.div>
      </div>

      {/* Status Distribution */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Status dos Pedidos</h2>
        {statusDistribution.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {statusDistribution.map((s) => {
              const total = statusDistribution.reduce((sum, x) => sum + x.count, 0)
              const pct = total > 0 ? (s.count / total) * 100 : 0
              return (
                <div key={s.status} className="p-4 bg-slate-50 dark:bg-[#09090b] rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[s.status] || '#94a3b8' }}
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {STATUS_LABELS[s.status] || s.status}
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.count}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{pct.toFixed(1)}% do total</p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">Sem dados</div>
        )}
      </motion.div>

      {/* Top Customers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-200 dark:border-[#262626] flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Top Clientes</h2>
        </div>
        {topCustomers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-[#09090b] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="text-left px-6 py-3 font-medium">#</th>
                  <th className="text-left px-6 py-3 font-medium">Cliente</th>
                  <th className="text-left px-6 py-3 font-medium">Telefone</th>
                  <th className="text-right px-6 py-3 font-medium">Pedidos</th>
                  <th className="text-right px-6 py-3 font-medium">Total Gasto</th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((c, i) => (
                  <tr
                    key={`${c.phone}-${i}`}
                    className="border-t border-slate-100 dark:border-[#262626] hover:bg-slate-50 dark:hover:bg-[#09090b] transition-colors"
                  >
                    <td className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold">
                      {i + 1}
                    </td>
                    <td className="px-6 py-3 text-slate-900 dark:text-white font-medium">
                      {c.name}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {c.phone}
                    </td>
                    <td className="px-6 py-3 text-right text-slate-900 dark:text-white">
                      {c.orders}
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-emerald-600 dark:text-emerald-500">
                      {formatCurrency(c.spent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 dark:text-slate-400">
            <Package className="w-12 h-12 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
            <p>Nenhum cliente registrado no período</p>
          </div>
        )}
      </motion.div>
    </div>
  )
}
