export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'Enterprise' | 'Pro' | 'Standard';
  status: 'Active' | 'Setup' | 'Suspended';
  health: number; // 0 to 100
}

export interface DashboardStats {
  totalTenants: number;
  tenantsGrowth: number;
  orders24h: number;
  mrr: number;
  mrrTarget: number;
  avgLatency: number;
}

export const mockStats: DashboardStats = {
  totalTenants: 158,
  tenantsGrowth: 12,
  orders24h: 12402,
  mrr: 42500,
  mrrTarget: 50000,
  avgLatency: 42
};

export const mockTenants: Tenant[] = [
  {
    id: 'b0e42d72-8822-4a00-988d-e08df053d20a',
    name: 'Burger King XP',
    slug: 'burger-king-xp',
    plan: 'Enterprise',
    status: 'Active',
    health: 100
  },
  {
    id: 'f285d852-6c2d-4251-ba81-12ec8af342bd',
    name: 'Coffee Loft 22',
    slug: 'loft-coffee-22',
    plan: 'Pro',
    status: 'Active',
    health: 80
  },
  {
    id: '707cf600-4034-406f-b258-0056127b36f0',
    name: 'Sushi Garden',
    slug: 'sushi-garden',
    plan: 'Standard',
    status: 'Setup',
    health: 40
  },
  {
    id: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
    name: 'Pizzeria Romana',
    slug: 'roma-pizza',
    plan: 'Pro',
    status: 'Active',
    health: 100
  }
];
