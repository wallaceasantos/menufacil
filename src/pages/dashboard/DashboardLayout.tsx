import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Settings, 
  Menu, 
  Bell,
  Search, 
  LogOut,
  X,
  Store,
  Headset,
  Package,
  MessageCircle,
  CreditCard,
  FileText,
  Users,
  ShoppingBag,
  Repeat,
  BarChart3,
  Truck,
  Printer,
  Tag
} from 'lucide-react';
import { NotificationCenter } from '../../components/NotificationCenter';
import { InstallPWA } from '../../components/InstallPWA';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { PlanBadge } from '../../components/PlanBadge';
import { getTenantSlug } from '../../data/tenantStorage';
import { apiWithTenant, api } from '../../lib/api';
import { OnboardingTour } from '../../components/OnboardingTour';
import { Sun, Moon } from 'lucide-react';

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const [inventoryAlertCount, setInventoryAlertCount] = useState(0);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [tenantName, setTenantName] = useState('');

  useEffect(() => {
    if (!user) return;
    const slug = getTenantSlug(user);
    apiWithTenant('/inventory/alerts', slug)
      .then((data: any) => setInventoryAlertCount(data.count || 0))
      .catch(() => setInventoryAlertCount(0));

    api('/team/pending')
      .then((data: any) => setPendingInvites(data.invites || []))
      .catch(() => setPendingInvites([]));

    apiWithTenant('/store', slug)
      .then((data: any) => setTenantName(data.name || ''))
      .catch(() => setTenantName(''));
  }, [user]);

  const tenantRole = user?.tenantRole || 'dono'
  const userPlan = user?.plan || 'basico'

  const allNavItems = [
    { name: 'Visão Geral', path: '/dashboard', icon: LayoutDashboard, roles: ['dono', 'atendente'], plans: ['basico', 'completo'] },
    { name: 'Cardápio', path: '/dashboard/menu', icon: UtensilsCrossed, roles: ['dono'], plans: ['basico', 'completo'] },
    { name: 'Minha Loja', path: '/dashboard/store', icon: Store, roles: ['dono'], plans: ['basico', 'completo'] },
    { name: 'Estoque', path: '/dashboard/inventory', icon: Package, roles: ['dono'], plans: ['completo'] },
    { name: 'Relatórios', path: '/dashboard/reports', icon: BarChart3, roles: ['dono'], plans: ['completo'] },
    { name: 'Áreas de Entrega', path: '/dashboard/delivery-zones', icon: Truck, roles: ['dono'], plans: ['completo'] },
    { name: 'Impressão', path: '/dashboard/printer', icon: Printer, roles: ['dono'], plans: ['completo'] },
    { name: 'Cupons', path: '/dashboard/discounts', icon: Tag, roles: ['dono'], plans: ['completo'] },
    { name: 'Equipe', path: '/dashboard/team', icon: Users, roles: ['dono'], plans: ['completo'] },
    { name: 'Configurações', path: '/dashboard/settings', icon: Settings, roles: ['dono'], plans: ['basico', 'completo'] },
    { name: 'Pagamentos', path: '/dashboard/payments', icon: CreditCard, roles: ['dono'], plans: ['basico', 'completo'] },
    { name: 'Assinatura', path: '/dashboard/subscription', icon: Repeat, roles: ['dono'], plans: ['basico', 'completo'] },
    { name: 'Faturas', path: '/dashboard/invoices', icon: FileText, roles: ['dono'], plans: ['basico', 'completo'] },
    { name: 'WhatsApp', path: '/dashboard/whatsapp', icon: MessageCircle, roles: ['dono'], plans: ['completo'] },
    { name: 'Suporte', path: '/dashboard/support', icon: Headset, roles: ['dono', 'atendente'], plans: ['basico', 'completo'] },
    { name: 'Clientes', path: '/dashboard/customers', icon: Users, roles: ['dono', 'atendente'], plans: ['completo'] },
    { name: 'Pedidos', path: '/dashboard/orders', icon: ShoppingBag, roles: ['dono', 'atendente', 'cozinha', 'entregador'], plans: ['completo'] },
  ]

  const navItems = allNavItems.filter((item) => item.roles.includes(tenantRole) && item.plans.includes(userPlan))

  // Redirect non-authorized users away from restricted pages
  useEffect(() => {
    const currentPath = location.pathname
    const allowed = allNavItems.filter((item) => item.roles.includes(tenantRole) && item.plans.includes(userPlan))
    const isAllowed = allowed.some((item) => currentPath === item.path || currentPath.startsWith(item.path + '/'))
    if (!isAllowed && currentPath !== '/dashboard' && currentPath.startsWith('/dashboard')) {
      window.location.href = '/dashboard'
    }
  }, [location.pathname, tenantRole, userPlan])

  const handleAcceptInvite = async (token: string) => {
    try {
      await api('/team/accept', { method: 'POST', body: JSON.stringify({ token }) })
      toast('Convite aceito! Recarregando...', { icon: '✅' })
      setTimeout(() => window.location.reload(), 1000)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erro ao aceitar convite')
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] flex">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-[#121214] border-r border-slate-200 dark:border-[#262626] flex flex-col transform transition-transform duration-300 lg:translate-x-0 lg:static lg:block
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-slate-200 dark:border-[#262626]">
          <Link to="/dashboard" onClick={() => setIsSidebarOpen(false)} className="flex items-center gap-2">
            <img src="/logo.png" alt="MenuFácil"
              className="h-8 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const fb = document.querySelector('.logo-fallback')
                if (fb) (fb as HTMLElement).classList.remove('hidden')
              }} />
            <div className="w-8 h-8 bg-orange-600 rounded-lg items-center justify-center logo-fallback hidden">
              <UtensilsCrossed className="w-5 h-5 text-white" />
            </div>
          </Link>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-1 bg-white dark:bg-[#121214]">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors ${
                  isActive 
                    ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' 
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#262626] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.name === 'Estoque' && inventoryAlertCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-[#121214]" />
                  )}
                </div>
                <span className="flex-1">{item.name}</span>
                {item.name === 'Estoque' && inventoryAlertCount > 0 && (
                  <span className="text-xs bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                    {inventoryAlertCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 p-4 border-t border-slate-200 dark:border-[#262626] bg-white dark:bg-[#121214]">
          <div className="flex items-center gap-3 mb-4 px-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-500 font-bold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {user?.name || 'Usuário'}
                  </p>
                  <PlanBadge plan={user?.plan} size="sm" />
                  {tenantRole !== 'dono' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-[#3f3f46] text-slate-600 dark:text-slate-400 font-bold">
                      {tenantRole === 'atendente' ? 'Atendente' : tenantRole === 'cozinha' ? 'Cozinha' : 'Entregador'}
                    </span>
                  )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user?.email || 'email@example.com'}
              </p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg font-medium text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-slate-50 dark:bg-[#09090b]">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-[#121214] border-b border-slate-200 dark:border-[#262626] flex items-center justify-between px-4 sm:px-6 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626] transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              {tenantName && (
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                  {tenantName}
                </span>
              )}
            </div>
            <div className="hidden sm:flex items-center relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3" />
              <input 
                type="text" 
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 bg-slate-100 dark:bg-[#09090b] border-none rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:outline-none w-64 transition-all"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626] transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <NotificationCenter />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          <InstallPWA />
          <OnboardingTour />
          {pendingInvites.length > 0 && (
            <div className="mb-6 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-orange-600 dark:text-orange-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-orange-800 dark:text-orange-300">Você tem convites pendentes!</h4>
                  <div className="space-y-2 mt-2">
                    {pendingInvites.map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between bg-white dark:bg-[#121214] rounded-xl p-3 border border-orange-200 dark:border-orange-500/10">
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{inv.tenantName}</p>
                          <p className="text-xs text-slate-500">como {inv.tenantRole === 'atendente' ? 'Atendente' : inv.tenantRole === 'cozinha' ? 'Cozinha' : 'Entregador'}</p>
                        </div>
                        <button onClick={() => handleAcceptInvite(inv.token)}
                          className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-bold transition-colors">
                          Aceitar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {localStorage.getItem('global_announcement') && (
            <div className="mb-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300 px-4 py-3 rounded-xl flex items-start gap-3">
              <Bell className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold">Aviso do Sistema</h4>
                <p className="text-sm mt-1">{localStorage.getItem('global_announcement')}</p>
              </div>
            </div>
          )}

          {user?.paymentStatus === 'overdue' && (
            <div className="mb-6 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-800 dark:text-red-300 px-4 py-3 rounded-xl flex items-start gap-3">
              <div className="shrink-0 mt-0.5 text-red-600 dark:text-red-500">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h4 className="font-bold">Aviso Importante: Mensalidade em Atraso</h4>
                <p className="text-sm mt-1">
                  Você não pagou a mensalidade e tem {user.overdueDays || 3} dias para regularizar, senão os serviços serão suspensos.
                  Por favor, entre em contato com o suporte ou realize o pagamento para evitar interrupções.
                </p>
              </div>
            </div>
          )}

          <Outlet />
        </div>
      </main>
    </div>
  );
}
