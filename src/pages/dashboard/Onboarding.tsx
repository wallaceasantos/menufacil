import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'motion/react'
import { Store, UtensilsCrossed, CreditCard, PartyPopper, ChevronRight, ChevronLeft, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { apiWithTenant } from '../../lib/api'
import { getTenantSlug } from '../../data/tenantStorage'

const STEPS = [
  { id: 'store', title: 'Perfil da loja', icon: Store },
  { id: 'menu', title: 'Primeiro produto', icon: UtensilsCrossed },
  { id: 'payment', title: 'Pagamento', icon: CreditCard },
  { id: 'done', title: 'Tudo pronto!', icon: PartyPopper },
]

export function Onboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const slug = getTenantSlug(user!) || ''
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [storeForm, setStoreForm] = useState({ name: '', phone: '', address: '' })
  const [productForm, setProductForm] = useState({ name: '', price: '', category: 'Lanches', description: '' })

  const saveStore = async () => {
    if (!storeForm.name.trim()) {
      toast.error('Informe o nome da loja')
      return
    }
    setSaving(true)
    try {
      await apiWithTenant('/store', slug, {
        method: 'PUT',
        body: JSON.stringify({
          name: storeForm.name.trim(),
          phone: storeForm.phone.trim() || undefined,
          address: storeForm.address.trim() || undefined,
        }),
      })
      toast.success('Perfil salvo!')
      setStep(1)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar perfil')
    } finally {
      setSaving(false)
    }
  }

  const saveProduct = async () => {
    if (!productForm.name.trim() || !productForm.price) {
      toast.error('Informe nome e preço do produto')
      return
    }
    setSaving(true)
    try {
      await apiWithTenant('/menu/products', slug, {
        method: 'POST',
        body: JSON.stringify({
          name: productForm.name.trim(),
          description: productForm.description.trim() || undefined,
          price: parseFloat(productForm.price),
          category: productForm.category.trim() || 'Lanches',
          active: true,
        }),
      })
      toast.success('Produto criado!')
      setStep(2)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar produto')
    } finally {
      setSaving(false)
    }
  }

  const finish = async () => {
    setSaving(true)
    try {
      await apiWithTenant('/store/onboarding/complete', slug, { method: 'POST' })
      toast.success('Onboarding concluído! Bem-vindo ao MenuFácil')
      navigate('/dashboard')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao concluir')
    } finally {
      setSaving(false)
    }
  }

  const skip = async () => {
    try {
      await apiWithTenant('/store/onboarding/complete', slug, { method: 'POST' })
    } catch {}
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Vamos configurar sua loja</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Leva menos de 2 minutos</p>
        </div>

        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  i <= step
                    ? 'bg-orange-600 text-white'
                    : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] text-slate-400'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-orange-600' : 'bg-slate-200 dark:bg-[#262626]'}`} />}
            </div>
          ))}
        </div>

        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-8 shadow-xl">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>

              {step === 0 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Perfil da loja</h2>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do estabelecimento</label>
                    <input
                      value={storeForm.name}
                      onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                      placeholder="Ex: Burger House"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone (WhatsApp)</label>
                    <input
                      value={storeForm.phone}
                      onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                      placeholder="(11) 99999-0000"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço</label>
                    <input
                      value={storeForm.address}
                      onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                      placeholder="Rua, número, bairro"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Cadastre seu primeiro produto</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Você poderá adicionar mais produtos depois, no menu Cardápio.</p>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do produto</label>
                    <input
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="Ex: X-Burger Artesanal"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Preço (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        placeholder="29,90"
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                      <input
                        value={productForm.category}
                        onChange={(e) => setProductForm({ ...productForm, category: e.target.value })}
                        placeholder="Lanches"
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição (opcional)</label>
                    <textarea
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      rows={2}
                      placeholder="Pão brioche, carne 180g, queijo cheddar..."
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Como você quer receber?</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Configure sua chave PIX, QR Code e formas de pagamento na página de Pagamentos. Você pode fazer isso agora ou depois.
                  </p>
                  <div className="bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-4 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                    <p>• <strong>PIX manual</strong> — informe sua chave ou envie o QR Code</p>
                    <p>• <strong>PIX automático</strong> — cobrança via Mercado Pago (plano Completo)</p>
                    <p>• <strong>Cartão / Dinheiro</strong> — na entrega ou retirada</p>
                  </div>
                  <button
                    onClick={() => navigate('/dashboard/payments')}
                    className="w-full py-2.5 border border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg font-semibold transition-colors text-sm"
                  >
                    Configurar pagamentos agora
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <PartyPopper className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Tudo pronto!</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Sua loja já está no ar. Compartilhe seu link de cardápio e comece a receber pedidos.
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => (step === 0 ? skip() : setStep(step - 1))}
              className="px-4 py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-medium transition-colors flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 0 ? 'Pular por enquanto' : 'Voltar'}
            </button>

            {step < 2 && (
              <button
                onClick={() => (step === 0 ? saveStore() : saveProduct())}
                disabled={saving}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors text-sm flex items-center gap-2"
              >
                Continuar
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 3 && (
              <button
                onClick={finish}
                disabled={saving}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Ir para o painel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
