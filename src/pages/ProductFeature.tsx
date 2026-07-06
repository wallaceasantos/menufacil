import { motion } from 'motion/react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, Smartphone, MessageCircle, BarChart3, AppWindow } from 'lucide-react';
import { useEffect } from 'react';

interface ProductFeatureProps {
  type: 'cardapio' | 'whatsapp' | 'painel' | 'whitelabel';
}

const featuresData = {
  cardapio: {
    title: 'Cardápio Digital',
    subtitle: 'Seus produtos na palma da mão do cliente.',
    description: 'Um link exclusivo com a cara do seu negócio. Cadastre seus produtos, adicione fotos, organize por categorias e deixe o cliente pedir de forma fácil e rápida.',
    icon: <Smartphone className="w-12 h-12 text-orange-500" />,
    benefits: [
      'Link personalizado (ex: menufacil.com/sua-loja)',
      'Fotos e descrições ilimitadas',
      'Categorias organizadas',
      'QR Code para colocar nas mesas ou panfletos'
    ]
  },
  whatsapp: {
    title: 'Pedidos via WhatsApp',
    subtitle: 'Chega de anotar pedidos errados.',
    description: 'O cliente monta o pedido no cardápio digital e você recebe tudo organizado direto no seu WhatsApp, já com as opções de entrega, taxa calculada e forma de pagamento.',
    icon: <MessageCircle className="w-12 h-12 text-orange-500" />,
    benefits: [
      'Pedido formatado em texto',
      'Cálculo automático do total e taxas',
      'Opcionais e observações do cliente',
      'Pronto para enviar para a cozinha'
    ]
  },
  painel: {
    title: 'Painel de Gestão',
    subtitle: 'O controle do seu negócio em um só lugar.',
    description: 'Acompanhe suas vendas, mude o status dos pedidos, veja relatórios de faturamento e saiba quais são os produtos mais vendidos.',
    icon: <BarChart3 className="w-12 h-12 text-orange-500" />,
    benefits: [
      'Dashboard com métricas diárias',
      'Gestão de status (Novo, Preparando, Saiu para Entrega)',
      'Relatório de produtos mais vendidos',
      'Controle de estoque simples'
    ]
  },
  whitelabel: {
    title: 'App White-Label',
    subtitle: 'Seu próprio aplicativo.',
    description: 'Tenha um aplicativo com a sua logomarca, suas cores e sua identidade. Uma experiência premium para fidelizar seus clientes sem as taxas dos marketplaces.',
    icon: <AppWindow className="w-12 h-12 text-orange-500" />,
    benefits: [
      'Logomarca e cores personalizadas',
      'Domínio próprio (ex: app.sualoja.com.br)',
      'Sem marcas do MenuFácil',
      'Fidelização direta do seu cliente'
    ]
  }
};

export default function ProductFeature({ type }: ProductFeatureProps) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [type]);

  const feature = featuresData[type];

  if (!feature) {
    return <Navigate to="/" />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0B] text-slate-700 dark:text-slate-200 font-sans">
      <nav className="fixed top-0 w-full z-40 bg-white/80 dark:bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-slate-200 dark:border-[#262626]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center">
          <Link to="/" className="flex items-center gap-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors">
            <ChevronLeft className="w-5 h-5" />
            <span className="font-medium">Voltar para o Início</span>
          </Link>
        </div>
      </nav>

      <main className="pt-32 pb-24">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-24 h-24 bg-orange-500/10 border border-orange-500/20 rounded-3xl flex items-center justify-center mb-8">
              {feature.icon}
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6">
              {feature.title}
            </h1>
            
            <p className="text-xl md:text-2xl text-orange-500 font-medium mb-8">
              {feature.subtitle}
            </p>
          </motion.div>
            
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <p className="text-lg text-slate-400 dark:text-slate-500 leading-relaxed mb-12 max-w-3xl">
              {feature.description}
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-8 md:p-12"
          >
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-8">Principais Benefícios</h2>
            <ul className="grid md:grid-cols-2 gap-6">
              {feature.benefits.map((benefit, index) => (
                <motion.li 
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.3 + index * 0.1 }}
                  className="flex items-start gap-4"
                >
                  <CheckCircle2 className="w-6 h-6 text-orange-500 shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-slate-300 text-lg">{benefit}</span>
                </motion.li>
              ))}
            </ul>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-16 flex flex-col sm:flex-row items-center gap-4"
          >
            <Link 
              to="/#planos"
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-500 text-white text-lg px-8 py-4 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(234,88,12,0.4)] text-center"
            >
              Ver Planos Disponíveis
            </Link>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
