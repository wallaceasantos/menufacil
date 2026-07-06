import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { User, Bell, Link as LinkIcon, Palette, Save, CreditCard, Smartphone, Receipt, CheckCircle2, ExternalLink, Loader2, Star } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { PlanBadge } from '../../components/PlanBadge';
import { PLANS, PLAN_FEATURES, formatPlanPrice } from '../../data/plans';
import { api, apiWithTenant } from '../../lib/api';
import { getTenantSlug } from '../../data/tenantStorage';
import toast from 'react-hot-toast';
import { BillingForm, type BillingData } from '../../components/BillingForm';
import { sanitizeCpf } from '../../lib/cpf';

export function Settings() {
  const { user, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'account' | 'notifications' | 'integrations' | 'appearance' | 'billing'>('account');

  const [subscriptionData, setSubscriptionData] = useState<{
    subscription: {
      id: string;
      status: string;
      value: number;
      nextDueDate: string;
    } | null;
    lastPayment: {
      id: string;
      value: number;
      status: string;
      dateCreated: string;
      dateApproved?: string;
      paymentMethod?: string;
      boletoUrl?: string;
    } | null;
  }>({ subscription: null, lastPayment: null });
  const [loadingSubscription, setLoadingSubscription] = useState(false);

  useEffect(() => {
    if (activeTab === 'billing' && user?.plan === 'completo') {
      setLoadingSubscription(true);
      api<typeof subscriptionData>('/mp/subscription', {
        headers: { 'x-tenant-slug': user?.tenantSlug || '' },
      })
        .then((data) => setSubscriptionData(data))
        .catch(() => {})
        .finally(() => setLoadingSubscription(false));
    }
  }, [activeTab, user]);

  const [accountData, setAccountData] = useState({
    name: user?.name || 'Usuário Demo',
    email: user?.email || 'demo@example.com',
    currentPassword: '',
    newPassword: '',
  });

  const [notifications, setNotifications] = useState({
    newOrderSound: true,
    newOrderBrowser: true,
    dailyReportEmail: false,
    marketingEmails: false,
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Configurações salvas com sucesso!');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie sua conta, notificações e preferências do sistema.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar de Navegação das Configurações */}
        <div className="w-full md:w-64 flex-shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            <button
              onClick={() => setActiveTab('account')}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'account'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#09090b]'
              }`}
            >
              <User className="w-4 h-4" />
              Minha Conta
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'notifications'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#09090b]'
              }`}
            >
              <Bell className="w-4 h-4" />
              Notificações
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'integrations'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#09090b]'
              }`}
            >
              <LinkIcon className="w-4 h-4" />
              Integrações
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'appearance'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#09090b]'
              }`}
            >
              <Palette className="w-4 h-4" />
              Aparência
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'billing'
                  ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#09090b]'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Assinatura e Faturamento
            </button>
          </nav>
        </div>

        {/* Conteúdo Principal */}
        <div className="flex-1">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6"
          >
            <form onSubmit={handleSave}>
              {activeTab === 'account' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Informações do Perfil</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome Completo</label>
                        <input
                          type="text"
                          value={accountData.name}
                          onChange={(e) => setAccountData({ ...accountData, name: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                        <input
                          type="email"
                          value={accountData.email}
                          onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        />
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-200 dark:border-[#262626]" />

                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Alterar Senha</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha Atual</label>
                        <input
                          type="password"
                          value={accountData.currentPassword}
                          onChange={(e) => setAccountData({ ...accountData, currentPassword: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nova Senha</label>
                        <input
                          type="password"
                          value={accountData.newPassword}
                          onChange={(e) => setAccountData({ ...accountData, newPassword: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Alertas de Pedidos</h2>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-4 border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-[#09090b] transition-colors">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Alerta Sonoro</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Tocar um som quando chegar um novo pedido</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.newOrderSound}
                          onChange={(e) => setNotifications({ ...notifications, newOrderSound: e.target.checked })}
                          className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                      </label>
                      <label className="flex items-center justify-between p-4 border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-[#09090b] transition-colors">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Notificações no Navegador</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Exibir pop-ups do navegador para novos pedidos</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.newOrderBrowser}
                          onChange={(e) => setNotifications({ ...notifications, newOrderBrowser: e.target.checked })}
                          className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                      </label>
                    </div>
                  </div>
                  
                  <hr className="border-slate-200 dark:border-[#262626]" />
                  
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Comunicações</h2>
                    <div className="space-y-4">
                      <label className="flex items-center justify-between p-4 border border-slate-200 dark:border-[#262626] rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-[#09090b] transition-colors">
                        <div>
                          <p className="font-medium text-slate-900 dark:text-white">Relatório Diário</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">Receber um resumo das vendas por e-mail no fim do dia</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifications.dailyReportEmail}
                          onChange={(e) => setNotifications({ ...notifications, dailyReportEmail: e.target.checked })}
                          className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'integrations' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Formas de Pagamento</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 border border-slate-200 dark:border-[#262626] rounded-xl flex items-start gap-4">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white">Chave PIX</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Receba pagamentos diretos via PIX.</p>
                          <input
                            type="text"
                            placeholder="Sua chave PIX"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                        </div>
                      </div>
                      <div className="p-4 border border-slate-200 dark:border-[#262626] rounded-xl flex items-start gap-4 opacity-50 grayscale">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-500/20 text-blue-600 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white">Mercado Pago</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Em breve.</p>
                          <button type="button" disabled className="px-3 py-1.5 bg-slate-100 dark:bg-[#262626] text-slate-500 rounded-lg text-sm font-medium">
                            Conectar Conta
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <hr className="border-slate-200 dark:border-[#262626]" />

                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Comunicação</h2>
                    <div className="p-4 border border-slate-200 dark:border-[#262626] rounded-xl flex items-start gap-4">
                      <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-500/20 text-green-600 flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900 dark:text-white">WhatsApp Business</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Envie mensagens automáticas sobre o status do pedido para seus clientes.</p>
                        <button type="button" className="px-4 py-2 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-lg text-sm font-semibold transition-colors">
                          Conectar WhatsApp
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'appearance' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Tema do Sistema</h2>
                    <div className="grid grid-cols-2 gap-4 max-w-md">
                      <button
                        type="button"
                        onClick={() => theme === 'dark' && toggleTheme()}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          theme === 'light'
                            ? 'border-orange-500 bg-orange-50 dark:bg-transparent'
                            : 'border-slate-200 dark:border-[#262626] hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="w-full h-24 bg-slate-100 rounded-lg mb-3 border border-slate-200 overflow-hidden">
                          <div className="h-6 bg-white border-b border-slate-200" />
                          <div className="p-2 flex gap-2">
                            <div className="w-1/4 h-12 bg-white rounded shadow-sm" />
                            <div className="flex-1 h-12 bg-white rounded shadow-sm" />
                          </div>
                        </div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">Modo Claro</h3>
                        <p className="text-xs text-slate-500 mt-1">Aparência limpa e iluminada.</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => theme === 'light' && toggleTheme()}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          theme === 'dark'
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-slate-200 dark:border-[#262626] hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="w-full h-24 bg-[#09090b] rounded-lg mb-3 border border-[#262626] overflow-hidden">
                          <div className="h-6 bg-[#121214] border-b border-[#262626]" />
                          <div className="p-2 flex gap-2">
                            <div className="w-1/4 h-12 bg-[#121214] rounded shadow-sm" />
                            <div className="flex-1 h-12 bg-[#121214] rounded shadow-sm" />
                          </div>
                        </div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">Modo Escuro</h3>
                        <p className="text-xs text-slate-500 mt-1">Melhor para uso noturno.</p>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'billing' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Plano Atual</h2>
                    <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            Plano {PLANS[user?.plan || 'basico'].name}
                          </h3>
                          <PlanBadge plan={user?.plan} size="sm" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm max-w-md">
                          {PLANS[user?.plan || 'basico'].description}
                        </p>
                        <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          {PLAN_FEATURES.filter((f) => f.availableIn.includes(user?.plan || 'basico')).map((feature) => (
                            <li key={feature.id} className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-orange-600" />
                              <span className={feature.highlight ? 'font-semibold' : ''}>{feature.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="flex flex-col items-start md:items-end gap-2 border-t md:border-t-0 md:border-l border-orange-200 dark:border-orange-500/20 pt-6 md:pt-0 md:pl-6">
                        <div className="text-3xl font-bold text-slate-900 dark:text-white">
                          {formatPlanPrice(PLANS[user?.plan || 'basico']).replace('/mês', '')}
                          <span className="text-base font-normal text-slate-500">/mês</span>
                        </div>
                        {subscriptionData.subscription && (
                          <p className="text-xs text-slate-500">
                            Próxima cobrança: {new Date(subscriptionData.subscription.nextDueDate).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                        {user?.plan === 'completo' ? (
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            Assinatura ativa
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => navigate('/dashboard/upgrade')}
                            className="mt-2 text-sm font-semibold text-orange-600 hover:text-orange-700 transition-colors"
                          >
                            Fazer Upgrade
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  <hr className="border-slate-200 dark:border-[#262626]" />

                  {user?.plan === 'completo' && (
                    <>
                      {loadingSubscription ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                        </div>
                      ) : (
                        <>
                          {subscriptionData.subscription && (
                            <div>
                              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Assinatura</h2>
                              <div className="border border-slate-200 dark:border-[#262626] rounded-xl p-4 space-y-3">
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">Status</span>
                                  <span className="font-medium text-green-600 dark:text-green-400">
                                    {subscriptionData.subscription.status === 'authorized' ? 'Ativa' : subscriptionData.subscription.status}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">Forma de pagamento</span>
                                  <span className="font-medium text-slate-900 dark:text-white">
                                    {subscriptionData.lastPayment?.paymentMethod === 'pix' ? 'PIX' :
                                     subscriptionData.lastPayment?.paymentMethod === 'bolbradesco' ? 'Boleto' :
                                     subscriptionData.lastPayment?.paymentMethod ? 'Cartão de Crédito' : '—'}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">Ciclo</span>
                                  <span className="font-medium text-slate-900 dark:text-white">Mensal</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-slate-500">Próximo vencimento</span>
                                  <span className="font-medium text-slate-900 dark:text-white">
                                    {new Date(subscriptionData.subscription.nextDueDate).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          {subscriptionData.lastPayment && (
                            <>
                              <hr className="border-slate-200 dark:border-[#262626]" />
                              <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Último Pagamento</h2>
                                <div className="border border-slate-200 dark:border-[#262626] rounded-xl p-4 flex items-center justify-between">
                                  <div className="space-y-1">
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                      R$ {subscriptionData.lastPayment.value.toFixed(2).replace('.', ',')}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {new Date(subscriptionData.lastPayment.dateCreated || subscriptionData.lastPayment.dateApproved).toLocaleDateString('pt-BR')}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      subscriptionData.lastPayment.status === 'approved'
                                        ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-400'
                                        : subscriptionData.lastPayment.status === 'rejected'
                                        ? 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-400'
                                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-400'
                                    }`}>
                                      {subscriptionData.lastPayment.status === 'RECEIVED' || subscriptionData.lastPayment.status === 'CONFIRMED' ? 'Pago' :
                                        subscriptionData.lastPayment.status === 'rejected' ? 'Recusado' :
                                        subscriptionData.lastPayment.status === 'pending' ? 'Pendente' : subscriptionData.lastPayment.status}
                                     </span>
                                    {subscriptionData.lastPayment.boletoUrl && (
                                      <a
                                        href={subscriptionData.lastPayment.boletoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-orange-600 hover:text-orange-700"
                                      >
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </>
                  )}

                  <hr className="border-slate-200 dark:border-[#262626]" />

                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Dados de Cobrança</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                      Esses dados são usados para emitir boleto e PIX no Mercado Pago.
                    </p>
                    <BillingForm
                      defaultValues={{
                        firstName: user?.ownerFirstName || user?.name?.split(' ')[0] || '',
                        lastName: user?.ownerLastName || user?.name?.split(' ').slice(1).join(' ') || '',
                        cpf: user?.ownerCpfCnpj || '',
                        email: user?.billingEmail || user?.email || '',
                        phone: user?.billingPhone || '',
                        postalCode: user?.billingPostalCode || '',
                        addressNumber: user?.billingAddressNumber || '',
                      }}
                      onSubmit={async (data) => {
                        const slug = user?.tenantSlug;
                        if (!slug) return;
                        try {
                          await api('/store', {
                            method: 'PUT',
                            headers: { 'x-tenant-slug': slug },
                            body: JSON.stringify({
                              ownerCpfCnpj: sanitizeCpf(data.cpf),
                              ownerFirstName: data.firstName.trim(),
                              ownerLastName: data.lastName.trim(),
                              billingEmail: data.email.trim().toLowerCase(),
                              billingPhone: data.phone || '',
                              billingPostalCode: data.postalCode || '',
                              billingAddressNumber: data.addressNumber || '',
                            }),
                          });
                          updateUser({
                            ...user!,
                            ownerCpfCnpj: sanitizeCpf(data.cpf),
                            ownerFirstName: data.firstName.trim(),
                            ownerLastName: data.lastName.trim(),
                            billingEmail: data.email.trim().toLowerCase(),
                            billingPhone: data.phone || '',
                            billingPostalCode: data.postalCode || '',
                            billingAddressNumber: data.addressNumber || '',
                          });
                          toast.success('Dados de cobrança salvos!');
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Erro ao salvar dados de cobrança');
                        }
                      }}
                      submitLabel="Salvar dados de cobrança"
                    />
                  </div>

                  <hr className="border-slate-200 dark:border-[#262626]" />

                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Nota Fiscal</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Para solicitar sua nota fiscal, entre em contato com nosso suporte.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-200 dark:border-[#262626] flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Salvar Configurações
                </button>
              </div>
            </form>
          </motion.div>

          {/* Platform Review */}
          <PlatformReview />
        </div>
      </div>
    </div>
  );
}

function PlatformReview() {
  const { user } = useAuth()
  const slug = getTenantSlug(user)
  const [existing, setExisting] = useState<{ rating: number | null; comment: string | null }>({ rating: null, comment: null })
  const [submitted, setSubmitted] = useState(false)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!slug || !user) return
    apiWithTenant<any>('/store/review', slug)
      .then((d) => { setExisting({ rating: d.rating, comment: d.comment }); if (d.rating) setSubmitted(true) })
      .catch(() => {})
  }, [slug, user])

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) { toast('Selecione de 1 a 5 estrelas', { icon: '⭐' }); return }
    setLoading(true)
    try {
      await apiWithTenant('/store/review', slug, {
        method: 'POST',
        body: JSON.stringify({ rating, comment }),
      })
      setSubmitted(true)
      toast.success('Avaliação enviada! Obrigado pelo feedback!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar')
    } finally { setLoading(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] p-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Avalie o MenuFácil</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {submitted ? 'Sua avaliação ajuda outros empreendedores.' : 'Sua opinião é importante para nós. Avalie a plataforma:'}
      </p>

      {submitted ? (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
          <p className="font-bold text-emerald-700 dark:text-emerald-400">Obrigado pela sua avaliação!</p>
          {existing.rating && (
            <div className="flex justify-center gap-0.5 mt-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`w-6 h-6 ${n <= existing.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} />
              ))}
            </div>
          )}
          {existing.comment && (
            <p className="text-sm text-emerald-600 dark:text-emerald-300 mt-2 italic">"{existing.comment}"</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setRating(n)}
                className="p-1 transition-transform hover:scale-110">
                <Star className={`w-8 h-8 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 dark:text-slate-600'}`} />
              </button>
            ))}
          </div>
          <p className="text-xs text-center text-slate-400">
            {rating === 0 ? 'Toque nas estrelas para avaliar' : rating <= 2 ? 'Sentimos muito. Conte o que podemos melhorar:' : rating === 3 ? 'Obrigado! Tem alguma sugestão?' : 'Que bom que está gostando! Conte sua experiência:'}
          </p>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Conte sua experiência com o MenuFácil..."
            rows={3}
            className="w-full bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none" />
          <button onClick={handleSubmit} disabled={loading || rating === 0}
            className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm disabled:opacity-50 transition-colors">
            {loading ? 'Enviando...' : 'Enviar Avaliação'}
          </button>
        </div>
      )}
    </motion.div>
  )
}
