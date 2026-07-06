import { useState, useEffect } from 'react';
import { FileText, Download, AlertCircle, CheckCircle2, Clock, FileDown, MessageCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getTenantSlug } from '../../data/tenantStorage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface Invoice {
  id: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paymentMethod?: string;
  description?: string;
  documentUrl?: string;
  paidAt?: string | null;
}

export function Invoices() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const slug = getTenantSlug(user);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  useEffect(() => {
    loadInvoices();
  }, [slug]);

  const loadInvoices = async () => {
    if (!slug) return;
    try {
      setLoading(true);
      const token = sessionStorage.getItem('jwt_token');
      const res = await fetch(`${API_URL}/invoices`, {
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': slug,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('Erro ao carregar faturas');
      const data = await res.json();
      setInvoices(data);
    } catch {
      toast.error('Erro ao carregar faturas');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestCopy = async (invoice: Invoice) => {
    if (!slug) return;
    setRequestingId(invoice.id);
    try {
      const token = sessionStorage.getItem('jwt_token');
      await fetch(`${API_URL}/invoices/${invoice.id}/request-copy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-slug': slug,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      toast.success('Solicitação de 2ª via enviada ao suporte!');
      navigate('/dashboard/support');
    } catch {
      toast.error('Erro ao solicitar 2ª via');
    } finally {
      setRequestingId(null);
    }
  };

  const statusInfo = (status: string) => {
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
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-4 h-4" />,
      paid: <CheckCircle2 className="w-4 h-4" />,
      overdue: <AlertCircle className="w-4 h-4" />,
      cancelled: <FileText className="w-4 h-4" />,
    };
    return {
      className: styles[status] || styles.pending,
      label: labels[status] || status,
      icon: icons[status] || icons.pending,
    };
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Minhas Faturas</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Acompanhe seus boletos, solicite 2ª via e verifique o status de pagamento.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-8 text-center text-slate-500">
          <FileText className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-700" />
          <p>Nenhuma fatura encontrada.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => {
            const status = statusInfo(invoice.status);
            return (
              <div
                key={invoice.id}
                className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                      {status.icon}
                      {status.label}
                    </span>
                    <span className="text-xs text-slate-500">#{invoice.id.slice(0, 8).toUpperCase()}</span>
                  </div>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {invoice.description || `Mensalidade - ${new Date(invoice.dueDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    R$ {invoice.amount.toFixed(2).replace('.', ',')}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Vencimento: {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {invoice.documentUrl ? (
                    <a
                      href={`${API_URL}/invoices/${invoice.id}/download?token=${encodeURIComponent(sessionStorage.getItem('jwt_token') || '')}`}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                      <FileDown className="w-4 h-4" />
                      Baixar boleto
                    </a>
                  ) : (
                    <button
                      onClick={() => handleRequestCopy(invoice)}
                      disabled={requestingId === invoice.id}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-[#262626] hover:bg-slate-200 dark:hover:bg-[#3f3f46] text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                    >
                      {requestingId === invoice.id ? (
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <MessageCircle className="w-4 h-4" />
                      )}
                      Solicitar 2ª via
                    </button>
                  )}

                  {invoice.status === 'pending' && (
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      Aguardando pagamento
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
