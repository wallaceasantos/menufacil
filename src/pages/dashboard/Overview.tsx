import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Users,
  Search,
  QrCode,
  Link as LinkIcon,
  Download,
  Copy,
  CheckCircle2,
  Crown,
  ArrowRight,
  Printer,
  Package
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import QRCode from 'qrcode';
import { OrderModal } from '../../components/OrderModal';
import { PlanBadge } from '../../components/PlanBadge';
import { FeatureGate } from '../../components/FeatureGate';
import { LockedFeatureModal } from '../../components/LockedFeatureModal';
import { useAuth } from '../../contexts/AuthContext';
import { PLAN_FEATURES } from '../../data/plans';
import { generateSlug, getTenantSlug } from '../../data/tenantStorage';
import { apiWithTenant } from '../../lib/api';

interface DashboardOrder {
  id: string;
  rawId: string;
  customer: string;
  phone: string;
  address: string;
  items: string;
  total: string;
  rawTotal: number;
  status: string;
  rawStatus: string;
  createdAt: string;
  stockDeducted?: boolean;
}

const STATUS_LABEL_TO_RAW: Record<string, string> = {
  Pendente: 'pending',
  Preparando: 'preparing',
  Concluído: 'completed',
  Cancelado: 'cancelled',
};

export function Overview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orderFilter, setOrderFilter] = useState('Todos');
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrGenerating, setQrGenerating] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState<DashboardOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const storeSlug = useMemo(() => user?.tenantSlug || generateSlug(user?.name || 'minha-loja'), [user]);

  const tenantSlug = useMemo(() => getTenantSlug(user), [user]);

  useEffect(() => {
    let cancelled = false;
    async function generateQR() {
      setQrGenerating(true);
      try {
        const url = `${window.location.origin}/loja/${storeSlug}`
        const dataUrl = await QRCode.toDataURL(url, {
          width: 400,
          margin: 2,
          color: { dark: '#f97316', light: '#ffffff' },
        })
        if (!cancelled) setQrDataUrl(dataUrl)
      } catch {
        // fallback silently
      } finally {
        if (!cancelled) setQrGenerating(false)
      }
    }
    generateQR()
    return () => { cancelled = true }
  }, [storeSlug])

  const downloadQRCode = () => {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.download = `cardapio-${storeSlug}.png`
    link.href = qrDataUrl
    link.click()
    toast.success('QR Code baixado!')
  }

  useEffect(() => {
    async function loadOrders() {
      if (!tenantSlug) return;
      setLoadingOrders(true);
      try {
        const resp = await apiWithTenant<any>('/orders?limit=10', tenantSlug);
        setRecentOrders(resp.data || (Array.isArray(resp) ? resp : []));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar pedidos';
        toast.error(message);
      } finally {
        setLoadingOrders(false);
      }
    }

    loadOrders();
  }, [tenantSlug]);

  const updateOrderStatus = async (orderId: string, newStatusLabel: string) => {
    const rawStatus = STATUS_LABEL_TO_RAW[newStatusLabel];
    if (!rawStatus) return;

    try {
      await apiWithTenant(`/orders/${orderId}/status`, tenantSlug, {
        method: 'PATCH',
        body: JSON.stringify({ status: rawStatus }),
      });

      setRecentOrders((prev) =>
        prev.map((order) =>
          order.rawId === orderId || order.id === orderId
            ? { ...order, status: newStatusLabel, rawStatus }
            : order
        )
      );

      toast.success('Status atualizado');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar status';
      toast.error(message);
    }
  };

  const updateBulkStatus = async (orderIds: string[], newStatusLabel: string) => {
    const rawStatus = STATUS_LABEL_TO_RAW[newStatusLabel];
    if (!rawStatus) return;

    try {
      await apiWithTenant('/orders/bulk-status', tenantSlug, {
        method: 'PATCH',
        body: JSON.stringify({
          ids: orderIds.map((id) => (id.startsWith('#') ? id.slice(1) : id)),
          status: rawStatus,
        }),
      });

      setRecentOrders((prev) =>
        prev.map((order) =>
          orderIds.includes(order.id)
            ? { ...order, status: newStatusLabel, rawStatus }
            : order
        )
      );

      toast.success('Status atualizado em massa');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao atualizar status';
      toast.error(message);
    }
  };

  const metrics = useMemo(() => {
    const validOrders = recentOrders.filter(o => o.status !== 'Cancelado');
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthPrefix = todayStr.substring(0, 7);

    const totalRevenueMonth = validOrders
      .filter(o => o.createdAt && o.createdAt.startsWith(currentMonthPrefix))
      .reduce((acc, order) => acc + (isNaN(order.rawTotal) ? 0 : order.rawTotal), 0);

    const ordersToday = recentOrders.filter(o => o.createdAt && o.createdAt.startsWith(todayStr)).length;
    
    const uniqueClients = new Set(validOrders.map(o => o.phone || o.customer)).size;
    const ticketMedio = validOrders.length > 0 ? validOrders.reduce((acc, order) => acc + (isNaN(order.rawTotal) ? 0 : order.rawTotal), 0) / validOrders.length : 0;

    const baseMetrics = [
      { title: 'Faturamento do Mês', value: `R$ ${totalRevenueMonth.toFixed(2).replace('.', ',')}`, change: '+12.5%', isPositive: true, icon: DollarSign },
      { title: 'Pedidos Hoje', value: ordersToday.toString(), change: '+5.2%', isPositive: true, icon: ShoppingBag },
      { title: 'Novos Clientes', value: uniqueClients.toString(), change: '+2.1%', isPositive: true, icon: Users },
      { title: 'Ticket Médio', value: `R$ ${ticketMedio.toFixed(2).replace('.', ',')}`, change: '+8.4%', isPositive: true, icon: TrendingUp },
    ];

    return baseMetrics;
  }, [recentOrders, user?.plan, user?.name]);

  const salesData = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = d.toLocaleDateString('pt-BR', { weekday: 'short' });
      
      const dayOrders = recentOrders.filter(o => o.status !== 'Cancelado' && o.createdAt && o.createdAt.startsWith(dateStr));
      const dayTotal = dayOrders.reduce((acc, order) => {
        return acc + (isNaN(order.rawTotal) ? 0 : order.rawTotal);
      }, 0);
        
      days.push({
        name: dayName,
        vendas: dayTotal > 0 ? dayTotal : Math.floor(Math.random() * 2000) + 500,
        lucro: dayTotal > 0 ? dayTotal : 0,
      });
    }
    return days;
  }, [recentOrders, user?.plan, user?.name]);

  const topProducts = useMemo(() => {
    const productCounts: { [key: string]: number } = {};
    const validOrders = recentOrders.filter(o => o.status !== 'Cancelado');
    validOrders.forEach(order => {
      const items = Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? order.items.split(', ') : []);
      if (Array.isArray(items)) {
        items.forEach((item: any) => {
          const name = item.product?.name || item.name || (typeof item === 'string' ? item : '');
          const qty = item.quantity || 1;
          if (name) {
            productCounts[name] = (productCounts[name] || 0) + qty;
          }
        });
      } else if (typeof items === 'object') {
        for (const name of Object.keys(items)) {
          productCounts[name] = (productCounts[name] || 0) + (items[name] || 1);
        }
      }
    });
    
    if (Object.keys(productCounts).length === 0) {
      return [
        { name: 'X-Burger Artesanal', vendas: 45 },
        { name: 'X-Bacon', vendas: 38 },
        { name: 'Batata Frita Rústica', vendas: 25 },
        { name: 'Refrigerante Cola 350ml', vendas: 20 },
      ];
    }

    return Object.entries(productCounts)
      .map(([name, vendas]) => ({ name, vendas }))
      .sort((a, b) => b.vendas - a.vendas)
      .slice(0, 5);
  }, [recentOrders]);

  const filteredOrders = recentOrders.filter(order => {
    const matchesFilter = orderFilter === 'Todos' || order.status === orderFilter;
    const searchLower = orderSearch.toLowerCase();
    const matchesSearch = 
      order.id.toLowerCase().includes(searchLower) || 
      order.customer.toLowerCase().includes(searchLower);
      
    return matchesFilter && matchesSearch;
  });

  if (user?.plan === 'basico') {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bem-vindo, {user?.name.split(' ')[0]}!</h1>
            <PlanBadge plan={user?.plan} size="md" />
          </div>
          <p className="text-slate-500 dark:text-slate-400">Aqui está o resumo da sua loja.</p>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/20 dark:to-[#18181B] border border-orange-200 dark:border-orange-500/30 rounded-2xl p-8 flex flex-col md:flex-row items-center gap-8 justify-between">
          <div className="space-y-4 max-w-xl">
            <div className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-orange-600 dark:text-orange-500" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Faça um upgrade para o Plano Completo</h2>
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              O seu plano Básico permite usar o Cardápio Digital e receber pedidos pelo WhatsApp sem taxas.
              Desbloqueie ainda mais recursos para profissionalizar a gestão do seu negócio:
            </p>
            <ul className="grid sm:grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
              {PLAN_FEATURES.filter((f) => !f.availableIn.includes('basico')).map((feature) => (
                <li key={feature.id} className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
                  {feature.name}
                </li>
              ))}
            </ul>
            <button 
              onClick={() => navigate('/dashboard/upgrade')}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors inline-flex items-center gap-2"
            >
              Conhecer Plano Completo <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="hidden md:flex w-48 h-48 bg-white dark:bg-[#18181B] rounded-2xl shadow-xl flex-col justify-center items-center p-6 text-center border border-slate-200 dark:border-[#262626]">
            <TrendingUp className="w-12 h-12 text-orange-500 mb-4" />
            <span className="font-bold text-slate-900 dark:text-white text-sm">Desbloqueie todo o potencial da sua loja</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
           <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/20 rounded-xl flex items-center justify-center mb-6">
                <ShoppingBag className="w-6 h-6 text-orange-600 dark:text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Seu Cardápio Digital</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                Gerencie seus produtos, categorias e preços. Mantenha seu cardápio sempre atualizado para receber mais pedidos no WhatsApp.
              </p>
            </div>
            <button 
              onClick={() => navigate('/dashboard/menu')}
              className="w-full bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] text-slate-900 dark:text-white py-2.5 rounded-lg font-semibold transition-colors text-sm"
            >
              Acessar Cardápio
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 flex flex-col"
          >
            <div className="flex-1">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/20 rounded-xl flex items-center justify-center mb-6">
                <QrCode className="w-6 h-6 text-orange-600 dark:text-orange-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Acesso ao Cardápio</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
                Compartilhe o link da sua loja ou gere um QR Code para imprimir e colocar nas mesas ou panfletos.
              </p>

              <div className="flex items-center gap-2 mb-6 p-3 bg-slate-50 dark:bg-[#09090b] rounded-lg border border-slate-200 dark:border-[#262626]">
                <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
                <a 
                  href={`/loja/${storeSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate flex-1 underline"
                  title="Acessar sua loja pública"
                >
                  menufacil.com/{storeSlug}
                </a>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/loja/${storeSlug}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400 text-sm font-semibold flex items-center gap-1"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>

              {qrDataUrl && (
                <div className="flex justify-center mb-6">
                  <img
                    src={qrDataUrl}
                    alt="QR Code do cardapio"
                    className="w-48 h-48 rounded-xl border-2 border-orange-200 dark:border-orange-500/20 object-contain bg-white"
                  />
                </div>
              )}
            </div>
            <button 
              disabled={qrGenerating}
              className="w-full bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white py-2.5 rounded-lg font-semibold transition-colors text-sm flex items-center justify-center gap-2"
              onClick={downloadQRCode}
            >
              <Download className="w-4 h-4" /> {qrGenerating ? 'Gerando...' : 'Baixar QR Code'}
            </button>
          </motion.div>
        </div>

        {/* Teaser de recursos bloqueados */}
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: TrendingUp, title: 'Relatórios de Vendas', feature: 'management-dashboard' },
            { icon: DollarSign, title: 'Ticket Médio', feature: 'management-dashboard' },
            { icon: Printer, title: 'Impressão de Cupons', feature: 'coupon-printing' },
          ].map((item, index) => (
            <motion.div
              key={item.feature + index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + index * 0.1 }}
              className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 opacity-75 hover:opacity-100 transition-opacity"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-10 h-10 bg-slate-100 dark:bg-[#262626] rounded-lg flex items-center justify-center">
                  <item.icon className="w-5 h-5 text-slate-500" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-orange-600 dark:text-orange-500">Completo</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">{item.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                Disponível no plano Completo.
              </p>
              <button
                onClick={() => setLockedFeature(item.feature)}
                className="text-sm font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400"
              >
                Desbloquear →
              </button>
            </motion.div>
          ))}
        </div>

        <LockedFeatureModal
          isOpen={!!lockedFeature}
          onClose={() => setLockedFeature(null)}
          featureId={lockedFeature || 'management-dashboard'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Visão Geral</h1>
          <PlanBadge plan={user?.plan} size="md" />
        </div>
        <p className="text-slate-500 dark:text-slate-400">Acompanhe as métricas do seu negócio em tempo real.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-orange-50 dark:bg-orange-500/10 rounded-xl">
                <metric.icon className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              </div>
              <span className={`text-sm font-medium ${metric.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {metric.change}
              </span>
            </div>
            <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{metric.title}</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{metric.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Sales Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]"
      >
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Desempenho de Vendas</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }}
                tickFormatter={(value) => `R$${value}`}
              />
              <Tooltip 
                cursor={{ fill: '#f1f5f9', opacity: 0.1 }}
                contentStyle={{ 
                  backgroundColor: '#1e293b', 
                  border: 'none',
                  borderRadius: '8px',
                  color: '#f8fafc'
                }}
              />
              <Bar dataKey="vendas" fill="#ea580c" radius={[4, 4, 0, 0]} name="Vendas" />
              {user?.plan === 'completo' && (
                <Bar dataKey="lucro" fill="#22c55e" radius={[4, 4, 0, 0]} name="Lucro" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Recent Orders and Chart Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="lg:col-span-2 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] overflow-hidden"
        >
          <div className="p-6 border-b border-slate-200 dark:border-[#262626] flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Últimos Pedidos</h2>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="Buscar por ID ou Nome do cliente..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                </div>
                
                <select 
                  value={orderFilter}
                  onChange={(e) => setOrderFilter(e.target.value)}
                  className="bg-white dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white py-2 px-3 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  <option value="Todos">Todos os Status</option>
                  <option value="Pendente">Pendentes</option>
                  <option value="Preparando">Preparando</option>
                  <option value="Concluído">Concluídos</option>
                  <option value="Cancelado">Cancelados</option>
                </select>
              </div>
              
              {selectedOrders.length > 0 && (
                <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-500/10 px-3 py-2 rounded-lg border border-orange-200 dark:border-orange-500/20">
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    {selectedOrders.length} selecionado(s)
                  </span>
                  <select 
                    className="bg-white dark:bg-[#262626] text-sm text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#3f3f46] rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      if (!newStatus) return;
                      updateBulkStatus(selectedOrders, newStatus);
                      setSelectedOrders([]);
                      e.target.value = '';
                    }}
                  >
                    <option value="">Alterar Status</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Preparando">Preparando</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            {loadingOrders ? (
              <div className="py-12 text-center text-slate-500 dark:text-slate-400">
                Carregando pedidos...
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-[#09090b]">
                    <th className="py-3 px-4 w-12">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                        checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrders(filteredOrders.map(o => o.id));
                          } else {
                            setSelectedOrders([]);
                          }
                        }}
                      />
                    </th>
                    <th className="py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pedido</th>
                    <th className="py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="py-3 px-6 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#262626]">
                  {filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                      <tr 
                        key={order.id} 
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsOrderModalOpen(true);
                        }}
                        className="hover:bg-slate-50 dark:hover:bg-[#09090b] transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                            checked={selectedOrders.includes(order.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedOrders([...selectedOrders, order.id]);
                              } else {
                                setSelectedOrders(selectedOrders.filter(id => id !== order.id));
                              }
                            }}
                          />
                        </td>
                        <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">
                          <div className="flex flex-col">
                            <span>{order.id}</span>
                            <span className="text-xs text-slate-500 font-normal">{order.customer}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                            ${order.status === 'Concluído' ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20' : 
                              order.status === 'Preparando' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' : 
                              order.status === 'Pendente' ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20' : 
                              'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'}
                          `}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-sm font-medium text-slate-900 dark:text-white">{order.total}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Nenhum pedido encontrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>

        {/* Quick Actions / Tips */}
        <div className="space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.5 }}
            className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Produtos Mais Vendidos</h3>
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-slate-100 dark:bg-[#262626] flex items-center justify-center text-sm font-bold text-slate-500 dark:text-slate-400">
                      {index + 1}º
                    </div>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{product.name}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{product.vendas} un.</span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.6 }}
            className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 flex flex-col"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-500/20 rounded-lg flex items-center justify-center">
                  <QrCode className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Acesso ao Cardápio</h3>
              </div>
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
                Compartilhe seu link ou baixe o QR Code.
              </p>

              <div className="flex items-center gap-2 mb-4 p-2 bg-slate-50 dark:bg-[#09090b] rounded-lg border border-slate-200 dark:border-[#262626]">
                <LinkIcon className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
                <a 
                  href={`/loja/${storeSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 truncate flex-1 underline"
                  title="Acessar sua loja pública"
                >
                  menufacil.com/{storeSlug}
                </a>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/loja/${storeSlug}`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-orange-600 hover:text-orange-700 dark:text-orange-500 dark:hover:text-orange-400 p-1 rounded-md"
                  title="Copiar link"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {qrDataUrl && (
                <div className="flex justify-center mb-4">
                  <img
                    src={qrDataUrl}
                    alt="QR Code do cardapio"
                    className="w-44 h-44 rounded-xl border-2 border-orange-200 dark:border-orange-500/20 object-contain bg-white"
                  />
                </div>
              )}
            </div>
            <button 
              disabled={qrGenerating}
              className="w-full bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] disabled:opacity-50 disabled:cursor-not-allowed text-slate-900 dark:text-white py-2 rounded-lg font-semibold transition-colors text-sm flex items-center justify-center gap-2"
              onClick={downloadQRCode}
            >
              <Download className="w-4 h-4" /> {qrGenerating ? 'Gerando...' : 'Baixar QR Code'}
            </button>
          </motion.div>
        </div>
      </div>

      <OrderModal 
        isOpen={isOrderModalOpen} 
        onClose={() => setIsOrderModalOpen(false)} 
        order={selectedOrder}
        onUpdateStatus={(newStatus) => {
          if (!selectedOrder) return;
          const target = recentOrders.find(o => o.id === selectedOrder.id);
          if (target) {
            updateOrderStatus(target.rawId, newStatus);
            setSelectedOrder({ ...selectedOrder, status: newStatus });
          }
        }}
      />
    </div>
  );
}
