import type { PlanType } from './plans';

export interface TenantProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  active: boolean;
  image?: string;
  complements?: TenantComplement[];
}

export interface TenantComplement {
  id: string;
  name: string;
  price: number;
}

export interface TenantCategory {
  name: string;
  sortOrder: number;
}

export interface TenantStoreConfig {
  name: string;
  description: string;
  address: string;
  phone: string;
  deliveryFee: number;
  minOrder: number;
  openingHours: string;
  closingHours: string;
  logo?: string;
  banner?: string;
  isOpen?: boolean;
}

export interface TenantPublicData {
  slug: string;
  name: string;
  ownerName: string;
  email: string;
  plan: PlanType;
  categories: TenantCategory[];
  products: TenantProduct[];
  store: TenantStoreConfig;
  updatedAt: string;
}

const STORAGE_KEY = 'menufacil_tenants';

export interface UserLike {
  name?: string;
  tenantSlug?: string;
}

/**
 * Retorna o slug do tenant, preferindo o valor salvo no usuário.
 */
export function getTenantSlug(user?: UserLike | null): string {
  if (!user) return '';
  return user.tenantSlug || generateSlug(user.name || '');
}

/**
 * Gera um slug a partir do nome do estabelecimento ou do usuário.
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

/**
 * Retorna todos os tenants armazenados.
 */
export function getAllTenants(): Record<string, TenantPublicData> {
  if (typeof window === 'undefined') return {};
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Retorna um tenant pelo slug.
 */
export function getTenantBySlug(slug: string): TenantPublicData | null {
  const tenants = getAllTenants();
  return tenants[slug] || null;
}

/**
 * Salva/atualiza um tenant.
 */
export function saveTenant(tenant: TenantPublicData): void {
  if (typeof window === 'undefined') return;
  const tenants = getAllTenants();
  tenants[tenant.slug] = {
    ...tenant,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tenants));
}

/**
 * Retorna o slug do tenant atual logado.
 */
export function getCurrentTenantSlug(userName: string): string {
  return generateSlug(userName);
}

/**
 * Salva os dados do tenant logado a partir dos dados do dashboard.
 */
export function saveCurrentTenant(data: {
  userId: string;
  userName: string;
  email: string;
  plan: PlanType;
  categories: string[];
  products: TenantProduct[];
  store: TenantStoreConfig;
}): void {
  const slug = generateSlug(data.userName);

  const tenant: TenantPublicData = {
    slug,
    name: data.store.name || data.userName,
    ownerName: data.userName,
    email: data.email,
    plan: data.plan,
    categories: data.categories.map((name, index) => ({ name, sortOrder: index })),
    products: data.products.filter((p) => p.active),
    store: {
      ...data.store,
      isOpen: isStoreOpen(data.store.openingHours, data.store.closingHours),
    },
    updatedAt: new Date().toISOString(),
  };

  saveTenant(tenant);
}

/**
 * Verifica se a loja está aberta com base no horário de funcionamento.
 */
export function isStoreOpen(openingHours?: string, closingHours?: string): boolean {
  if (!openingHours || !closingHours) return true;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [openHour, openMinute] = openingHours.split(':').map(Number);
  const [closeHour, closeMinute] = closingHours.split(':').map(Number);

  const openMinutes = openHour * 60 + openMinute;
  const closeMinutes = closeHour * 60 + closeMinute;

  if (closeMinutes < openMinutes) {
    // Funcionamento noturno (passa da meia-noite)
    return currentMinutes >= openMinutes || currentMinutes <= closeMinutes;
  }

  return currentMinutes >= openMinutes && currentMinutes <= closeMinutes;
}
