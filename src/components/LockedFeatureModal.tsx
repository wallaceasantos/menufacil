import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Lock, Crown, CheckCircle2, ArrowRight } from 'lucide-react';
import { PLANS, PLAN_FEATURES, formatPlanPrice } from '../data/plans';

interface LockedFeatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureId: string;
}

/**
 * Modal exibido quando o usuário do plano Básico tenta acessar
 * um recurso exclusivo do plano Completo.
 */
export function LockedFeatureModal({ isOpen, onClose, featureId }: LockedFeatureModalProps) {
  const navigate = useNavigate();
  const feature = PLAN_FEATURES.find((f) => f.id === featureId);

  if (!isOpen || !feature) return null;

  const missingFeatures = PLAN_FEATURES.filter(
    (f) => !f.availableIn.includes('basico') && f.availableIn.includes('completo')
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            {/* Header */}
            <div className="relative h-32 bg-gradient-to-r from-orange-600 to-orange-400 p-6 flex flex-col justify-end">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-sm transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Recurso Bloqueado</h2>
                  <p className="text-orange-50 text-sm">Disponível no plano {PLANS.completo.name}</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.name}</h3>
                {feature.description && (
                  <p className="text-slate-500 dark:text-slate-400 text-sm">{feature.description}</p>
                )}
              </div>

              <div className="bg-slate-50 dark:bg-[#121214] rounded-2xl p-5 border border-slate-200 dark:border-[#262626]">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">
                  Faça upgrade e tenha acesso a:
                </p>
                <ul className="space-y-3">
                  {missingFeatures.map((f) => (
                    <li key={f.id} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${f.id === featureId ? 'text-orange-500' : 'text-slate-400'}`} />
                      <span className={`text-slate-700 dark:text-slate-300 ${f.id === featureId ? 'font-semibold' : ''}`}>
                        {f.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-500/10 rounded-xl border border-orange-200 dark:border-orange-500/20">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                  <span className="font-bold text-slate-900 dark:text-white">{PLANS.completo.name}</span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {formatPlanPrice(PLANS.completo)}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-3 bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] text-slate-700 dark:text-slate-300 rounded-xl font-semibold transition-colors"
                >
                  Agora não
                </button>
                <button
                  onClick={() => {
                    onClose();
                    navigate('/dashboard/upgrade');
                  }}
                  className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2"
                >
                  Fazer Upgrade <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
