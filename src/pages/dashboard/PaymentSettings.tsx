import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { CreditCard, Banknote, QrCode, Save, HelpCircle, Smartphone, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { getTenantSlug } from '../../data/tenantStorage';
import { apiWithTenant } from '../../lib/api';

interface PaymentConfig {
  pixKey: string;
  pixKeyType: 'cpf' | 'cnpj' | 'phone' | 'email' | 'random';
  pixBeneficiary: string;
  pixBank: string;
  pixEnabled: boolean;
  cashEnabled: boolean;
  cardEnabled: boolean;
  pixOnDelivery: boolean;
  instructions: string;
}

const DEFAULT_CONFIG: PaymentConfig = {
  pixKey: '',
  pixKeyType: 'cpf',
  pixBeneficiary: '',
  pixBank: '',
  pixEnabled: false,
  cashEnabled: true,
  cardEnabled: true,
  pixOnDelivery: false,
  instructions: 'Envie o comprovante pelo WhatsApp após o pagamento.',
};

const KEY_TYPE_LABELS: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  phone: 'Celular',
  email: 'E-mail',
  random: 'Chave aleatória',
};

export function PaymentSettings() {
  const { user } = useAuth();
  const tenantSlug = getTenantSlug(user);
  const [config, setConfig] = useState<PaymentConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user || !tenantSlug) return;

    async function loadConfig() {
      setLoading(true);
      try {
        const data = await apiWithTenant<Partial<PaymentConfig>>('/payments/config', tenantSlug);
        setConfig((prev) => ({ ...prev, ...data }));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar configurações';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    loadConfig();
  }, [user, tenantSlug]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !tenantSlug) return;

    if (config.pixEnabled && !config.pixKey.trim()) {
      toast.error('Informe a chave PIX para habilitar essa forma de pagamento');
      return;
    }

    setSaving(true);
    try {
      await apiWithTenant('/payments/config', tenantSlug, {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      toast.success('Configurações de pagamento salvas!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar configurações';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Formas de Pagamento</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure como seus clientes poderão pagar os pedidos.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">Carregando configurações...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Payment Methods */}
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Store className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Formas de Pagamento Ativas</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Escolha quais opções seus clientes verão na hora de finalizar o pedido.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={config.cashEnabled}
                  onChange={(e) => setConfig({ ...config, cashEnabled: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-green-600 dark:text-green-500" />
                    <span className="font-medium text-slate-900 dark:text-white text-sm">Dinheiro</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Pagamento na entrega/retirada</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={config.cardEnabled}
                  onChange={(e) => setConfig({ ...config, cardEnabled: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-500" />
                    <span className="font-medium text-slate-900 dark:text-white text-sm">Cartão</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Na entrega/retirada</span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:border-orange-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={config.pixEnabled}
                  onChange={(e) => setConfig({ ...config, pixEnabled: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-500" />
                    <span className="font-medium text-slate-900 dark:text-white text-sm">PIX</span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">Chave PIX manual</span>
                </div>
              </label>
            </div>
          </div>

          {/* PIX Configuration */}
          <motion.div
            initial={false}
            animate={{ opacity: config.pixEnabled ? 1 : 0.5, pointerEvents: config.pixEnabled ? 'auto' : 'none' }}
            className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <QrCode className="w-5 h-5 text-purple-600 dark:text-purple-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Configuração do PIX</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de chave</label>
                <select
                  value={config.pixKeyType}
                  onChange={(e) => setConfig({ ...config, pixKeyType: e.target.value as PaymentConfig['pixKeyType'] })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  {Object.entries(KEY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chave PIX</label>
                <input
                  type="text"
                  value={config.pixKey}
                  onChange={(e) => setConfig({ ...config, pixKey: e.target.value })}
                  placeholder={config.pixKeyType === 'cpf' ? '000.000.000-00' : 'Sua chave PIX'}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do beneficiário</label>
                <input
                  type="text"
                  value={config.pixBeneficiary}
                  onChange={(e) => setConfig({ ...config, pixBeneficiary: e.target.value })}
                  placeholder="Nome que aparecerá na transferência"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Banco / Instituição</label>
                <input
                  type="text"
                  value={config.pixBank}
                  onChange={(e) => setConfig({ ...config, pixBank: e.target.value })}
                  placeholder="Ex: Nubank, Itaú, PicPay"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg cursor-pointer hover:border-orange-500/50 transition-colors">
                <input
                  type="checkbox"
                  checked={config.pixOnDelivery}
                  onChange={(e) => setConfig({ ...config, pixOnDelivery: e.target.checked })}
                  className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                />
                <div>
                  <span className="font-medium text-slate-900 dark:text-white text-sm block">Permitir PIX na entrega</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    O cliente pode escolher pagar com PIX no momento da entrega/retirada.
                  </span>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Instruções para o cliente
              </label>
              <textarea
                rows={3}
                value={config.instructions}
                onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                placeholder="Ex: Envie o comprovante pelo WhatsApp após o pagamento."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Esta mensagem será exibida para o cliente ao escolher pagamento via PIX.
              </p>
            </div>
          </motion.div>

          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-xl p-4 flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-blue-900 dark:text-blue-400 text-sm">Sobre o PIX manual</h3>
              <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">
                Nessa modalidade, o cliente copia sua chave PIX e realiza a transferência pelo aplicativo do banco. 
                Você confirma o recebimento manualmente antes de liberar o pedido.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
