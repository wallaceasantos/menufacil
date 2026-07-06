import { X, MapPin, Phone, User, Package, Clock, Printer, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LockedFeatureModal } from './LockedFeatureModal';

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
  onUpdateStatus?: (status: string) => void;
}

export function OrderModal({ isOpen, onClose, order, onUpdateStatus }: OrderModalProps) {
  const { user } = useAuth();
  const [isLockedModalOpen, setIsLockedModalOpen] = useState(false);
  const canPrint = user?.plan === 'completo';

  if (!isOpen || !order) return null;

  const getNextStatus = () => {
    if (order.status === 'Pendente') return 'Preparando';
    if (order.status === 'Preparando') return 'Concluído';
    return null;
  };

  const nextStatus = getNextStatus();

  return (
    <AnimatePresence>
      <div key="order-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm print:bg-white print:p-0 print:absolute print:inset-0">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:h-auto print:border-none print:shadow-none print:dark:bg-white print:text-black print:rounded-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#121214] print:hidden">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Detalhes do Pedido</h2>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                ${order.status === 'Concluído' ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/20' : 
                  order.status === 'Preparando' ? 'bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/20' : 
                  order.status === 'Pendente' ? 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20' : 
                  'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'}
              `}>
                {order.status}
              </span>
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors rounded-lg hover:bg-slate-200 dark:hover:bg-[#262626] p-1.5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Print Header (Only visible when printing) */}
          <div className="hidden print:block text-center border-b border-black pb-4 mb-4">
            <h1 className="text-2xl font-bold font-mono">CUPOM DE PEDIDO</h1>
            <p className="text-sm font-mono mt-1">Pedido: {order.id}</p>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-6 print:p-0 print:overflow-visible">
            {/* Order ID & Time */}
            <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 print:text-black print:font-mono">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 print:hidden" />
                <span className="font-semibold text-slate-900 dark:text-white print:text-black">Pedido {order.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 print:hidden" />
                <span>Hoje, {order.time || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>

            <hr className="border-slate-200 dark:border-[#262626] print:border-black print:border-dashed" />

            {/* Customer Info */}
            <div className="space-y-4 print:font-mono print:text-black">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider print:text-black">Cliente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 print:grid-cols-1 print:gap-2">
                <div className="flex items-start gap-3">
                  <div className="bg-slate-100 dark:bg-[#262626] p-2 rounded-lg text-slate-500 dark:text-slate-400 print:hidden">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 print:hidden">Nome</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white print:text-black print:text-base">{order.customer}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="bg-slate-100 dark:bg-[#262626] p-2 rounded-lg text-slate-500 dark:text-slate-400 print:hidden">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 print:hidden">Contato</p>
                    <p className="text-sm font-medium text-slate-900 dark:text-white print:text-black print:text-base">{order.phone || order.contact || '(11) 98765-4321'}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-slate-100 dark:bg-[#262626] p-2 rounded-lg text-slate-500 dark:text-slate-400 mt-1 print:hidden">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 print:hidden">Endereço de Entrega</p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white leading-relaxed whitespace-pre-line print:text-black print:text-base">
                    {order.address || 'Retirada no Local'}
                  </p>
                </div>
              </div>
            </div>

            <hr className="border-slate-200 dark:border-[#262626] print:border-black print:border-dashed" />

            {/* Items */}
            <div className="space-y-4 print:font-mono print:text-black">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider print:text-black">Itens do Pedido</h3>
              <div className="bg-slate-50 dark:bg-[#121214] rounded-xl p-4 border border-slate-200 dark:border-[#262626] print:p-0 print:border-none print:bg-transparent">
                <ul className="space-y-3">
                  {(Array.isArray(order.items)
                    ? order.items
                    : (typeof order.items === 'string' ? order.items.split(', ') : [])
                  ).map((item: any, index: number) => {
                    const textItem = typeof item === 'string' ? item : (item.product?.name || item.name || item.productName || '');
                    const qty = typeof item === 'string' ? (item.match(/^(\d+)x/) ? item.match(/^(\d+)x/)![1] + 'x' : '1x') : (item.quantity ? item.quantity + 'x' : '1x');
                    const name = typeof item === 'string' ? item.replace(/^\d+x /, '') : (item.product?.name || item.name || item.productName || 'Item');
                    return (
                      <li key={index} className="flex items-start gap-3 text-sm print:text-base">
                        <span className="font-semibold text-orange-600 dark:text-orange-500 min-w-[24px] print:text-black">{qty}</span>
                        <span className="text-slate-700 dark:text-slate-300 flex-1 print:text-black">{name}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>

            <hr className="border-slate-200 dark:border-[#262626] print:border-black print:border-dashed" />
            
            {/* Total */}
            <div className="flex justify-between items-center text-lg print:font-mono print:text-black print:font-bold print:text-xl">
              <span className="font-semibold text-slate-900 dark:text-white print:text-black">Total</span>
              <span className="font-bold text-orange-600 dark:text-orange-500 print:text-black">{order.total}</span>
            </div>
            
            {/* Print Footer */}
            <div className="hidden print:block text-center mt-12 font-mono text-sm">
              <p>Obrigado pela preferência!</p>
              <p>menufacil.com/loja</p>
            </div>
          </div>
          
          {/* Footer actions */}
          <div className="p-5 border-t border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#121214] flex flex-col sm:flex-row gap-3 justify-between items-center print:hidden">
            <button 
              className={`px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
                canPrint
                  ? 'bg-slate-200 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-[#3f3f46] rounded-lg'
                  : 'bg-slate-100 dark:bg-[#262626]/50 text-slate-400 cursor-not-allowed rounded-lg border border-dashed border-slate-300 dark:border-[#3f3f46]'
              }`}
              onClick={() => canPrint ? window.print() : setIsLockedModalOpen(true)}
            >
              {canPrint ? <Printer className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {canPrint ? 'Imprimir Cupom' : 'Impressão no Plano Completo'}
            </button>
            <div className="flex gap-3 w-full sm:w-auto justify-end items-center">
              {onUpdateStatus && order.status !== 'Cancelado' && (
                <button
                  onClick={() => onUpdateStatus('Cancelado')}
                  className="text-sm font-medium text-red-600 hover:text-red-700 dark:text-red-500 dark:hover:text-red-400 mr-2"
                >
                  Cancelar Pedido
                </button>
              )}
              <button 
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-[#3f3f46] rounded-lg text-sm font-semibold transition-colors"
              >
                Fechar
              </button>
              {onUpdateStatus && nextStatus && (
                <button 
                  onClick={() => onUpdateStatus(nextStatus)}
                  className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-semibold shadow-lg shadow-orange-900/20 transition-all"
                >
                  {nextStatus === 'Preparando' ? 'Iniciar Preparo' : 'Concluir Pedido'}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
      <LockedFeatureModal
        isOpen={isLockedModalOpen}
        onClose={() => setIsLockedModalOpen(false)}
        featureId="coupon-printing"
      />
    </AnimatePresence>
  );
}

