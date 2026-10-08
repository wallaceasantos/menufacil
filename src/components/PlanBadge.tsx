import { Crown, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { PLANS, type PlanType } from '../data/plans';

interface PlanBadgeProps {
  plan?: PlanType | null;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Badge visual padronizado para exibição do plano atual do usuário.
 */
export function PlanBadge({ plan, size = 'sm', className }: PlanBadgeProps) {
  if (!plan || !PLANS[plan]) return null;

  const isComplete = plan === 'completo';
  const Icon = isComplete ? Crown : Zap;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium border',
        isComplete
          ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20'
          : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
        size === 'sm' && 'px-2.5 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        className
      )}
    >
      <Icon className={cn(size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5')} />
      {PLANS[plan].name}
    </span>
  );
}
