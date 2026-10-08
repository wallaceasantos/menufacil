import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
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
  const [view, setView] = useState<'login' | 'forgot' | 'twofa'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  const [twoFALoading, setTwoFALoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  if (!isOpen) return null;

  const finishLogin = (response: LoginResponse) => {
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
    } else if ((user as any).onboardingCompletedAt == null) {
      navigate('/onboarding');
    } else {
      navigate('/dashboard');
    }
  };

  const onSubmit = async (data: LoginFormData) => {
    try {
      const response = await api<LoginResponse & { requires2FA?: boolean; tempToken?: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (response.requires2FA && response.tempToken) {
        setTempToken(response.tempToken);
        setTwoFACode('');
        setView('twofa');
        return;
      }

      finishLogin(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao realizar login';
      toast.error(message);
    }
  };

  const handleTwoFASubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFACode.trim()) {
      toast.error('Informe o código de verificação');
      return;
    }
    setTwoFALoading(true);
    try {
      const response = await api<LoginResponse>('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ tempToken, code: twoFACode.trim() }),
      });
      finishLogin(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Código inválido';
      toast.error(message);
    } finally {
      setTwoFALoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setView('login');
    setForgotEmail('');
    setForgotSent(false);
    setTempToken('');
    setTwoFACode('');
    onClose();
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error('Informe seu e-mail');
      return;
    }
    setForgotLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: forgotEmail.trim() }),
      });
      setForgotSent(true);
      toast.success('Se o e-mail estiver cadastrado, as instruções foram enviadas.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao solicitar recuperação';
      toast.error(message);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#262626]">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{view === 'login' ? 'Fazer Login' : view === 'twofa' ? 'Verificação em Duas Etapas' : 'Recuperar Senha'}</h2>
          <button onClick={handleClose} className="text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {view === 'twofa' ? (
          <form onSubmit={handleTwoFASubmit} className="p-5 space-y-5">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Informe o código de 6 dígitos gerado pelo seu aplicativo autenticador.
            </p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Código de verificação</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={twoFACode}
                onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                className="w-full bg-white dark:bg-[#27272A] border border-slate-200 dark:border-[#262626] rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 text-center text-xl tracking-[0.5em] font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={twoFALoading || twoFACode.length !== 6}
              className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors text-sm disabled:opacity-50"
            >
              {twoFALoading ? 'Verificando...' : 'Verificar e entrar'}
            </button>
            <button
              type="button"
              onClick={() => { setView('login'); setTempToken(''); setTwoFACode(''); }}
              className="w-full py-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm transition-colors"
            >
              Voltar ao login
            </button>
          </form>
        ) : view === 'forgot' ? (
          <form onSubmit={handleForgotSubmit} className="p-5 space-y-5">
            {forgotSent ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Se o e-mail estiver cadastrado, você receberá as instruções de recuperação em instantes.
                  O link é válido por 1 hora.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Não recebeu? Verifique a caixa de spam ou tente novamente em alguns minutos.
                </p>
                <button
                  type="button"
                  onClick={() => { setView('login'); setForgotSent(false); }}
                  className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors text-sm"
                >
                  Voltar ao login
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha.
                </p>
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">E-mail</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] focus:border-orange-500 focus:ring-orange-500 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 transition-all"
                    autoFocus
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setView('login')}
                    className="flex-1 py-2.5 bg-slate-200 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-[#3f3f46] transition-colors text-sm"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-semibold transition-colors text-sm disabled:opacity-50"
                  >
                    {forgotLoading ? 'Enviando...' : 'Enviar link'}
                  </button>
                </div>
              </>
            )}
          </form>
        ) : (
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
            <div className="text-right">
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium"
              >
                Esqueci minha senha
              </button>
            </div>
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
        )}
      </div>
    </div>
  );
}
