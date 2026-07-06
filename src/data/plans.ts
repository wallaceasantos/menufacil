/**
 * Centralização da estratégia de planos do MenuFácil.
 * Todas as referências a planos, preços e recursos devem vir daqui.
 */

export type PlanType = 'basico' | 'completo';

export interface PlanConfig {
  id: PlanType;
  name: string;
  price: number;
  description: string;
  popular?: boolean;
}

export interface PlanFeature {
  id: string;
  name: string;
  description?: string;
  availableIn: PlanType[];
  highlight?: boolean;
}

export const PLANS: Record<PlanType, PlanConfig> = {
  basico: {
    id: 'basico',
    name: 'Grátis',
    price: 0,
    description: 'Tudo que você precisa para começar: cardápio digital, pedidos via WhatsApp e gestão de pedidos.',
  },
  completo: {
    id: 'completo',
    name: 'Completo',
    price: 79.9,
    description: 'Para o negócio que está crescendo: relatórios, estoque, CRM, cupons e gestão de equipe.',
    popular: true,
  },
};

export const PLAN_FEATURES: PlanFeature[] = [
  {
    id: 'digital-menu',
    name: 'Cardápio digital (Link e QR Code)',
    availableIn: ['basico', 'completo'],
  },
  {
    id: 'whatsapp-orders',
    name: 'Pedidos direcionados ao seu WhatsApp',
    availableIn: ['basico', 'completo'],
  },
  {
    id: 'no-order-fee',
    name: '0% de taxa por pedido',
    availableIn: ['basico', 'completo'],
    highlight: true,
  },
  {
    id: 'whatsapp-support',
    name: 'Suporte via WhatsApp',
    availableIn: ['basico', 'completo'],
  },
  {
    id: 'management-dashboard',
    name: 'Painel de gestão e relatórios de vendas',
    description: 'Dashboard com métricas, gráficos e produtos mais vendidos',
    availableIn: ['completo'],
    highlight: true,
  },
  {
    id: 'order-status-management',
    name: 'Gerenciamento do status dos pedidos',
    description: 'Controle completo do fluxo: Pendente, Preparando e Concluído',
    availableIn: ['basico', 'completo'],
  },
  {
    id: 'coupon-printing',
    name: 'Impressão automática de cupons',
    availableIn: ['completo'],
  },
  {
    id: 'custom-domain',
    name: 'Domínio personalizado',
    description: 'Use seu próprio domínio para o cardápio digital',
    availableIn: ['completo'],
  },
  {
    id: 'stock-control',
    name: 'Controle de estoque',
    description: 'Cadastre insumos, vincule receitas aos produtos e monitore reposição',
    availableIn: ['completo'],
    highlight: true,
  },
  {
    id: 'customer-crm',
    name: 'CRM e gestão de clientes',
    description: 'Histórico de pedidos, VIP, bloqueio e estatísticas por cliente',
    availableIn: ['completo'],
    highlight: true,
  },
  {
    id: 'discount-coupons',
    name: 'Cupons e descontos',
    description: 'Crie cupons percentuais ou valor fixo para atrair mais clientes',
    availableIn: ['completo'],
  },
  {
    id: 'delivery-zones',
    name: 'Áreas de entrega por região',
    description: 'Taxas diferentes por bairro, CEP ou raio de distância',
    availableIn: ['completo'],
  },
  {
    id: 'team-management',
    name: 'Gestão de equipe',
    description: 'Convide atendentes, cozinheiros e entregadores com perfis de acesso',
    availableIn: ['completo'],
  },
];

/**
 * Verifica se um recurso está disponível no plano informado.
 */
export function hasFeature(featureId: string, plan: PlanType | undefined | null): boolean {
  if (!plan) return false;
  const feature = PLAN_FEATURES.find((f) => f.id === featureId);
  if (!feature) return false;
  return feature.availableIn.includes(plan);
}

/**
 * Lista todos os recursos disponíveis em um plano.
 */
export function getFeaturesForPlan(plan: PlanType | undefined | null): PlanFeature[] {
  if (!plan) return [];
  return PLAN_FEATURES.filter((f) => f.availableIn.includes(plan));
}

/**
 * Lista todos os recursos que são exclusivos do plano Completo
 * (útil para upsell no plano Básico).
 */
export function getMissingFeatures(plan: PlanType | undefined | null): PlanFeature[] {
  if (!plan) return PLAN_FEATURES.filter((f) => f.availableIn.includes('completo'));
  return PLAN_FEATURES.filter((f) => !f.availableIn.includes(plan) && f.availableIn.includes('completo'));
}

/**
 * Retorna o label formatado do preço.
 */
export function formatPlanPrice(plan: PlanConfig): string {
  if (plan.price === 0) return 'Grátis';
  return `R$ ${plan.price.toFixed(2).replace('.', ',')}/mês`;
}

/**
 * Retorna o plano oposto ao informado.
 */
export function getUpgradeTarget(plan: PlanType | undefined | null): PlanType | null {
  if (!plan) return 'completo';
  if (plan === 'completo') return null;
  return 'completo';
}
