import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronRight, ChevronLeft, UtensilsCrossed, QrCode, TrendingUp, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao MenuFácil!',
    description: 'Este é o painel de controle da sua loja. Aqui você gerencia cardápio, pedidos e configurações em um só lugar.',
    icon: UtensilsCrossed,
  },
  {
    id: 'menu',
    title: 'Monte seu cardápio',
    description: 'Na aba "Cardápio" você cadastra categorias, produtos, preços e fotos. Tudo fica disponível no seu link digital.',
    icon: UtensilsCrossed,
  },
  {
    id: 'store',
    title: 'Configure sua loja',
    description: 'Em "Minha Loja" você define nome, telefone, endereço, taxa de entrega e horário de funcionamento.',
    icon: QrCode,
  },
  {
    id: 'upgrade',
    title: 'Acelere suas vendas',
    description: 'No plano Completo você libera relatórios de vendas, gestão de status dos pedidos e impressão de cupons.',
    icon: TrendingUp,
  },
  {
    id: 'support',
    title: 'Precisa de ajuda?',
    description: 'Na aba "Suporte" você pode abrir chamados e conversar com nossa equipe a qualquer momento.',
    icon: MessageCircle,
  },
];

const STORAGE_KEY = 'menufacil_tour_completed';

export function OnboardingTour() {
  const { user, isLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (user.role === 'admin') return;

    const completed = localStorage.getItem(STORAGE_KEY);
    if (!completed) {
      // Pequeno delay para não exibir imediatamente na carga da página
      const timer = setTimeout(() => setIsOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading]);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            {/* Progress Bar */}
            <div className="h-1 bg-slate-100 dark:bg-[#262626]">
              <motion.div
                className="h-full bg-orange-600"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Header */}
            <div className="relative h-28 bg-gradient-to-r from-orange-600 to-orange-400 flex items-center justify-center">
              <button
                onClick={handleSkip}
                className="absolute top-4 right-4 p-2 bg-black/20 hover:bg-black/40 rounded-full text-white backdrop-blur-sm transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <Icon className="w-8 h-8 text-white" />
              </div>
            </div>

            {/* Content */}
            <div className="p-8 text-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 block">
                Passo {currentStep + 1} de {TOUR_STEPS.length}
              </span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
                {step.title}
              </h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-200 dark:border-[#262626] flex items-center justify-between">
              <button
                onClick={handleSkip}
                className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Pular tour
              </button>

              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrevious}
                    className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#262626] rounded-lg transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg transition-colors inline-flex items-center gap-2"
                >
                  {currentStep === TOUR_STEPS.length - 1 ? 'Começar' : 'Próximo'}
                  {currentStep < TOUR_STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function resetOnboardingTour() {
  localStorage.removeItem(STORAGE_KEY);
}
