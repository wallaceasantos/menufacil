import { ReactNode } from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { hasFeature, PLAN_FEATURES, type PlanType } from '../data/plans';
import { cn } from '../lib/utils';

interface FeatureGateProps {
  featureId: string;
  children: ReactNode;
  fallback?: ReactNode;
  plan?: PlanType;
}

interface UpgradePromptProps {
  featureId: string;
  className?: string;
  onUpgrade?: () => void;
}

/**
 * Componente de controle de acesso por recurso.
 * Renderiza children apenas se o usuário atual (ou plano informado) tiver acesso.
 */
export function FeatureGate({ featureId, children, fallback, plan }: FeatureGateProps) {
  const { user } = useAuth();
  const currentPlan = plan ?? user?.plan;

  if (hasFeature(featureId, currentPlan)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return <UpgradePrompt featureId={featureId} />;
}

/**
 * Banner padrão de upsell exibido quando o recurso não está disponível.
 */
export function UpgradePrompt({ featureId, className, onUpgrade }: UpgradePromptProps) {
  const { user } = useAuth();
  const feature = PLAN_FEATURES.find((f) => f.id === featureId);

  if (!feature) return null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-orange-200 dark:border-orange-500/20',
        'bg-gradient-to-br from-orange-50 to-white dark:from-orange-500/10 dark:to-[#18181B]',
        'p-6',
        className
      )}
    >
      <div className="absolute top-0 right-0 p-3 opacity-10">
        <Sparkles className="w-16 h-16 text-orange-500" />
      </div>

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
          <Lock className="w-6 h-6 text-orange-600 dark:text-orange-500" />
        </div>

        <div className="flex-1">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Recurso exclusivo do plano Completo
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            {feature.name}
            {feature.description && (
              <span className="block text-slate-500 dark:text-slate-400 mt-0.5">
                {feature.description}
              </span>
            )}
          </p>
        </div>

        {user?.plan !== 'completo' && (
          <button
            onClick={onUpgrade}
            className="shrink-0 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-orange-900/20"
          >
            Fazer Upgrade
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Hook-like helper para verificar acesso a um recurso dentro de componentes.
 */
export function useFeatureAccess(featureId: string, plan?: PlanType): boolean {
  const { user } = useAuth();
  return hasFeature(featureId, plan ?? user?.plan);
}
