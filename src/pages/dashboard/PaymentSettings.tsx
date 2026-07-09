import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Banknote, CreditCard, QrCode, Save, Store, Upload, Image, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { apiWithTenant, uploadImage } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

const KEY_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF', phone: 'Telefone', email: 'E-mail', random: 'Aleatória',
}

interface PaymentConfig {
  pixEnabled: boolean
  cashEnabled: boolean
  cardEnabled: boolean
  pixKey: string
  pixKeyType: string
  pixBeneficiary: string
  pixBank: string
  pixOnDelivery: boolean
  pixQrCodeImage: string | null
  instructions: string
}

const defaultConfig: PaymentConfig = {
  pixEnabled: true, cashEnabled: true, cardEnabled: true,
  pixKey: '', pixKeyType: 'cpf', pixBeneficiary: '', pixBank: '',
  pixOnDelivery: false, instructions: '', pixQrCodeImage: null,
}

export function PaymentSettings() {
  const { user } = useAuth()
  const tenantSlug = getTenantSlug(user)
  const [config, setConfig] = useState<PaymentConfig>(defaultConfig)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!tenantSlug) return
    apiWithTenant<any>('/payments/config', tenantSlug)
      .then((data) => {
        if (data) setConfig({
          pixEnabled: data.pixEnabled ?? true, cashEnabled: data.cashEnabled ?? true, cardEnabled: data.cardEnabled ?? true,
          pixKey: data.pixKey || '', pixKeyType: data.pixKeyType || 'cpf',
          pixBeneficiary: data.pixBeneficiary || '', pixBank: data.pixBank || '',
          pixOnDelivery: data.pixOnDelivery ?? false, instructions: data.instructions || '',
          pixQrCodeImage: data.pixQrCodeImage || null,
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenantSlug])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await apiWithTenant('/payments/config', tenantSlug, { method: 'PUT', body: JSON.stringify(config) })
    } catch (err) { console.error(err) }
    finally { setSaving(false) }
  }

  if (loading) {
    return <div className="text-center py-12 text-slate-500 dark:text-slate-400">Carregando...</div>
  }

  return (
    <div className="space-y-6 min-h-full bg-slate-50 dark:bg-[#09090b]">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pagamentos</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure as formas de pagamento e sua chave PIX</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Store className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Formas de Pagamento</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
              <input type="checkbox" checked={config.pixEnabled}
                onChange={(e) => setConfig({ ...config, pixEnabled: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-500" />
                  <span className="font-medium text-slate-900 dark:text-white text-sm">PIX</span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Chave PIX manual</span>
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
                <span className="text-xs text-slate-500 dark:text-slate-400">Na entrega/retirada</span>
              </div>
            </label>
          </div>
        </div>

        <motion.div animate={{ opacity: config.pixEnabled ? 1 : 0.5, pointerEvents: config.pixEnabled ? 'auto' : 'none' } as any}
          className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="w-5 h-5 text-purple-600 dark:text-purple-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Configuração da Chave PIX</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de chave</label>
              <select value={config.pixKeyType}
                onChange={(e) => setConfig({ ...config, pixKeyType: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50">
                {Object.entries(KEY_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chave PIX</label>
              <input type="text" value={config.pixKey}
                onChange={(e) => setConfig({ ...config, pixKey: e.target.value })}
                placeholder={config.pixKeyType === 'cpf' ? '000.000.000-00' : 'Sua chave PIX'}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do beneficiário</label>
              <input type="text" value={config.pixBeneficiary}
                onChange={(e) => setConfig({ ...config, pixBeneficiary: e.target.value })}
                placeholder="Nome no comprovante PIX"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Banco</label>
              <input type="text" value={config.pixBank}
                onChange={(e) => setConfig({ ...config, pixBank: e.target.value })}
                placeholder="Nubank, Itaú..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Ou envie uma imagem do QR Code PIX</label>
            <p className="text-xs text-slate-400 mb-2">Print do QR code do seu app do banco. O cliente escaneia direto.</p>
            {config.pixQrCodeImage ? (
              <div className="relative inline-block">
                <img src={config.pixQrCodeImage} alt="QR Code PIX" className="w-40 h-40 rounded-xl border border-slate-200 dark:border-[#262626] object-cover" />
                <button type="button" onClick={() => setConfig({ ...config, pixQrCodeImage: null })}
                  className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-8 border-2 border-dashed border-slate-300 dark:border-[#3f3f46] rounded-xl cursor-pointer hover:border-orange-400 transition-colors">
                <Upload className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-500">Clique para enviar o QR Code</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file || !tenantSlug) return
                    const url = await uploadImage(file, tenantSlug)
                    setConfig({ ...config, pixQrCodeImage: url })
                  }} />
              </label>
            )}
          </div>

          <div className="pt-2">
            <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg cursor-pointer hover:border-orange-500/50 transition-colors">
              <input type="checkbox" checked={config.pixOnDelivery}
                onChange={(e) => setConfig({ ...config, pixOnDelivery: e.target.checked })}
                className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500" />
              <div>
                <span className="font-medium text-slate-900 dark:text-white text-sm block">Permitir PIX na entrega</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Cliente pode pagar com PIX no momento da entrega.</span>
              </div>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Instruções para o cliente</label>
            <textarea rows={3} value={config.instructions}
              onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
              placeholder="Envie o comprovante pelo WhatsApp após o pagamento."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none" />
          </div>
        </motion.div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving}
            className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  )
}
