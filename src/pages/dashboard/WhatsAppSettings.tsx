import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Save, Link2, QrCode, CheckCircle2, AlertCircle, Send, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { getTenantSlug } from '../../data/tenantStorage';
import { apiWithTenant } from '../../lib/api';

interface WhatsAppConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  connected: boolean;
  notifyReceived: boolean;
  notifyPreparing: boolean;
  notifyCompleted: boolean;
  notifyCancelled: boolean;
  defaultMessage: string;
}

const DEFAULT_CONFIG: WhatsAppConfig = {
  apiUrl: '',
  apiKey: '',
  instanceName: 'menufacil',
  connected: false,
  notifyReceived: true,
  notifyPreparing: true,
  notifyCompleted: true,
  notifyCancelled: true,
  defaultMessage: 'Olá {cliente}! Seu pedido #{pedido} foi atualizado para: {status}.',
};

export function WhatsAppSettings() {
  const { user } = useAuth();
  const tenantSlug = getTenantSlug(user);
  const [config, setConfig] = useState<WhatsAppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  useEffect(() => {
    if (!user || !tenantSlug) return;

    async function loadConfig() {
      setLoading(true);
      try {
        const data = await apiWithTenant<Partial<WhatsAppConfig>>('/whatsapp/config', tenantSlug);
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

    setSaving(true);
    try {
      await apiWithTenant('/whatsapp/config', tenantSlug, {
        method: 'PUT',
        body: JSON.stringify(config),
      });
      toast.success('Configurações do WhatsApp salvas!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar configurações';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestMessage = async () => {
    if (!testPhone || testPhone.replace(/\D/g, '').length < 10) {
      toast.error('Digite um número de telefone válido');
      return;
    }

    setTesting(true);
    try {
      await apiWithTenant('/whatsapp/test', tenantSlug, {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone.replace(/\D/g, '') }),
      });
      toast.success('Mensagem de teste enviada!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar mensagem de teste';
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsApp Business</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Configure o envio automático de mensagens sobre o status dos pedidos.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">Carregando configurações...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Status Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-6 flex items-start gap-4 ${
              config.connected
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'
                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30'
            }`}
          >
            <div className={`p-3 rounded-xl ${config.connected ? 'bg-green-100 dark:bg-green-500/20' : 'bg-amber-100 dark:bg-amber-500/20'}`}>
              {config.connected ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-500" />
              ) : (
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-500" />
              )}
            </div>
            <div>
              <h2 className={`font-bold ${config.connected ? 'text-green-900 dark:text-green-400' : 'text-amber-900 dark:text-amber-400'}`}>
                {config.connected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
              </h2>
              <p className={`text-sm mt-1 ${config.connected ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {config.connected
                  ? 'O sistema pode enviar mensagens automáticas para seus clientes.'
                  : 'Preencha as configurações abaixo e conecte sua instância do WhatsApp.'}
              </p>
            </div>
          </motion.div>

          {/* API Configuration */}
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Link2 className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Configuração da API</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Recomendamos usar a <strong>Evolution API</strong> ou <strong>WPPConnect</strong>. Informe a URL da sua instância e a chave de API.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">URL da API</label>
                <input
                  type="url"
                  value={config.apiUrl}
                  onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                  placeholder="http://localhost:8080"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key</label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                  placeholder="Sua chave secreta"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Instância</label>
                <input
                  type="text"
                  value={config.instanceName}
                  onChange={(e) => setConfig({ ...config, instanceName: e.target.value })}
                  placeholder="menufacil"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => toast('A conexão será realizada automaticamente ao salvar as configurações.', { icon: 'ℹ️' })}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <QrCode className="w-4 h-4" />
                Conectar WhatsApp
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Notificações Automáticas</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Escolha em quais mudanças de status o cliente deve receber uma mensagem.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: 'notifyReceived', label: 'Pedido recebido', desc: 'Assim que o pedido é criado' },
                { key: 'notifyPreparing', label: 'Em preparo', desc: 'Quando inicia o preparo' },
                { key: 'notifyCompleted', label: 'Pronto / Entregue', desc: 'Quando o pedido é finalizado' },
                { key: 'notifyCancelled', label: 'Cancelado', desc: 'Se o pedido for cancelado' },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg cursor-pointer hover:border-orange-500/50 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={config[item.key as keyof WhatsAppConfig] as boolean}
                    onChange={(e) => setConfig({ ...config, [item.key]: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <span className="font-medium text-slate-900 dark:text-white text-sm block">{item.label}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{item.desc}</span>
                  </div>
                </label>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mensagem padrão
              </label>
              <textarea
                rows={3}
                value={config.defaultMessage}
                onChange={(e) => setConfig({ ...config, defaultMessage: e.target.value })}
                placeholder="Olá {cliente}! Seu pedido #{pedido} foi atualizado para: {status}."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Use <code className="bg-slate-100 dark:bg-[#262626] px-1 rounded">{'{cliente}'}</code>,{' '}
                <code className="bg-slate-100 dark:bg-[#262626] px-1 rounded">{'{pedido}'}</code> e{' '}
                <code className="bg-slate-100 dark:bg-[#262626] px-1 rounded">{'{status}'}</code> para personalizar a mensagem.
              </p>
            </div>
          </div>

          {/* Test Message */}
          <div className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Testar Envio</h2>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Envie uma mensagem de teste para verificar se a integração está funcionando.
            </p>
            <div className="flex gap-3">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(formatPhone(e.target.value))}
                placeholder="(92) 9 8421-3885"
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <button
                type="button"
                onClick={handleTestMessage}
                disabled={testing}
                className="px-4 py-2 bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] text-slate-700 dark:text-slate-300 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                {testing ? 'Enviando...' : 'Enviar teste'}
              </button>
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
