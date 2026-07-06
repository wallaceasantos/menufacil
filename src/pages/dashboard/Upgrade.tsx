import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  X,
  Crown,
  Zap,
  ArrowRight,
  CreditCard,
  Copy,
  ShieldCheck,
  Clock,
  MessageCircle,
  Banknote,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { PLANS, PLAN_FEATURES, formatPlanPrice, type PlanType } from '../../data/plans';
import { api } from '../../lib/api';
import { BillingForm, type BillingData } from '../../components/BillingForm';
import { sanitizeCpf } from '../../lib/cpf';

export function Upgrade() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'boleto'>('pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [step, setStep] = useState<'compare' | 'checkout'>('compare');
  const [showBoletoOption, setShowBoletoOption] = useState(false);

  const [serverPrice, setServerPrice] = useState<number | null>(null);

  useEffect(() => {
    api<{ price: number }>('/mp/plan-price').then((d) => setServerPrice(d.price)).catch(() => {})
  }, [])

  const effectivePrice = serverPrice ?? PLANS.completo.price

  const [pixData, setPixData] = useState<{
    encodedImage: string;
    payload: string;
    paymentId: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);

  const [cardForm, setCardForm] = useState({
    holderName: '',
    number: '',
    expiry: '',
    cvv: '',
    cpf: '',
  });

  const [boletoData, setBoletoData] = useState<{
    bankSlipUrl?: string;
    invoiceUrl?: string;
    paymentId: string;
  } | null>(null);

  const [showBillingForm, setShowBillingForm] = useState(false);

  const currentPlan = user?.plan || 'basico';

  function hasBillingData(u: typeof user): boolean {
    return !!(
      u?.ownerCpfCnpj &&
      u.ownerCpfCnpj.replace(/\D/g, '').length === 11 &&
      u.ownerFirstName &&
      u.ownerLastName &&
      u.billingEmail
    );
  }

  useEffect(() => {
    if (polling && pixData?.paymentId) {
      const interval = setInterval(async () => {
        try {
          const resp = await api<{ status: string }>(`/mp/payment/${pixData.paymentId}`, {
            headers: { 'x-tenant-slug': user?.tenantSlug || '' },
          });
          if (resp.status === 'approved') {
            clearInterval(interval);
            setPolling(false);
            handleUpgradeSuccess();
          }
        } catch { }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [polling, pixData?.paymentId]);

  const handleUpgradeSuccess = (customMessage?: string) => {
    if (user) {
      updateUser({ ...user, plan: 'completo' as PlanType, paymentStatus: 'paid' });
    }
    setIsProcessing(false);
    toast.success(customMessage || 'Pagamento confirmado! Seu plano foi atualizado para Completo.');
    navigate('/dashboard');
  };

  const processPayment = async (billingUser: typeof user = user) => {
    setIsProcessing(true);
    const slug = billingUser?.tenantSlug;

    try {
      if (paymentMethod === 'pix') {
        const resp = await api<{
          paymentId: string;
          encodedImage: string;
          payload: string;
        }>('/mp/checkout/pix', {
          method: 'POST',
          headers: { 'x-tenant-slug': slug || '' },
        });
        setPixData({
          encodedImage: resp.encodedImage,
          payload: resp.payload,
          paymentId: resp.paymentId,
        });
        setPolling(true);
        setIsProcessing(false);
        toast.success('PIX gerado! Escaneie o QR Code ou copie o código.');
      } else if (paymentMethod === 'card') {
        const [expiryMonth, expiryYear] = cardForm.expiry.split('/').map((s) => s.trim());
        const resp = await api<{
          subscriptionId: string;
          status: string;
          cardLastFour: string;
          message: string;
        }>('/mp/checkout/card', {
          method: 'POST',
          headers: { 'x-tenant-slug': slug || '' },
          body: JSON.stringify({
            holderName: cardForm.holderName,
            number: cardForm.number,
            expiryMonth,
            expiryYear: expiryYear ? `20${expiryYear}` : '',
            ccv: cardForm.cvv,
            cpfCnpj: cardForm.cpf.replace(/\D/g, ''),
          }),
        });
        handleUpgradeSuccess(resp.message);
      } else if (paymentMethod === 'boleto') {
        const resp = await api<{
          paymentId: string;
          bankSlipUrl?: string;
          invoiceUrl?: string;
        }>('/mp/checkout/boleto', {
          method: 'POST',
          headers: { 'x-tenant-slug': slug || '' },
        });
        setBoletoData({
          bankSlipUrl: resp.bankSlipUrl,
          invoiceUrl: resp.invoiceUrl,
          paymentId: resp.paymentId,
        });
        setIsProcessing(false);
        toast.success('Boleto gerado!');
      }
    } catch (err) {
      setIsProcessing(false);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar pagamento');
    }
  };

  const handleSubmitPayment = async () => {
    if (!hasBillingData(user) && paymentMethod !== 'card') {
      setShowBillingForm(true);
      return;
    }
    await processPayment();
  };

  const handleFormatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 16);
    return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
  };

  const handleFormatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length >= 3) {
      return digits.slice(0, 2) + '/' + digits.slice(2);
    }
    return digits;
  };

  const handleFormatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const copyPixCode = () => {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const basicFeatures = PLAN_FEATURES.filter((f) => f.availableIn.includes('basico'));
  const completeOnlyFeatures = PLAN_FEATURES.filter(
    (f) => !f.availableIn.includes('basico') && f.availableIn.includes('completo')
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-100">
      <header className="bg-white dark:bg-[#121214] border-b border-slate-200 dark:border-[#262626] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-lg text-slate-900 dark:text-white">Upgrade de Plano</h1>
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        {step === 'compare' ? (
          <div className="space-y-12">
            <div className="text-center max-w-3xl mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-100 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 text-xs font-bold uppercase tracking-wider mb-4">
                  <Zap className="w-3.5 h-3.5" />
                  Desbloqueie o potencial da sua loja
                </span>
                <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                  Escolha o plano ideal para o seu negócio
                </h2>
                <p className="text-lg text-slate-500 dark:text-slate-400">
                  Sem taxa de adesão, sem comissões por pedido. Cancele quando quiser.
                </p>
              </motion.div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {Object.values(PLANS).map((plan, index) => {
                const isCurrent = currentPlan === plan.id;
                const isCompletePlan = plan.id === 'completo';

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`rounded-3xl p-8 flex flex-col border transition-all ${
                      isCompletePlan
                        ? 'bg-gradient-to-b from-orange-50 to-white dark:from-[#1c1c21] dark:to-[#18181B] border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.15)] relative'
                        : 'bg-white dark:bg-[#121214] border-slate-200 dark:border-[#262626]'
                    }`}
                  >
                    {isCompletePlan && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <span className="bg-orange-500 text-white text-xs font-bold uppercase tracking-wider py-1.5 px-4 rounded-full shadow-lg">
                          Mais Escolhido
                        </span>
                      </div>
                    )}

                    <div className={`mb-6 ${isCompletePlan ? 'mt-2' : ''}`}>
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        {plan.name}
                      </h3>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        {plan.description}
                      </p>
                    </div>

                    <div className="mb-8">
                      <span className="text-5xl font-extrabold text-slate-900 dark:text-white">
                        {formatPlanPrice(plan)}
                      </span>
                    </div>

                    <ul className="space-y-4 mb-8 flex-1">
                      {PLAN_FEATURES.filter((f) => f.availableIn.includes(plan.id)).map((feature) => (
                        <li key={feature.id} className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                          <span className={`text-slate-700 dark:text-slate-300 ${feature.highlight ? 'font-semibold' : ''}`}>
                            {feature.name}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <button
                        disabled
                        className="w-full py-4 rounded-xl font-bold bg-slate-100 dark:bg-[#262626] text-slate-500 cursor-not-allowed"
                      >
                        Plano Atual
                      </button>
                    ) : (
                      <button
                        onClick={() => setStep('checkout')}
                        className={`w-full py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                          isCompletePlan
                            ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.4)]'
                            : 'bg-slate-200 hover:bg-slate-300 dark:bg-[#262626] dark:hover:bg-[#3f3f46] text-slate-900 dark:text-white'
                        }`}
                      >
                        {isCompletePlan ? (
                          <>
                            Fazer Upgrade <ArrowRight className="w-5 h-5" />
                          </>
                        ) : (
                          'Escolher Básico'
                        )}
                      </button>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-center gap-8 text-slate-500 dark:text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-orange-500" />
                <span>Pagamento seguro via Mercado Pago</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" />
                <span>Ativação imediata</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-orange-500" />
                <span>Suporte via WhatsApp</span>
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-xl mx-auto"
          >
            <button
              onClick={() => {
                setStep('compare');
                setPixData(null);
                setBoletoData(null);
                setPolling(false);
              }}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white text-sm font-medium mb-6 flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4 rotate-180" /> Voltar aos planos
            </button>

            {!pixData && !boletoData ? (
              <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-8 shadow-xl">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                  Finalizar Upgrade
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                  Você está assinando o plano <strong className="text-slate-900 dark:text-white">{PLANS.completo.name}</strong>.
                </p>

                <div className="bg-slate-50 dark:bg-[#09090b] rounded-2xl p-6 mb-8 border border-slate-200 dark:border-[#262626]">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-slate-600 dark:text-slate-300">Plano {PLANS.completo.name}</span>
                    <span className="font-bold text-slate-900 dark:text-white">R$ {effectivePrice.toFixed(2).replace('.', ',')}/mês</span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-[#262626] pt-4 flex justify-between items-center">
                    <span className="font-bold text-slate-900 dark:text-white">Total</span>
                    <span className="text-2xl font-extrabold text-orange-600 dark:text-orange-500">
                      R$ {effectivePrice.toFixed(2).replace('.', ',')}/mês
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white mb-4">Forma de pagamento</h3>
                <div className="grid grid-cols-3 gap-3 mb-8">
                  <button
                    onClick={() => setPaymentMethod('pix')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-3 transition-colors ${
                      paymentMethod === 'pix'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                        : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                    }`}
                  >
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold text-lg">
                      P
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">PIX</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('card')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-3 transition-colors ${
                      paymentMethod === 'card'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                        : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                    }`}
                  >
                    <CreditCard className={`w-8 h-8 ${paymentMethod === 'card' ? 'text-orange-500' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-900 dark:text-white text-sm leading-tight text-center">Cartão<br /><span className="text-[10px] font-normal text-orange-500">recorrente</span></span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('boleto')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-3 transition-colors ${
                      paymentMethod === 'boleto'
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                        : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                    }`}
                  >
                    <Banknote className={`w-8 h-8 ${paymentMethod === 'boleto' ? 'text-orange-500' : 'text-slate-400'}`} />
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">Boleto</span>
                  </button>
                </div>

                {paymentMethod === 'card' && (
                  <div className="space-y-4 mb-8">
                    <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4 text-sm text-orange-700 dark:text-orange-300">
                      <strong>Cobrança recorrente mensal.</strong> Seu cartão será cobrado automaticamente todo mês. Cancele quando quiser.
                    </div>
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
                        onChange={(e) => setCardForm({ ...cardForm, number: handleFormatCardNumber(e.target.value) })}
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
                          onChange={(e) => setCardForm({ ...cardForm, expiry: handleFormatExpiry(e.target.value) })}
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
                        onChange={(e) => setCardForm({ ...cardForm, cpf: handleFormatCpf(e.target.value) })}
                        className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                      />
                    </div>
                  </div>
                )}

                {showBillingForm && !hasBillingData(user) && (
                  <div className="mb-8">
                    <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4 mb-4">
                      <p className="text-sm text-orange-700 dark:text-orange-300">
                        Precisamos dos dados do pagador para continuar com o pagamento.
                      </p>
                    </div>
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
                          const updatedUser = {
                            ...user!,
                            ownerCpfCnpj: sanitizeCpf(data.cpf),
                            ownerFirstName: data.firstName.trim(),
                            ownerLastName: data.lastName.trim(),
                            billingEmail: data.email.trim().toLowerCase(),
                            billingPhone: data.phone || '',
                            billingPostalCode: data.postalCode || '',
                            billingAddressNumber: data.addressNumber || '',
                          };
                          updateUser(updatedUser);
                          setShowBillingForm(false);
                          await processPayment(updatedUser);
                        } catch (err) {
                          toast.error(err instanceof Error ? err.message : 'Erro ao salvar dados de cobrança');
                        }
                      }}
                      isProcessing={isProcessing}
                      submitLabel="Salvar e continuar"
                      onBack={() => setShowBillingForm(false)}
                    />
                  </div>
                )}

                {paymentMethod === 'boleto' && !showBillingForm && (
                  <div className="bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 text-center space-y-4 mb-8">
                    <Banknote className="w-12 h-12 text-orange-500 mx-auto" />
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                      Ao gerar o boleto, você poderá pagar em qualquer banco ou casa lotérica.
                      <br />
                      <strong>O plano será ativado após a confirmação do pagamento.</strong>
                    </p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('compare')}
                    className="px-6 py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-xl font-bold transition-colors"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleSubmitPayment}
                    disabled={isProcessing || currentPlan === 'completo' || showBillingForm}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-70 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      `Confirmar Pagamento - R$ ${effectivePrice.toFixed(2).replace('.', ',')}/mês`
                    )}
                  </button>
                </div>
              </div>
            ) : pixData ? (
              <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-8 shadow-xl">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Pagamento via PIX
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400">
                    Escaneie o QR Code abaixo com seu aplicativo do banco
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 text-center space-y-4 mb-6">
                  <div className="w-56 h-56 bg-white p-4 rounded-xl mx-auto border border-slate-200 dark:border-[#3f3f46] flex items-center justify-center">
                    <img
                      src={`data:image/png;base64,${pixData.encodedImage}`}
                      alt="QR Code PIX"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Ou copie o código PIX Copia e Cola:</p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={pixData.payload}
                        className="flex-1 bg-white dark:bg-[#262626] border border-slate-200 dark:border-[#3f3f46] p-3 rounded-xl text-slate-700 dark:text-slate-300 text-sm font-mono truncate"
                      />
                      <button
                        onClick={copyPixCode}
                        className="p-3 bg-orange-600 hover:bg-orange-500 text-white rounded-xl transition-colors"
                      >
                        {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {polling && (
                  <div className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4 text-center">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-500 mx-auto mb-2" />
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      Aguardando confirmação do pagamento...
                    </p>
                    <p className="text-xs text-emerald-500 dark:text-emerald-500 mt-1">
                      Esta página será atualizada automaticamente quando o pagamento for confirmado.
                    </p>
                  </div>
                )}

                {!polling && (
                  <button
                    onClick={async () => {
                      try {
                        await api(`/mp/payment/${pixData!.paymentId}/approve`, {
                          method: 'POST',
                          headers: { 'x-tenant-slug': user?.tenantSlug || '' },
                        })
                        handleUpgradeSuccess()
                      } catch {
                        toast.error('Erro ao simular pagamento')
                      }
                    }}
                    className="mt-4 w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Simular Pagamento PIX (Sandbox)
                  </button>
                )}
                <button
                  onClick={() => navigate('/dashboard')}
                  className="mt-4 w-full py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-xl font-bold transition-colors"
                >
                  Ir para o Painel
                </button>
              </div>
            ) : boletoData && (
              <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-8 shadow-xl">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-blue-100 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Banknote className="w-8 h-8 text-blue-600 dark:text-blue-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    Boleto Gerado
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400">
                    Seu boleto foi gerado com sucesso. Após o pagamento, o plano será ativado.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 space-y-4 mb-6">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-[#262626] rounded-xl">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Valor</span>
                    <span className="font-bold text-slate-900 dark:text-white">R$ {effectivePrice.toFixed(2).replace('.', ',')}/mês</span>
                  </div>

                  <a
                    href={boletoData.bankSlipUrl || boletoData.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl font-bold transition-colors"
                  >
                    <ExternalLink className="w-5 h-5" />
                    Visualizar Boleto
                  </a>
                </div>

                <button
                  onClick={() => navigate('/dashboard')}
                  className="w-full py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-xl font-bold transition-colors"
                >
                  Ir para o Painel
                </button>
              </div>
            )}
          </motion.div>
        )}
      </main>
    </div>
  );
}
