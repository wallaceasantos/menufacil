import { useState, useEffect, useMemo } from 'react';
import { 
  Users, Store, ShoppingBag, TrendingUp, Settings, LogOut, 
  Search, Plus, MoreVertical, Edit, Trash2, CheckCircle2, XCircle, DollarSign, AlertCircle, Bell, Headset, Send, MessageSquare, X, Paperclip, FileText, Clock, ArrowUpRight, ArrowDownRight, RefreshCw, Loader2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { PLANS, formatPlanPrice, type PlanType } from '../../data/plans';
import { api, uploadTicketAttachment, type UploadedAttachment } from '../../lib/api';
import { InvoiceManager } from './InvoiceManager';

interface Tenant {
  id: string;
  name: string;
  type: string;
  plan: PlanType;
  status: 'active' | 'inactive';
  paymentStatus: 'paid' | 'overdue';
  overdueDays?: number;
  email: string;
  createdAt: string;
}

interface TicketAttachment {
  id: string;
  filename: string;
  url: string;
  mimeType?: string;
  size?: number;
}

interface TicketMessage {
  id: string;
  sender: 'user' | 'admin';
  text: string;
  createdAt: string;
  attachments?: TicketAttachment[];
}

interface Ticket {
  id: string;
  userId: string;
  userName: string;
  subject: string;
  description: string;
  status: 'open' | 'closed';
  createdAt: string;
  messages: TicketMessage[];
}

interface PlanHistoryEntry {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantEmail: string;
  oldPlan: string;
  newPlan: string;
  changedBy: string;
  source: string;
  createdAt: string;
}

export function AdminDashboard() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isNewTenantModalOpen, setIsNewTenantModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'financeiro' | 'faturas' | 'lojas' | 'avisos' | 'chamados' | 'historico'>('financeiro');
  
  const [announcement, setAnnouncement] = useState('');

  // Ticket states
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  useEffect(() => {
    loadTenants();
    loadAnnouncement();
    loadTickets();
    loadPlanHistory();
  }, []);

  const loadTenants = async () => {
    try {
      const data = await api('/admin/tenants') as Tenant[];
      setTenants(data);
    } catch {
      toast.error('Erro ao carregar lojas');
    }
  };

  const loadAnnouncement = async () => {
    try {
      const data = await api('/admin/announcement') as { message: string };
      setAnnouncement(data.message || '');
    } catch {
      setAnnouncement('');
    }
  };

  const loadTickets = async () => {
    try {
      const data = await api('/admin/tickets') as Ticket[];
      setTickets(data);
    } catch {
      toast.error('Erro ao carregar chamados');
    }
  };

  const [planHistory, setPlanHistory] = useState<PlanHistoryEntry[]>([]);

  const loadPlanHistory = async () => {
    try {
      const data = await api('/admin/plan-history') as PlanHistoryEntry[];
      setPlanHistory(data);
    } catch {}
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTicket) return;

    setUploadingAttachment(true);
    try {
      const uploaded = await uploadTicketAttachment(file, selectedTicket.id);
      setPendingAttachments((prev) => [...prev, uploaded]);
      toast.success('Anexo adicionado!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar anexo';
      toast.error(message);
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const removePendingAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleReplyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    try {
      const message = await api(`/support/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: replyMessage, attachments: pendingAttachments }),
      }) as TicketMessage;

      const updated = { ...selectedTicket, messages: [...selectedTicket.messages, message] };
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
      setReplyMessage('');
      setPendingAttachments([]);
      toast.success('Resposta enviada!');
    } catch {
      toast.error('Erro ao enviar resposta');
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;

    try {
      await api(`/support/tickets/${selectedTicket.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'closed' }),
      });
      const updated = { ...selectedTicket, status: 'closed' as const };
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
      toast.success('Chamado fechado!');
    } catch {
      toast.error('Erro ao fechar chamado');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleTenantStatus = async (id: string) => {
    try {
      await api(`/admin/tenants/${id}/status`, { method: 'PATCH' });
      await loadTenants();
      toast.success('Status atualizado com sucesso!');
    } catch {
      toast.error('Erro ao atualizar status');
    }
  };

  const notifyOverdue = (id: string) => {
    toast.success('Notificação de cobrança enviada com sucesso!');
  };

  const deleteTenant = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return;
    try {
      await api(`/admin/tenants/${id}`, { method: 'DELETE' });
      await loadTenants();
      toast.success('Loja excluída com sucesso!');
    } catch {
      toast.error('Erro ao excluir loja');
    }
  };

  const saveAnnouncement = async () => {
    try {
      await api('/admin/announcement', {
        method: 'POST',
        body: JSON.stringify({ message: announcement }),
      });
      toast.success('Aviso global atualizado e transmitido para as lojas!');
    } catch {
      toast.error('Erro ao salvar aviso');
    }
  };

  const clearAnnouncement = async () => {
    try {
      await api('/admin/announcement', { method: 'DELETE' });
      setAnnouncement('');
      toast.success('Aviso global removido!');
    } catch {
      toast.error('Erro ao remover aviso');
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    t.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeCount = tenants.filter(t => t.status === 'active').length;
  const completeCount = tenants.filter(t => t.plan === 'completo').length;
  const defaulters = tenants.filter(t => t.paymentStatus === 'overdue');
  
  const mrr = completeCount * PLANS.completo.price; // Monthly Recurring Revenue
  const defaultAmount = defaulters.length * PLANS.completo.price;

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
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#121214] border-r border-slate-200 dark:border-[#262626] transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="MenuFácil"
                className="h-8 w-auto object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none'
                  const fb = document.querySelector('.admin-logo-fallback')
                  if (fb) (fb as HTMLElement).style.display = 'block'
                }} />
              <h1 className="text-2xl font-bold text-orange-600 dark:text-orange-500 admin-logo-fallback"><span className="text-slate-900 dark:text-white text-sm ml-1 font-normal uppercase tracking-wider">Admin</span></h1>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-500 hover:text-slate-900 dark:hover:text-white">
              <XCircle className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
            <button 
              onClick={() => { setActiveTab('financeiro'); setIsSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'financeiro' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#262626]'}`}
            >
              <DollarSign className="w-5 h-5" />
              Financeiro
            </button>
            <button 
              onClick={() => { setActiveTab('faturas'); setIsSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'faturas' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#262626]'}`}
            >
              <FileText className="w-5 h-5" />
              Faturas
            </button>
            <button 
              onClick={() => { setActiveTab('lojas'); setIsSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'lojas' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#262626]'}`}
            >
              <Store className="w-5 h-5" />
              Lojas / Clientes
            </button>
            <button 
              onClick={() => { setActiveTab('avisos'); setIsSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'avisos' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#262626]'}`}
            >
              <Bell className="w-5 h-5" />
              Avisos & Manutenção
            </button>
            <button 
              onClick={() => { setActiveTab('chamados'); setIsSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'chamados' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#262626]'}`}
            >
              <Headset className="w-5 h-5" />
              Chamados de Suporte
            </button>
            <button 
              onClick={() => { setActiveTab('historico'); setIsSidebarOpen(false); }}
              className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'historico' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#262626]'}`}
            >
              <RefreshCw className="w-5 h-5" />
              Histórico de Planos
            </button>
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-[#262626]">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#262626] flex items-center justify-center font-bold text-slate-700 dark:text-slate-300">
                {user?.name?.charAt(0) || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name || 'Administrador'}</p>
                <p className="text-xs text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl w-full text-left font-medium transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Sair do Painel
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-[#121214] border-b border-slate-200 dark:border-[#262626] px-6 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#262626] rounded-lg"
            >
              <span className="sr-only">Abrir menu</span>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {activeTab === 'financeiro'
                ? 'Resumo Financeiro'
                : activeTab === 'faturas'
                ? 'Faturas'
                : activeTab === 'lojas'
                ? 'Gestão de Lojas'
                : activeTab === 'avisos'
                ? 'Avisos & Manutenção'
                : activeTab === 'chamados'
                ? 'Chamados de Suporte'
                : 'Histórico de Planos'}
            </h2>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#262626] rounded-xl transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {activeTab === 'financeiro' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">MRR (Receita Mensal Recorrente)</h3>
                      <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                        <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">R$ {mrr.toFixed(2).replace('.', ',')}</p>
                    <p className="text-sm text-slate-500 mt-2">{completeCount} lojas no plano completo ({formatPlanPrice(PLANS.completo)})</p>
                  </div>
                  
                  <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Inadimplência</h3>
                      <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-500" />
                      </div>
                    </div>
                    <p className="text-3xl font-bold text-slate-900 dark:text-white">R$ {defaultAmount.toFixed(2).replace('.', ',')}</p>
                    <p className="text-sm text-slate-500 mt-2">{defaulters.length} lojas com atraso de pagamento</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Lojas Inadimplentes</h3>
                  {defaulters.length === 0 ? (
                    <p className="text-slate-500 dark:text-slate-400">Nenhuma loja com pagamento em atraso.</p>
                  ) : (
                    <div className="space-y-4">
                      {defaulters.map(d => (
                        <div key={d.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#18181b] rounded-xl border border-slate-200 dark:border-[#262626]">
                          <div>
                            <h4 className="font-semibold text-slate-900 dark:text-white">{d.name}</h4>
                            <p className="text-sm text-slate-500">{d.email} • Atraso de {d.overdueDays} dias</p>
                          </div>
                          <button 
                            onClick={() => notifyOverdue(d.id)}
                            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-500/20 dark:hover:bg-red-500/30 dark:text-red-400 rounded-lg text-sm font-medium transition-colors"
                          >
                            Enviar Notificação
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'faturas' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <InvoiceManager />
              </motion.div>
            )}

            {activeTab === 'lojas' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                {/* Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Total de Lojas</h3>
                  <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                    <Store className="w-5 h-5 text-blue-600 dark:text-blue-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{tenants.length}</p>
              </div>
              
              <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Lojas Ativas</h3>
                  <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{activeCount}</p>
              </div>

              <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Planos Completos</h3>
                  <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{completeCount}</p>
              </div>

              <div className="bg-white dark:bg-[#121214] p-6 rounded-2xl border border-slate-200 dark:border-[#262626]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400">Planos Básicos</h3>
                  <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#262626] flex items-center justify-center">
                    <Users className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900 dark:text-white">{tenants.length - completeCount}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Buscar loja por nome, email ou tipo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <button 
                onClick={() => setIsNewTenantModalOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-900/20"
              >
                <Plus className="w-5 h-5" />
                Nova Loja
              </button>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#262626] text-sm text-slate-500 dark:text-slate-400">
                      <th className="px-6 py-4 font-medium">Nome / Email</th>
                      <th className="px-6 py-4 font-medium">Tipo</th>
                      <th className="px-6 py-4 font-medium">Plano</th>
                      <th className="px-6 py-4 font-medium">Status / Pagamento</th>
                      <th className="px-6 py-4 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-[#262626]">
                    {filteredTenants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                          Nenhuma loja encontrada.
                        </td>
                      </tr>
                    ) : (
                      filteredTenants.map((tenant) => (
                        <tr key={tenant.id} className="hover:bg-slate-50 dark:hover:bg-[#18181b]/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-900 dark:text-white">{tenant.name}</span>
                              <span className="text-sm text-slate-500">{tenant.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{tenant.type}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                              ${tenant.plan === 'completo' 
                                ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20' 
                                : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                              }`}
                            >
                              {PLANS[tenant.plan].name}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2 items-start">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border
                                ${tenant.status === 'active' 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
                                  : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                }`}
                              >
                                {tenant.status === 'active' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                {tenant.status === 'active' ? 'Ativo' : 'Inativo'}
                              </span>
                              
                              {tenant.plan === 'completo' && (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border
                                  ${tenant.paymentStatus === 'paid' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' 
                                    : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
                                  }`}
                                >
                                  {tenant.paymentStatus === 'paid' ? 'Mensalidade em dia' : 'Em atraso'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => toggleTenantStatus(tenant.id)}
                                className="p-2 text-slate-400 hover:text-orange-600 dark:hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
                                title={tenant.status === 'active' ? 'Desativar loja' : 'Ativar loja'}
                              >
                                {tenant.status === 'active' ? <XCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                              </button>
                              <button 
                                onClick={() => deleteTenant(tenant.id)}
                                className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Excluir loja"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
                </div>

              </motion.div>
            )}

            {activeTab === 'avisos' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-orange-600 dark:text-orange-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Aviso Global / Manutenção</h3>
                      <p className="text-sm text-slate-500">Esta mensagem será exibida no painel de todos os lojistas ativos.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <textarea 
                      value={announcement}
                      onChange={e => setAnnouncement(e.target.value)}
                      placeholder="Ex: Teremos uma manutenção programada nesta sexta-feira às 02:00. O sistema poderá ficar instável."
                      className="w-full h-32 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#262626] rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
                    />
                    
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        onClick={clearAnnouncement}
                        className="px-4 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#262626] rounded-xl font-medium transition-colors"
                      >
                        Remover Aviso
                      </button>
                      <button 
                        onClick={saveAnnouncement}
                        className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium shadow-lg shadow-orange-900/20 transition-colors"
                      >
                        Publicar Aviso
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'chamados' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden flex min-h-[600px] h-[600px]">
                  {/* Ticket List */}
                  <div className={`w-full md:w-1/3 border-r border-slate-200 dark:border-[#262626] flex flex-col ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
                    <div className="p-4 border-b border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#18181b]">
                      <h3 className="font-bold text-slate-900 dark:text-white">Chamados de Suporte</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {tickets.length === 0 ? (
                        <p className="text-center text-slate-500 text-sm mt-8">Nenhum chamado recebido.</p>
                      ) : (
                        tickets.map(ticket => (
                          <button
                            key={ticket.id}
                            onClick={() => setSelectedTicket(ticket)}
                            className={`w-full text-left p-4 rounded-xl border transition-colors ${
                              selectedTicket?.id === ticket.id 
                                ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10' 
                                : 'border-slate-200 dark:border-[#262626] hover:border-orange-300'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                ticket.status === 'open' 
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' 
                                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                              }`}>
                                {ticket.status === 'open' ? 'Aberto' : 'Fechado'}
                              </span>
                              <span className="text-xs text-slate-500">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>
                            <h4 className="font-semibold text-slate-900 dark:text-white line-clamp-1 mb-1">{ticket.subject}</h4>
                            <p className="text-xs text-slate-500 mb-2">De: {ticket.userName}</p>
                            <p className="text-sm text-slate-500 line-clamp-2">{ticket.description}</p>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Ticket Details/Chat */}
                  <div className={`w-full md:w-2/3 flex flex-col bg-slate-50/50 dark:bg-[#09090b] ${!selectedTicket ? 'hidden md:flex' : 'flex'}`}>
                    {selectedTicket ? (
                      <>
                        <div className="p-4 border-b border-slate-200 dark:border-[#262626] bg-white dark:bg-[#121214] flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <button onClick={() => setSelectedTicket(null)} className="md:hidden p-2 -ml-2 text-slate-500">
                              <X className="w-5 h-5" />
                            </button>
                            <div>
                              <h3 className="font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                              <p className="text-xs text-slate-500">Ticket #{selectedTicket.id} • {selectedTicket.userName}</p>
                            </div>
                          </div>
                          {selectedTicket.status === 'open' && (
                            <button 
                              onClick={handleCloseTicket}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-[#262626] dark:hover:bg-[#3f3f46] text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
                            >
                              Fechar Chamado
                            </button>
                          )}
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                          {/* Original Description */}
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                              <span className="font-bold text-sm text-slate-600 dark:text-slate-400">{selectedTicket.userName.charAt(0)}</span>
                            </div>
                            <div className="bg-white dark:bg-[#18181b] p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-[#262626] shadow-sm max-w-[85%]">
                              <p className="text-sm font-medium mb-1 text-slate-900 dark:text-white">{selectedTicket.userName} (Cliente)</p>
                              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">{selectedTicket.description}</p>
                              <p className="text-xs text-slate-400 mt-2">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                            </div>
                          </div>

                          {/* Messages */}
                          {selectedTicket.messages.map(msg => (
                            <div key={msg.id} className={`flex gap-4 ${msg.sender === 'admin' ? 'flex-row' : 'flex-row-reverse'}`}>
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                                msg.sender === 'admin' ? 'bg-orange-100 dark:bg-orange-500/20' : 'bg-slate-200 dark:bg-slate-800'
                              }`}>
                                <span className={`font-bold text-sm ${msg.sender === 'admin' ? 'text-orange-600 dark:text-orange-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                  {msg.sender === 'admin' ? 'A' : selectedTicket.userName.charAt(0)}
                                </span>
                              </div>
                              <div className={`p-4 rounded-2xl border border-slate-200 dark:border-[#262626] shadow-sm max-w-[85%] ${
                                msg.sender === 'admin' 
                                  ? 'bg-orange-50 text-orange-900 dark:bg-orange-500/10 dark:text-orange-100 border-orange-200 dark:border-orange-500/20 rounded-tl-none' 
                                  : 'bg-white dark:bg-[#18181b] rounded-tr-none'
                              }`}>
                                <p className={`text-sm font-medium mb-1 ${msg.sender === 'admin' ? 'text-orange-900 dark:text-orange-200' : 'text-slate-900 dark:text-white'}`}>
                                  {msg.sender === 'admin' ? 'Você (Admin)' : selectedTicket.userName}
                                </p>
                                <p className={`whitespace-pre-wrap text-sm leading-relaxed ${msg.sender === 'admin' ? 'text-orange-800 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                  {msg.text}
                                </p>
                                {msg.attachments && msg.attachments.length > 0 && (
                                  <div className="mt-3 space-y-2">
                                    {msg.attachments.map((att) => (
                                      <a
                                        key={att.id}
                                        href={att.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-400 hover:underline"
                                      >
                                        <Paperclip className="w-4 h-4" />
                                        {att.filename}
                                      </a>
                                    ))}
                                  </div>
                                )}
                                <p className={`text-xs mt-2 ${msg.sender === 'admin' ? 'text-orange-600 dark:text-orange-500' : 'text-slate-400'}`}>
                                  {new Date(msg.createdAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>

                        {selectedTicket.status === 'open' && (
                          <div className="p-4 border-t border-slate-200 dark:border-[#262626] bg-white dark:bg-[#121214]">
                            {pendingAttachments.length > 0 && (
                              <div className="mb-3 flex flex-wrap gap-2">
                                {pendingAttachments.map((att, index) => (
                                  <div key={index} className="flex items-center gap-2 bg-slate-100 dark:bg-[#262626] px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                                    <Paperclip className="w-4 h-4" />
                                    <span className="max-w-[150px] truncate">{att.filename}</span>
                                    <button
                                      type="button"
                                      onClick={() => removePendingAttachment(index)}
                                      className="text-slate-400 hover:text-red-500"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <form onSubmit={handleReplyTicket} className="flex gap-2">
                              <input 
                                type="text" 
                                value={replyMessage}
                                onChange={e => setReplyMessage(e.target.value)}
                                placeholder="Digite sua resposta..."
                                className="flex-1 bg-slate-50 dark:bg-[#18181b] border border-slate-200 dark:border-[#262626] rounded-xl px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                              />
                              <label className={`cursor-pointer p-2.5 bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-300 rounded-xl transition-colors ${uploadingAttachment ? 'opacity-50' : 'hover:bg-slate-200 dark:hover:bg-[#3f3f46]'}`}>
                                {uploadingAttachment ? (
                                  <span className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin inline-block" />
                                ) : (
                                  <Paperclip className="w-5 h-5" />
                                )}
                                <input type="file" className="hidden" onChange={handleAttachmentUpload} disabled={uploadingAttachment} />
                              </label>
                              <button 
                                type="submit"
                                disabled={!replyMessage.trim()}
                                className="p-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl transition-colors disabled:opacity-50"
                              >
                                <Send className="w-5 h-5" />
                              </button>
                            </form>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                        <MessageSquare className="w-12 h-12 mb-4 text-slate-300 dark:text-slate-700" />
                        <p>Selecione um chamado ao lado para visualizar e responder.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'historico' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Histórico de Migração de Planos</h3>
                      <p className="text-sm text-slate-500">Registro de todas as mudanças de plano dos lojistas</p>
                    </div>
                    <button 
                      onClick={loadPlanHistory}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-[#3f3f46] transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Atualizar
                    </button>
                  </div>

                  {planHistory.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma mudança de plano registrada ainda.</p>
                      <p className="text-sm mt-1">Os registros aparecerão aqui quando lojistas fizerem upgrade ou downgrade.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#262626] text-sm text-slate-500 dark:text-slate-400">
                            <th className="px-4 py-3 font-medium">Data</th>
                            <th className="px-4 py-3 font-medium">Loja</th>
                            <th className="px-4 py-3 font-medium">Mudança</th>
                            <th className="px-4 py-3 font-medium">Origem</th>
                            <th className="px-4 py-3 font-medium">Detalhes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-[#262626]">
                          {planHistory.map((entry) => (
                            <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-[#18181b]/50 transition-colors">
                              <td className="px-4 py-4 whitespace-nowrap">
                                <p className="font-medium text-slate-900 dark:text-white text-sm">
                                  {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {new Date(entry.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </td>
                              <td className="px-4 py-4">
                                <p className="font-medium text-slate-900 dark:text-white text-sm">{entry.tenantName}</p>
                                <p className="text-xs text-slate-500">{entry.tenantEmail}</p>
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    entry.oldPlan === 'basico' && entry.newPlan === 'completo'
                                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                      : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'
                                  }`}>
                                    {entry.oldPlan === 'basico' && entry.newPlan === 'completo' ? (
                                      <ArrowUpRight className="w-3 h-3 mr-1" />
                                    ) : (
                                      <ArrowDownRight className="w-3 h-3 mr-1" />
                                    )}
                                    {entry.oldPlan.toUpperCase()}
                                  </span>
                                  <span className="text-slate-400 text-xs">→</span>
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    entry.newPlan === 'completo'
                                      ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                  }`}>
                                    {entry.newPlan.toUpperCase()}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  entry.source === 'webhook' ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' :
                                  entry.source === 'upgrade' ? 'bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400' :
                                  entry.source === 'local' ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400' :
                                  'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {entry.source === 'webhook' ? 'Webhook' :
                                   entry.source === 'upgrade' ? 'Checkout' :
                                   entry.source === 'local' ? 'Local/Teste' :
                                   entry.source === 'downgrade' ? 'Downgrade' : entry.source}
                                </span>
                              </td>
                              <td className="px-4 py-4">
                                <span className="text-xs text-slate-500">
                                  via {entry.changedBy}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

          </div>
        </div>
      </main>
      
      {/* New Tenant Modal */}
      <NewTenantModal 
        isOpen={isNewTenantModalOpen} 
        onClose={() => setIsNewTenantModalOpen(false)} 
        onSave={(newTenant) => setTenants([newTenant, ...tenants])}
      />
    </div>
  );
}

function NewTenantModal({ isOpen, onClose, onSave }: { isOpen: boolean, onClose: () => void, onSave: (tenant: Tenant) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [type, setType] = useState('Hamburgueria');
  const [plan, setPlan] = useState<PlanType>('basico');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newTenant = await api('/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, email, type, plan }),
      }) as Tenant;
      onSave(newTenant);
      toast.success('Loja criada com sucesso!');
      onClose();
      setName('');
      setEmail('');
      setType('Hamburgueria');
      setPlan('basico');
    } catch {
      toast.error('Erro ao criar loja');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#262626]">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Criar Nova Loja</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full">
            <XCircle className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Estabelecimento</label>
            <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail do Proprietário</label>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo de Negócio</label>
            <select value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white">
              <option>Hamburgueria</option>
              <option>Pizzaria</option>
              <option>Cafeteria</option>
              <option>Restaurante</option>
              <option>Açaíteria</option>
              <option>Sushi Bar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Plano Inicial</label>
            <select value={plan} onChange={e => setPlan(e.target.value as PlanType)} className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white">
              <option value="basico">{PLANS.basico.name}</option>
              <option value="completo">{PLANS.completo.name}</option>
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-lg">Cancelar</button>
            <button type="submit" className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium">Criar Loja</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
