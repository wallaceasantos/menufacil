import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Banknote, CreditCard, QrCode, Save, Store, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { api, apiWithTenant } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

interface PaymentConfig {
  pixEnabled: boolean
  cashEnabled: boolean
  cardEnabled: boolean
}

export function PaymentSettings() {
  const { user } = useAuth()
  const tenantSlug = getTenantSlug(user)
  const [config, setConfig] = useState<PaymentConfig>({ pixEnabled: true, cashEnabled: true, cardEnabled: true })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantSlug) return
    apiWithTenant<any>('/payments/config', tenantSlug)
      .then((data) => {
        if (data) {
          setConfig({
            pixEnabled: data.pixEnabled ?? true,
            cashEnabled: data.cashEnabled ?? true,
            cardEnabled: data.cardEnabled ?? true,
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenantSlug])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiWithTenant('/payments/config', tenantSlug, {
        method: 'PUT',
        body: JSON.stringify(config),
      })
    } catch (err) {
      console.error(err)
    } finally { setSaving(false) }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500 dark:text-slate-400">Carregando configurações...</div>
  }

  return (
    <div className="space-y-6 min-h-full bg-slate-50 dark:bg-[#09090b]">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamentos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure como seus clientes podem pagar</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Formas de Pagamento</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-[#09090b] border border-emerald-200 dark:border-emerald-500/20 rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
              <input type="checkbox" checked={config.pixEnabled}
                onChange={(e) => setConfig({ ...config, pixEnabled: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-500" />
                  <span className="font-medium text-slate-900 dark:text-white text-sm">PIX</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">QR Code via Mercado Pago</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
              <input type="checkbox" checked={config.cardEnabled}
                onChange={(e) => setConfig({ ...config, cardEnabled: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                  <span className="font-medium text-slate-900 dark:text-white text-sm">Cartão</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Na entrega/retirada</span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
              <input type="checkbox" checked={config.cashEnabled}
                onChange={(e) => setConfig({ ...config, cashEnabled: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-green-600 dark:text-green-500" />
                  <span className="font-medium text-slate-900 dark:text-white text-sm">Dinheiro</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Pagamento na entrega/retirada</span>
              </div>
            </label>
          </div>
        </div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            <h2 className="text-lg font-bold text-emerald-800 dark:text-emerald-400">PIX via Mercado Pago</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>QR Code gerado automaticamente ao finalizar o pedido</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pagamento confirmado em tempo real via webhook</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>Cliente escaneia e paga em segundos pelo app do banco</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4" />
              <span>Sem custo adicional — processado pelo MenuFácil</span>
            </div>
          </div>
        </motion.div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>
    </div>
  )
}
