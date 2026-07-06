import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, CreditCard, Copy } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { PLANS, PLAN_FEATURES, formatPlanPrice, type PlanType } from '../data/plans';
import { generateStaticPixCode } from '../lib/pix';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const { user, updateUser } = useAuth();
  const [step, setStep] = useState<'details' | 'payment'>('details');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card'>('pix');
  const [isProcessing, setIsProcessing] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen || !user) return null;

  const handleUpgrade = () => {
    setIsProcessing(true);
    // Simulate payment processing
    setTimeout(() => {
      updateUser({ ...user, plan: 'completo' as PlanType });
      setIsProcessing(false);
      toast.success('Parabéns! Seu plano foi atualizado com sucesso.');
      onClose();
    }, 2000);
  };

  const copyPixCode = () => {
    navigator.clipboard.writeText(generateStaticPixCode(PLANS.completo.price));
    setCopied(true);
    toast.success('Código PIX copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col my-8"
        >
          <div className="relative h-32 bg-gradient-to-r from-orange-600 to-orange-400 p-6 flex flex-col justify-end">
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-sm transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-white">Plano Completo</h2>
            <p className="text-orange-50 font-medium">Eleve o nível do seu negócio</p>
          </div>

          <div className="p-6 md:p-8">
            {step === 'details' ? (
              <div className="space-y-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">O que você ganha:</h3>
                  <ul className="space-y-3">
                    {PLAN_FEATURES.filter((f) => !f.availableIn.includes('basico')).map((feature) => (
                      <li key={feature.id} className="flex items-start gap-3 text-slate-700 dark:text-slate-300">
                        <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                        <span>{feature.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Valor Mensal</p>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">
                      {formatPlanPrice(PLANS.completo)}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={() => setStep('payment')}
                  className="w-full bg-orange-600 hover:bg-orange-700 text-white h-14 rounded-xl font-bold text-lg shadow-lg shadow-orange-900/20 transition-all"
                >
                  Assinar Agora
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg mb-4">Escolha a forma de pagamento</h3>
                
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <button 
                    onClick={() => setPaymentMethod('pix')}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center justify-center gap-3 transition-colors ${
                      paymentMethod === 'pix' 
                        ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' 
                        : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                    }`}
                  >
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-bold">P</div>
                    <span className="font-semibold text-slate-900 dark:text-white">PIX</span>
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
                    <span className="font-semibold text-slate-900 dark:text-white">Cartão de Crédito</span>
                  </button>
                </div>

                {paymentMethod === 'pix' ? (
                  <div className="bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 text-center space-y-4">
                    <div className="w-48 h-48 bg-white p-4 rounded-xl mx-auto border border-slate-200">
                      {/* Fake QR Code */}
                      <div className="w-full h-full bg-[url('https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg')] bg-cover opacity-80 mix-blend-multiply"></div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Ou copie o código PIX Copia e Cola:</p>
                      <button 
                        onClick={copyPixCode}
                        className="flex items-center justify-center gap-2 w-full bg-white dark:bg-[#262626] border border-slate-200 dark:border-[#3f3f46] p-3 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#3f3f46] transition-colors"
                      >
                        <Copy className="w-4 h-4" />
                        <span className="text-sm font-medium truncate">{copied ? 'Copiado!' : '00020126580014br.gov.bcb.pix...'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Número do Cartão</label>
                      <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Validade</label>
                        <input type="text" placeholder="MM/AA" className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">CVV</label>
                        <input type="text" placeholder="123" className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome no Cartão</label>
                      <input type="text" placeholder="JOAO S SILVA" className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500" />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-[#262626]">
                  <button 
                    onClick={() => setStep('details')}
                    className="px-6 py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-xl font-bold transition-colors"
                    disabled={isProcessing}
                  >
                    Voltar
                  </button>
                  <button 
                    onClick={handleUpgrade}
                    disabled={isProcessing}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all disabled:opacity-70 flex items-center justify-center"
                  >
                    {isProcessing ? 'Processando...' : `Confirmar Pagamento - ${formatPlanPrice(PLANS.completo)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
