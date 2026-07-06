import { X, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { PLANS, formatPlanPrice, type PlanType } from '../data/plans';
import { BillingForm, type BillingData } from './BillingForm';

const formSchema = z.object({
  tenantName: z.string().min(2, 'O nome do estabelecimento é obrigatório'),
  slug: z.string()
    .min(1, 'O endereço do cardápio é obrigatório')
    .regex(/^[a-z0-9-]+$/, 'Apenas letras minúsculas, números e hifens'),
  userName: z.string().min(2, 'O nome do responsável é obrigatório'),
  email: z.string().min(1, 'O e-mail é obrigatório').email('E-mail inválido'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

export interface NewTenantData {
  tenantName: string;
  slug: string;
  plan: PlanType;
  userName: string;
  email: string;
  password: string;
  /** Dados de cobrança para o Mercado Pago (coletados no passo 2). */
  billing?: BillingData;
}

interface NewTenantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewTenantData) => void;
  isSubmitting?: boolean;
}

export function NewTenantModal({ isOpen, onClose, onSubmit, isSubmitting = false }: NewTenantModalProps) {
  const [step, setStep] = useState<'account' | 'billing'>('account');
  const [tenantName, setTenantName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState<PlanType>('basico');
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleTenantNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTenantName(val);
    setSlug(val.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, ''));
    if (errors.tenantName || errors.slug) {
      const newErrors = { ...errors };
      delete newErrors.tenantName;
      delete newErrors.slug;
      setErrors(newErrors);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const result = formSchema.safeParse({ tenantName, slug, userName, email, password });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      const formatted = result.error.format();
      for (const [key, val] of Object.entries(formatted)) {
        if (key !== '_errors' && val && typeof val === 'object' && '_errors' in val && Array.isArray(val._errors)) {
          fieldErrors[key] = val._errors[0] as string;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    // Avança para o passo 2: dados de cobrança
    setStep('billing');
  };

  const handleClose = () => {
    setStep('account');
    setTenantName('');
    setSlug('');
    setPlan('basico');
    setUserName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setErrors({});
    onClose();
  };

  const handleBillingSubmit = (billingData: BillingData) => {
    onSubmit({
      tenantName,
      slug,
      plan,
      userName,
      email,
      password,
      billing: billingData,
    });
  };

  const handleBillingBack = () => {
    setStep('account');
  };

  const fieldClass = (field: string) =>
    `w-full bg-slate-100 dark:bg-[#121214] border ${errors[field] ? 'border-red-500' : 'border-slate-200 dark:border-[#262626]'} rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 transition-all`;

  const headerTitle = step === 'account' ? 'Criar Conta' : 'Dados de Cobrança';

  // Pré-popula nome/email do passo 1 no BillingForm
  const [billingFirstName, ...billingLastName] = userName.split(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 my-8">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-[#262626]">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{headerTitle}</h2>
            <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-[#262626] px-2 py-0.5 rounded-full">
              {step === 'account' ? '1/2' : '2/2'}
            </span>
          </div>
          <button onClick={handleClose} disabled={isSubmitting} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'account' ? (
          <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Seção: Dados do Estabelecimento */}
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Dados do Estabelecimento</p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nome do Estabelecimento</label>
              <input type="text" value={tenantName} onChange={handleTenantNameChange} placeholder="Ex: Sabor Caseiro" className={fieldClass('tenantName')} autoFocus disabled={isSubmitting} />
              {errors.tenantName && <p className="text-xs text-red-500">{errors.tenantName}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Endereço do Cardápio</label>
              <input type="text" value={slug} onChange={(e) => { setSlug(e.target.value); if (errors.slug) setErrors({ ...errors, slug: '' }); }} placeholder="Ex: sabor-caseiro" className={`${fieldClass('slug')} font-mono`} disabled={isSubmitting} />
              <p className="text-[11px] text-slate-400">menufacil.com/loja/<strong>{slug || 'seu-endereco'}</strong></p>
              {errors.slug && <p className="text-xs text-red-500">{errors.slug}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Plano</label>
              <select value={plan} onChange={(e) => setPlan(e.target.value as PlanType)} className={`${fieldClass('plan')} appearance-none`} disabled={isSubmitting}>
                <option value="basico">{PLANS.basico.name} — {formatPlanPrice(PLANS.basico)}</option>
                <option value="completo">{PLANS.completo.name} — {formatPlanPrice(PLANS.completo)}</option>
              </select>
            </div>

            <hr className="border-slate-200 dark:border-[#262626]" />

            {/* Seção: Dados de Acesso */}
            <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider">Seus Dados de Acesso</p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Nome do Responsável</label>
              <input type="text" value={userName} onChange={(e) => { setUserName(e.target.value); if (errors.userName) setErrors({ ...errors, userName: '' }); }} placeholder="Seu nome completo" className={fieldClass('userName')} disabled={isSubmitting} />
              {errors.userName && <p className="text-xs text-red-500">{errors.userName}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">E-mail</label>
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors({ ...errors, email: '' }); }} placeholder="seu@email.com" className={fieldClass('email')} disabled={isSubmitting} />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Senha</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: '' }); }} placeholder="Mínimo 6 caracteres" className={fieldClass('password')} disabled={isSubmitting} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600" tabIndex={-1}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
            </div>

            <div className="pt-2 flex gap-3">
              <button type="button" onClick={handleClose} disabled={isSubmitting} className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-[#262626] dark:hover:bg-[#3f3f46] disabled:opacity-50 text-slate-900 dark:text-white text-sm py-2.5 rounded-lg font-semibold transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={isSubmitting || !tenantName || !slug || !userName || !email || !password} className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-sm py-2.5 rounded-lg font-semibold transition-colors shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2">
                Continuar
              </button>
            </div>
          </form>
        ) : (
          <div className="p-5 max-h-[70vh] overflow-y-auto">
            <BillingForm
              defaultValues={{
                firstName: billingFirstName ?? '',
                lastName: billingLastName.join(' ') ?? '',
                email: email,
              }}
              onSubmit={handleBillingSubmit}
              onBack={handleBillingBack}
              isProcessing={isSubmitting}
              submitLabel="Criar Conta"
            />
          </div>
        )}
      </div>
    </div>
  );
}
