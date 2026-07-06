import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';

const contactFormSchema = z.object({
  name: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.'),
  email: z.string().email('Insira um e-mail válido.'),
  phone: z.string().min(10, 'Insira um telefone válido.'),
  inquiryType: z.enum(['sales', 'support'], { message: 'Selecione o tipo de contato.' }),
  message: z.string().min(10, 'A mensagem deve ter pelo menos 10 caracteres.'),
});

type ContactFormData = z.infer<typeof contactFormSchema>;

export function ContactForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactFormSchema),
  });

  const onSubmit = (data: ContactFormData) => {
    console.log('Form data:', data);
    toast.success('Mensagem enviada com sucesso! Nossa equipe retornará em breve.');
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-left">
      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nome completo</label>
        <input
          {...register('name')}
          className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
          placeholder="Seu nome"
        />
        {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name.message}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">E-mail</label>
          <input
            {...register('email')}
            type="email"
            className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
            placeholder="seu@email.com"
          />
          {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Telefone / WhatsApp</label>
          <input
            {...register('phone')}
            className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
            placeholder="(00) 00000-0000"
          />
          {errors.phone && <p className="text-red-400 text-xs mt-1">{errors.phone.message}</p>}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Assunto</label>
        <select
          {...register('inquiryType')}
          className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
        >
          <option value="">Selecione o assunto</option>
          <option value="sales">Vendas / Dúvidas sobre Planos</option>
          <option value="support">Suporte Técnico</option>
        </select>
        {errors.inquiryType && <p className="text-red-400 text-xs mt-1">{errors.inquiryType.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Mensagem</label>
        <textarea
          {...register('message')}
          rows={4}
          className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg px-4 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors resize-none"
          placeholder="Como podemos te ajudar?"
        />
        {errors.message && <p className="text-red-400 text-xs mt-1">{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        className="w-full bg-orange-600 hover:bg-orange-500 text-slate-900 dark:text-white font-bold py-3 rounded-lg transition-colors"
      >
        Enviar Mensagem
      </button>
    </form>
  );
}
