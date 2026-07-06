import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Crown,
  ArrowLeft,
  Loader2,
  Trash2,
  Edit3,
  Receipt,
  Calendar,
  DollarSign,
  Ban,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { PLANS } from '../../data/plans';
import { apiWithTenant } from '../../lib/api';

interface SubscriptionData {
  id: string | null;
  status: string;
  plan: string;
  cardLastFour: string | null;
  nextBillingDate: string | null;
  lastBillingDate: string | null;
  paymentStatus: string;
  overdueDays: number | null;
  value?: number;
}

export function Subscription() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showChangeCard, setShowChangeCard] = useState(false);
  const [changingCard, setChangingCard] = useState(false);
  const [cardForm, setCardForm] = useState({
    holderName: '',
    number: '',
    expiry: '',
    cvv: '',
    cpf: '',
  });

  const tenantSlug = user?.tenantSlug || '';

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    setLoading(true);
    try {
      const resp = await apiWithTenant<any>('/mp/subscription', tenantSlug);
      setData(resp.subscription);
    } catch (err) {
      toast.error('Erro ao carregar assinatura');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await apiWithTenant('/mp/subscription/cancel', tenantSlug, { method: 'POST' });
      if (user) {
        updateUser({ ...user, plan: 'basico', subscriptionStatus: 'cancelled' });
      }
      toast.success('Assinatura cancelada. Seu plano é Básico agora.');
      setShowCancelConfirm(false);
      loadSubscription();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao cancelar');
    } finally {
      setCancelling(false);
    }
  };

  const handleChangeCard = async () => {
    if (!cardForm.holderName || !cardForm.number || !cardForm.expiry || !cardForm.cvv) {
      toast.error('Preencha todos os dados do cartão');
      return;
    }
    setChangingCard(true);
    try {
      const [expiryMonth, expiryYear] = cardForm.expiry.split('/').map((s) => s.trim());
      const resp = await apiWithTenant<{ cardLastFour: string; message: string }>(
        '/mp/subscription/change-card',
        tenantSlug,
        {
          method: 'POST',
          body: JSON.stringify({
            holderName: cardForm.holderName,
            number: cardForm.number,
            expiryMonth,
            expiryYear: expiryYear ? `20${expiryYear}` : '',
            ccv: cardForm.cvv,
            cpfCnpj: cardForm.cpf.replace(/\D/g, ''),
          }),
        }
      );
      toast.success(resp.message || 'Cartão atualizado!');
      setShowChangeCard(false);
      setCardForm({ holderName: '', number: '', expiry: '', cvv: '', cpf: '' });
      loadSubscription();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao alterar cartão');
    } finally {
      setChangingCard(false);
    }
  };

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + '/' + digits.slice(2);
    return digits;
  };

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const getStatusBadge = () => {
    if (!data) return null;
    switch (data.status) {
      case 'authorized':
        return { label: 'Ativa', color: 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icon: CheckCircle2 };
      case 'paused':
        return { label: 'Pausada', color: 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400', icon: AlertTriangle };
      case 'cancelled':
        return { label: 'Cancelada', color: 'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400', icon: XCircle };
      default:
        return { label: 'Inativa', color: 'bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-400', icon: Ban };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const statusBadge = getStatusBadge();
  const StatusIcon = statusBadge?.icon || Ban;
  const isCompleto = data?.plan === 'completo';
  const price = PLANS.completo.price;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <button
          onClick={() => navigate('/dashboard')}
          className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-sm font-medium flex items-center gap-2 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao painel
        </button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Minha Assinatura</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Gerencie seu plano e forma de pagamento</p>
      </div>

      {/* Plan Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-6 shadow-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isCompleto ? 'bg-orange-100 dark:bg-orange-500/10' : 'bg-slate-100 dark:bg-slate-500/10'}`}>
              <Crown className={`w-6 h-6 ${isCompleto ? 'text-orange-600 dark:text-orange-500' : 'text-slate-400'}`} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {isCompleto ? 'Plano Completo' : 'Plano Básico'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isCompleto
                  ? `R$ ${price.toFixed(2).replace('.', ',')}/mês`
                  : 'Grátis'}
              </p>
            </div>
          </div>
          {statusBadge && (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${statusBadge.color}`}>
              <StatusIcon className="w-3.5 h-3.5" />
              {statusBadge.label}
            </span>
          )}
        </div>

        <div className="space-y-4">
          {/* Status Row */}
          {data?.status === 'authorized' && data?.cardLastFour && (
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#09090b] rounded-xl">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Cartão final <strong className="text-slate-900 dark:text-white">{data.cardLastFour}</strong>
                </span>
              </div>
              <button
                onClick={() => setShowChangeCard(!showChangeCard)}
                className="text-orange-600 hover:text-orange-500 text-sm font-medium flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" /> Trocar
              </button>
            </div>
          )}

          {/* Next Billing */}
          {data?.nextBillingDate && data.status === 'authorized' && (
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#09090b] rounded-xl">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Próxima cobrança
                </span>
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {new Date(data.nextBillingDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}

          {/* Last Billing */}
          {data?.lastBillingDate && (
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#09090b] rounded-xl">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Última cobrança
                </span>
              </div>
              <span className="text-sm font-medium text-slate-900 dark:text-white">
                {new Date(data.lastBillingDate + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
            </div>
          )}

          {/* Value */}
          {isCompleto && (
            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#09090b] rounded-xl">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  Valor mensal
                </span>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                R$ {price.toFixed(2).replace('.', ',')}
              </span>
            </div>
          )}

          {/* Actions */}
          {isCompleto && data?.status === 'authorized' && (
            <div className="pt-4 border-t border-slate-200 dark:border-[#262626]">
              {!showCancelConfirm ? (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="w-full py-3 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancelar Assinatura
                </button>
              ) : (
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                    Tem certeza? Você voltará para o plano Básico (grátis) e perderá acesso aos recursos do plano Completo.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 py-2 bg-white dark:bg-[#262626] border border-slate-200 dark:border-[#3f3f46] text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-[#3f3f46] transition-colors"
                    >
                      Manter Assinatura
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1 disabled:opacity-70"
                    >
                      {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {cancelling ? 'Cancelando...' : 'Sim, Cancelar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isCompleto && (
            <div className="pt-4 border-t border-slate-200 dark:border-[#262626]">
              <button
                onClick={() => navigate('/dashboard/upgrade')}
                className="w-full py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors shadow-lg shadow-orange-900/20"
              >
                Fazer Upgrade para Completo
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* Change Card Form */}
      {showChangeCard && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-6 shadow-xl overflow-hidden"
        >
          <h3 className="font-bold text-slate-900 dark:text-white mb-4">Alterar Cartão</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome no Cartão</label>
              <input
                type="text"
                placeholder="Nome como está no cartão"
                value={cardForm.holderName}
                onChange={(e) => setCardForm({ ...cardForm, holderName: e.target.value })}
                className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número do Cartão</label>
              <input
                type="text"
                placeholder="0000 0000 0000 0000"
                value={cardForm.number}
                onChange={(e) => setCardForm({ ...cardForm, number: formatCardNumber(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Validade</label>
                <input
                  type="text"
                  placeholder="MM/AA"
                  value={cardForm.expiry}
                  onChange={(e) => setCardForm({ ...cardForm, expiry: formatExpiry(e.target.value) })}
                  className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CVV</label>
                <input
                  type="text"
                  placeholder="123"
                  maxLength={4}
                  value={cardForm.cvv}
                  onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CPF do Titular</label>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={cardForm.cpf}
                onChange={(e) => setCardForm({ ...cardForm, cpf: formatCpf(e.target.value) })}
                className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setShowChangeCard(false); setCardForm({ holderName: '', number: '', expiry: '', cvv: '', cpf: '' }); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-[#3f3f46] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleChangeCard}
                disabled={changingCard}
                className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {changingCard ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {changingCard ? 'Salvando...' : 'Salvar Cartão'}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Overdue Warning */}
      {data?.status === 'paused' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-2xl p-6"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-yellow-800 dark:text-yellow-300">Pagamento em atraso</h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
                Sua assinatura está pausada por falha no pagamento. Atualize seu cartão para reativar.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {data?.overdueDays && data.overdueDays > 0 && data.overdueDays < 30 ? (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl p-4 text-sm text-red-700 dark:text-red-300">
          Você tem <strong>{data.overdueDays} dia(s)</strong> de atraso. Após 30 dias, seu plano será rebaixado para Básico.
        </div>
      ) : null}
    </div>
  );
}