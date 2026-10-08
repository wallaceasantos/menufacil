import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import type { ApiUser } from '../types';
import type { PlanType } from '../data/plans';

const loginSchema = z.object({
  email: z.string().min(1, 'O e-mail é obrigatório').email('E-mail inválido'),
  password: z.string().min(1, 'A senha é obrigatória'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginResponse {
  user: ApiUser;
  token: string;
}

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  if (!isOpen) return null;

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const user = response.user;

      login(response.token, {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan as PlanType,
        paymentStatus: user.paymentStatus,
        overdueDays: user.overdueDays,
        tenantId: user.tenantId,
      });

      toast.success('Login realizado com sucesso!');
      reset();
      onClose();

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao realizar login';
      toast.error(message);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#262626]">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Fazer Login</h2>
          <button onClick={handleClose} className="text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-5">
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">E-mail</label>
            <input 
              type="email" 
              {...register('email')}
              placeholder="seu@email.com"
              className={`w-full bg-slate-100 dark:bg-[#121214] border ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-[#262626] focus:border-orange-500 focus:ring-orange-500'} rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 transition-all`}
              autoFocus
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
          </div>
          
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Senha</label>
            <input 
              type="password" 
              {...register('password')}
              placeholder="••••••••"
              className={`w-full bg-slate-100 dark:bg-[#121214] border ${errors.password ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-slate-200 dark:border-[#262626] focus:border-orange-500 focus:ring-orange-500'} rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 transition-all`}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
          </div>

          <div className="pt-2 flex gap-3">
            <button 
              type="button" 
              onClick={handleClose}
              className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-[#262626] dark:hover:bg-[#3f3f46] text-slate-900 dark:text-white text-sm py-2.5 rounded-lg font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:hover:bg-orange-600 text-white text-sm py-2.5 rounded-lg font-semibold transition-colors shadow-lg shadow-orange-900/20"
            >
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
