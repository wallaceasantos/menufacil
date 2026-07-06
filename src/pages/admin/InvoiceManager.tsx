import { useState, useEffect, useMemo } from 'react';
import { FileText, Plus, Download, Search, X, Upload, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../lib/api';
import { formatPlanPrice } from '../../data/plans';

interface Invoice {
  id: string;
  tenantId: string;
  tenantName?: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  description?: string;
  documentUrl?: string;
  paidAt?: string | null;
  createdAt?: string;
}

interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: string;
}

export function InvoiceManager() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    tenantId: '',
    amount: '',
    dueDate: '',
    paymentMethod: 'boleto',
    description: '',
    status: 'pending' as Invoice['status'],
  });

  useEffect(() => {
    loadInvoices();
    loadTenants();
  }, []);

  const loadInvoices = async () => {
    try {
      const data = await api('/invoices') as Invoice[];
      setInvoices(data);
    } catch {
      toast.error('Erro ao carregar faturas');
    }
  };

  const loadTenants = async () => {
    try {
      const data = await api('/admin/tenants') as Tenant[];
      setTenants(data);
    } catch {
      toast.error('Erro ao carregar lojas');
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) =>
      inv.tenantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [invoices, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenantId || !form.amount || !form.dueDate) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    try {
      const body = {
        tenantId: form.tenantId,
        amount: Number(form.amount),
        dueDate: form.dueDate,
        paymentMethod: form.paymentMethod,
        description: form.description,
        status: form.status,
      };

      if (editingInvoice) {
        await api(`/invoices/${editingInvoice.id}`, {
          method: 'PUT',
          body: JSON.stringify(body),
        });
        toast.success('Fatura atualizada!');
      } else {
        await api('/invoices', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        toast.success('Fatura criada!');
      }

      closeModal();
      loadInvoices();
    } catch {
      toast.error('Erro ao salvar fatura');
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, invoice: Invoice) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(invoice.id);
    try {
      const formData = new FormData();
      formData.append('document', file);

      const token = sessionStorage.getItem('jwt_token');
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/invoices/${invoice.id}/document`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || 'Erro ao enviar documento');

      toast.success('Boleto anexado!');
      loadInvoices();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar documento';
      toast.error(message);
    } finally {
      setUploadingId(null);
      e.target.value = '';
    }
  };

  const openModal = (invoice?: Invoice) => {
    if (invoice) {
      setEditingInvoice(invoice);
      setForm({
        tenantId: invoice.tenantId,
        amount: invoice.amount.toFixed(2),
        dueDate: invoice.dueDate,
        paymentMethod: invoice.paymentMethod || 'boleto',
        description: invoice.description || '',
        status: invoice.status,
      });
    } else {
      setEditingInvoice(null);
      setForm({
        tenantId: '',
        amount: '',
        dueDate: '',
        paymentMethod: 'boleto',
        description: '',
        status: 'pending',
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingInvoice(null);
    setForm({
      tenantId: '',
      amount: '',
      dueDate: '',
      paymentMethod: 'boleto',
      description: '',
      status: 'pending',
    });
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
      paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
      overdue: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-300',
      cancelled: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
    };
    const labels: Record<string, string> = {
      pending: 'Pendente',
      paid: 'Pago',
      overdue: 'Vencido',
      cancelled: 'Cancelado',
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {status === 'paid' ? <CheckCircle2 className="w-3.5 h-3.5" /> : status === 'overdue' ? <AlertCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Faturas</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie boletos, PIX e faturas mensais dos lojistas.</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-900/20 shrink-0"
        >
          <Plus className="w-5 h-5" />
          Nova Fatura
        </button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por loja, status ou descrição..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-[#18181b] border-b border-slate-200 dark:border-[#262626]">
              <tr>
                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Loja</th>
                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Vencimento</th>
                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Valor</th>
                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Status</th>
                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Método</th>
                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400">Boleto</th>
                <th className="px-6 py-4 font-medium text-slate-500 dark:text-slate-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-[#262626]">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                    Nenhuma fatura encontrada.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-[#18181b]/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-white">{invoice.tenantName || '—'}</p>
                        <p className="text-xs text-slate-500">#{invoice.id.slice(0, 8).toUpperCase()}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      R$ {invoice.amount.toFixed(2).replace('.', ',')}
                    </td>
                    <td className="px-6 py-4">{statusBadge(invoice.status)}</td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300 capitalize">{invoice.paymentMethod || '—'}</td>
                    <td className="px-6 py-4">
                      {invoice.documentUrl ? (
                        <a
                          href={`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/invoices/${invoice.id}/download?token=${encodeURIComponent(sessionStorage.getItem('jwt_token') || '')}`}
                          className="inline-flex items-center gap-1.5 text-orange-600 dark:text-orange-400 hover:underline text-sm"
                        >
                          <Download className="w-4 h-4" /> Baixar boleto
                        </a>
                      ) : (
                        <span className="text-slate-400 text-sm">Não anexado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <label className={`cursor-pointer p-2 text-slate-400 hover:text-orange-600 dark:hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors ${uploadingId === invoice.id ? 'opacity-50' : ''}`}>
                          {uploadingId === invoice.id ? (
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <input type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => handleDocumentUpload(e, invoice)} disabled={uploadingId === invoice.id} />
                        </label>
                        <button
                          onClick={() => openModal(invoice)}
                          className="p-2 text-slate-400 hover:text-orange-600 dark:hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-500/10 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <FileText className="w-4 h-4" />
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

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#262626]">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingInvoice ? 'Editar Fatura' : 'Nova Fatura'}
              </h3>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Loja</label>
                <select
                  value={form.tenantId}
                  onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
                  disabled={!!editingInvoice}
                  className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 disabled:opacity-50"
                >
                  <option value="">Selecione uma loja</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Valor</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Vencimento</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Método de Pagamento</label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="boleto">Boleto</option>
                  <option value="pix">PIX</option>
                  <option value="cartao">Cartão</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as Invoice['status'] })}
                  className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                  <option value="overdue">Vencido</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Ex: Mensalidade Julho/2026"
                  className="w-full h-24 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium"
                >
                  {editingInvoice ? 'Salvar' : 'Criar Fatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
