import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isValidCpf, maskCpf } from '../lib/cpf';
import { maskCep, maskPhone } from '../lib/masks';

// ─── Schema ────────────────────────────────────────────────────────────

export const billingSchema = z.object({
  firstName: z
    .string()
    .min(2, 'Nome deve ter pelo menos 2 caracteres.')
    .max(60, 'Nome muito longo.'),
  lastName: z
    .string()
    .min(2, 'Sobrenome deve ter pelo menos 2 caracteres.')
    .max(60, 'Sobrenome muito longo.'),
  cpf: z
    .string()
    .min(11, 'CPF deve ter 11 dígitos.')
    .refine(
      (value) => isValidCpf(value),
      'CPF inválido.',
    ),
  email: z
    .string()
    .email('Insira um e-mail válido.')
    .max(120, 'E-mail muito longo.'),
  postalCode: z
    .string()
    .regex(/^\d{5}-?\d{3}$/, 'CEP inválido (formato: 00000-000).')
    .optional()
    .or(z.literal('')),
  addressNumber: z
    .string()
    .max(10, 'Número muito longo.')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, 'Telefone inválido.')
    .optional()
    .or(z.literal('')),
});

export type BillingData = z.infer<typeof billingSchema>;

// ─── Props ─────────────────────────────────────────────────────────────

export interface BillingFormProps {
  /** Valores iniciais (ex: preencher nome/email do usuário logado). */
  defaultValues?: Partial<BillingData>;
  /** Callback disparado com os dados validados. */
  onSubmit: (data: BillingData) => void;
  /** Callback para voltar ao passo anterior. */
  onBack?: () => void;
  /** Se true, desabilita campos e botão (ex: enquanto chama a API). */
  isProcessing?: boolean;
  /** Rótulo do botão de envio. */
  submitLabel?: string;
}

// ─── Component ─────────────────────────────────────────────────────────

export function BillingForm({
  defaultValues,
  onSubmit,
  onBack,
  isProcessing = false,
  submitLabel = 'Continuar para pagamento',
}: BillingFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<BillingData>({
    resolver: zodResolver(billingSchema),
    defaultValues: {
      firstName: defaultValues?.firstName ?? '',
      lastName: defaultValues?.lastName ?? '',
      cpf: defaultValues?.cpf ?? '',
      email: defaultValues?.email ?? '',
      postalCode: defaultValues?.postalCode ?? '',
      addressNumber: defaultValues?.addressNumber ?? '',
      phone: defaultValues?.phone ?? '',
    },
  });

  // ── Máscaras ──────────────────────────────────────────────────

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCpf(e.target.value);
    setValue('cpf', masked, { shouldValidate: true });
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskCep(e.target.value);
    setValue('postalCode', masked, { shouldValidate: true });
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskPhone(e.target.value);
    setValue('phone', masked, { shouldValidate: true });
  };

  // ── Helpers de classe Tailwind ─────────────────────────────────

  const inputClass =
    'w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl px-4 py-2.5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-orange-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

  const labelClass =
    'block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1';

  const errorClass = 'text-red-400 text-xs mt-1';

  // ── Render ────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-left">
      {/* Nome + Sobrenome */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Nome *</label>
          <input
            {...register('firstName')}
            className={inputClass}
            placeholder="João"
            disabled={isProcessing}
            autoComplete="given-name"
          />
          {errors.firstName && (
            <p className={errorClass}>{errors.firstName.message}</p>
          )}
        </div>

        <div>
          <label className={labelClass}>Sobrenome *</label>
          <input
            {...register('lastName')}
            className={inputClass}
            placeholder="Silva Santos"
            disabled={isProcessing}
            autoComplete="family-name"
          />
          {errors.lastName && (
            <p className={errorClass}>{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* CPF */}
      <div>
        <label className={labelClass}>CPF *</label>
        <input
          {...register('cpf')}
          className={inputClass}
          placeholder="000.000.000-00"
          disabled={isProcessing}
          autoComplete="off"
          inputMode="numeric"
          onChange={handleCpfChange}
        />
        {errors.cpf && <p className={errorClass}>{errors.cpf.message}</p>}
      </div>

      {/* Email */}
      <div>
        <label className={labelClass}>E-mail *</label>
        <input
          {...register('email')}
          type="email"
          className={inputClass}
          placeholder="seu@email.com"
          disabled={isProcessing}
          autoComplete="email"
        />
        {errors.email && <p className={errorClass}>{errors.email.message}</p>}
      </div>

      {/* Campos opcionais (collapsible) */}
      <details className="group">
        <summary className="text-sm font-medium text-slate-500 dark:text-slate-400 cursor-pointer hover:text-orange-500 transition-colors select-none">
          Endereço de cobrança (opcional)
        </summary>

        <div className="mt-4 space-y-4 border-l-2 border-slate-200 dark:border-[#262626] ml-1 pl-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>CEP</label>
              <input
                {...register('postalCode')}
                className={inputClass}
                placeholder="00000-000"
                disabled={isProcessing}
                autoComplete="postal-code"
                inputMode="numeric"
                onChange={handleCepChange}
              />
              {errors.postalCode && (
                <p className={errorClass}>{errors.postalCode.message}</p>
              )}
            </div>

            <div>
              <label className={labelClass}>Número</label>
              <input
                {...register('addressNumber')}
                className={inputClass}
                placeholder="123"
                disabled={isProcessing}
                autoComplete="address-line2"
              />
              {errors.addressNumber && (
                <p className={errorClass}>{errors.addressNumber.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Telefone</label>
            <input
              {...register('phone')}
              className={inputClass}
              placeholder="(11) 99999-9999"
              disabled={isProcessing}
              autoComplete="tel-national"
              inputMode="tel"
              onChange={handlePhoneChange}
            />
            {errors.phone && (
              <p className={errorClass}>{errors.phone.message}</p>
            )}
          </div>
        </div>
      </details>

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            disabled={isProcessing}
            className="px-6 py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-xl font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Voltar
          </button>
        )}

        <button
          type="submit"
          disabled={isProcessing}
          className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-70 text-white py-3 rounded-xl font-bold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <svg
                className="animate-spin w-5 h-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Processando...
            </>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
