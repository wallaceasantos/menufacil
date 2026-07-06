import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, MessageSquare, Clock, CheckCircle2, ChevronRight, X, Send, Paperclip } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'react-hot-toast';
import { apiWithTenant, uploadTicketAttachment, type UploadedAttachment } from '../../lib/api';
import { getTenantSlug } from '../../data/tenantStorage';

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

export function Support() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [pendingAttachments, setPendingAttachments] = useState<UploadedAttachment[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const slug = getTenantSlug(user);

  useEffect(() => {
    loadTickets();
  }, [user]);

  const loadTickets = async () => {
    if (!user || !slug) return;
    try {
      const data = await apiWithTenant('/support/tickets', slug) as Ticket[];
      setTickets(data);
    } catch {
      toast.error('Erro ao carregar chamados');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !slug) return;

    try {
      const newTicket = await apiWithTenant('/support/tickets', slug, {
        method: 'POST',
        body: JSON.stringify({ subject, description }),
      }) as Ticket;

      setTickets((prev) => [newTicket, ...prev]);
      setIsNewTicketOpen(false);
      setSubject('');
      setDescription('');
      toast.success('Chamado aberto com sucesso!');
    } catch {
      toast.error('Erro ao abrir chamado');
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTicket || !slug) return;

    setUploadingAttachment(true);
    try {
      const uploaded = await uploadTicketAttachment(file, selectedTicket.id, slug);
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !newMessage.trim() || !slug) return;

    try {
      const message = await apiWithTenant(`/support/tickets/${selectedTicket.id}/messages`, slug, {
        method: 'POST',
        body: JSON.stringify({ text: newMessage, attachments: pendingAttachments }),
      }) as TicketMessage;

      const updated = { ...selectedTicket, messages: [...selectedTicket.messages, message] };
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.id === selectedTicket.id ? updated : t)));
      setNewMessage('');
      setPendingAttachments([]);
    } catch {
      toast.error('Erro ao enviar mensagem');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Suporte Técnico</h1>
          <p className="text-slate-500 dark:text-slate-400">Abra chamados para dúvidas, correções ou financeiro.</p>
        </div>
        <button 
          onClick={() => setIsNewTicketOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-orange-900/20 shrink-0"
        >
          <Plus className="w-5 h-5" />
          Novo Chamado
        </button>
      </div>

      <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden flex min-h-[500px]">
        {/* Ticket List */}
        <div className={`w-full md:w-1/3 border-r border-slate-200 dark:border-[#262626] flex flex-col ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#18181b]">
            <h3 className="font-bold text-slate-900 dark:text-white">Meus Chamados</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tickets.length === 0 ? (
              <p className="text-center text-slate-500 text-sm mt-8">Nenhum chamado aberto.</p>
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
              <div className="p-4 border-b border-slate-200 dark:border-[#262626] bg-white dark:bg-[#121214] flex items-center gap-3">
                <button onClick={() => setSelectedTicket(null)} className="md:hidden p-2 -ml-2 text-slate-500">
                  <X className="w-5 h-5" />
                </button>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                  <p className="text-xs text-slate-500">Ticket #{selectedTicket.id}</p>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                  selectedTicket.status === 'open' 
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300' 
                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {selectedTicket.status === 'open' ? 'Em andamento' : 'Resolvido'}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Original Description */}
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
                    <span className="font-bold text-sm text-orange-600 dark:text-orange-500">{user?.name?.charAt(0)}</span>
                  </div>
                  <div className="bg-white dark:bg-[#18181b] p-4 rounded-2xl rounded-tl-none border border-slate-200 dark:border-[#262626] shadow-sm max-w-[85%]">
                    <p className="text-sm font-medium mb-1 text-slate-900 dark:text-white">Você</p>
                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">{selectedTicket.description}</p>
                    <p className="text-xs text-slate-400 mt-2">{new Date(selectedTicket.createdAt).toLocaleString()}</p>
                  </div>
                </div>

                {/* Messages */}
                {selectedTicket.messages.map(msg => (
                  <div key={msg.id} className={`flex gap-4 ${msg.sender === 'user' ? 'flex-row' : 'flex-row-reverse'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      msg.sender === 'user' ? 'bg-orange-100 dark:bg-orange-500/20' : 'bg-slate-800 dark:bg-slate-100'
                    }`}>
                      <span className={`font-bold text-sm ${msg.sender === 'user' ? 'text-orange-600 dark:text-orange-500' : 'text-white dark:text-slate-900'}`}>
                        {msg.sender === 'user' ? user?.name?.charAt(0) : 'A'}
                      </span>
                    </div>
                    <div className={`p-4 rounded-2xl border border-slate-200 dark:border-[#262626] shadow-sm max-w-[85%] ${
                      msg.sender === 'user' 
                        ? 'bg-white dark:bg-[#18181b] rounded-tl-none' 
                        : 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 rounded-tr-none'
                    }`}>
                      <p className={`text-sm font-medium mb-1 ${msg.sender === 'user' ? 'text-slate-900 dark:text-white' : 'text-slate-200 dark:text-slate-800'}`}>
                        {msg.sender === 'user' ? 'Você' : 'Suporte Admin'}
                      </p>
                      <p className={`whitespace-pre-wrap text-sm leading-relaxed ${msg.sender === 'user' ? 'text-slate-700 dark:text-slate-300' : 'text-slate-100 dark:text-slate-700'}`}>
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
                              className={`flex items-center gap-2 text-sm hover:underline ${
                                msg.sender === 'user' ? 'text-orange-600 dark:text-orange-400' : 'text-orange-300 dark:text-orange-600'
                              }`}
                            >
                              <Paperclip className="w-4 h-4" />
                              {att.filename}
                            </a>
                          ))}
                        </div>
                      )}
                      <p className={`text-xs mt-2 ${msg.sender === 'user' ? 'text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
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
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Digite sua mensagem..."
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
                      disabled={!newMessage.trim()}
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
              <p>Selecione um chamado ao lado ou abra um novo para conversar com o suporte.</p>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {isNewTicketOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#262626]">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Abrir Chamado</h2>
              <button onClick={() => setIsNewTicketOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTicket} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Assunto</label>
                <select 
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="" disabled>Selecione um assunto</option>
                  <option value="Dúvida Geral">Dúvida Geral</option>
                  <option value="Erro no Sistema">Erro no Sistema</option>
                  <option value="Financeiro / 2ª Via">Financeiro / 2ª Via</option>
                  <option value="Sugestão de Melhoria">Sugestão de Melhoria</option>
                  <option value="Outros">Outros</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                <textarea 
                  required
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descreva detalhadamente sua solicitação..."
                  className="w-full h-32 bg-slate-50 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsNewTicketOpen(false)} className="px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-lg">Cancelar</button>
                <button type="submit" className="px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium">Enviar Chamado</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
