import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useSpring, AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { NewTenantModal, type NewTenantData } from "../components/NewTenantModal";
import { LoginModal } from "../components/LoginModal";
import { InfoModal } from "../components/InfoModal";
import { ContactForm } from "../components/ContactForm";
import { useTheme } from "../contexts/ThemeContext";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";
import { PLANS, PLAN_FEATURES, formatPlanPrice, type PlanType } from "../data/plans";
import {
  ChefHat,
  Coffee,
  Store,
  Smartphone,
  QrCode,
  TrendingUp,
  CheckCircle2,
  ArrowRight,
  Utensils,
  Star,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";

const defaultTestimonials = [
  {
    id: '1', name: 'Carlos Silva', business: 'Carlos Burguer',
    avatar: 'C', photo: null, text: 'O MenuFácil transformou meu delivery. Antes eu me perdia no WhatsApp, hoje sai tudo na impressora e o motoboy já sai voando.',
    stats: null,
  },
  {
    id: '2', name: 'Ana Souza', business: 'Doceria da Ana',
    avatar: 'A', photo: null, text: 'Eu gastava horas respondendo clientes sobre preços. Com o cardápio digital, eles já veem tudo, pedem e até pagam por Pix.',
    stats: null,
  },
  {
    id: '3', name: 'Roberto', business: 'Pizzaria do Beto',
    avatar: 'R', photo: null, text: 'Sem pagar as taxas absurdas dos outros aplicativos. O lucro agora fica em casa.',
    stats: null,
  },
];

interface Testimonial {
  id: string; name: string; business: string; text: string;
  avatar: string; photo: string | null;
  stats: { orders: number; rating: number | null } | null;
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { user, isAuthenticated, login, logout } = useAuth();
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [infoModalConfig, setInfoModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
  }>({
    isOpen: false,
    title: "",
    content: null,
  });
  const carouselRef = useRef<HTMLDivElement>(null);

  const heroImages = [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=1200&auto=format&fit=crop",
  ];
  const [currentHeroImage, setCurrentHeroImage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentHeroImage((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Redireciona usuário autenticado (tenant) para o dashboard
  useEffect(() => {
    if (isAuthenticated && user?.role === 'tenant') {
      navigate('/dashboard', { replace: true });
    } else if (isAuthenticated && user?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  // Load real testimonials from API
  useEffect(() => {
    api<{ testimonials: Testimonial[] }>('/testimonials')
      .then((data) => {
        if (data.testimonials?.length > 0) {
          setTestimonials(data.testimonials)
        }
      })
      .catch(() => {})
  }, [])

  const openInfoModal = (title: string, content: React.ReactNode) => {
    setInfoModalConfig({ isOpen: true, title, content });
  };

  const closeInfoModal = () => {
    setInfoModalConfig((prev) => ({ ...prev, isOpen: false }));
  };

  const scrollCarousel = (direction: "left" | "right") => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -350 : 350;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

  const handleAddTenant = async (data: NewTenantData) => {
    setIsRegistering(true);
    try {
      const response = await api<{ user: { id: string; name: string; email: string; role: string; plan?: string; paymentStatus?: string; overdueDays?: number; tenantId?: string; tenantSlug?: string }; token: string }>('/auth/register-tenant', {
        method: 'POST',
        body: JSON.stringify({
          name: data.userName,
          email: data.email,
          password: data.password,
          tenantName: data.tenantName,
          slug: data.slug,
          plan: data.plan,
          billing: data.billing,
        }),
      });

      login(response.token, {
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role as 'tenant',
        plan: (response.user.plan || data.plan) as PlanType,
        paymentStatus: response.user.paymentStatus as 'paid' | 'overdue',
        overdueDays: response.user.overdueDays,
        tenantId: response.user.tenantId,
        tenantSlug: response.user.tenantSlug,
      });

      toast.success(`Conta criada! Bem-vindo(a), ${data.userName.split(' ')[0]}!`);
      setIsModalOpen(false);
      navigate('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao criar conta';
      toast.error(message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLoginClick = () => {
    if (isAuthenticated) {
      logout();
      toast.success("Você saiu da sua conta.");
    } else {
      setIsLoginModalOpen(true);
    }
  };

  const sobreNosContent = (
    <>
      <p>
        O MenuFácil nasceu com a missão de simplificar a vida do pequeno
        empreendedor do ramo alimentício. Sabemos que as taxas dos grandes
        aplicativos de delivery esmagam as margens de lucro de quem mais
        precisa.
      </p>
      <p>
        Nossa plataforma foi construída para dar autonomia a lanchonetes,
        restaurantes, confeitarias e food trucks, permitindo que eles tenham sua
        própria vitrine digital, recebam pedidos diretamente no WhatsApp e
        organizem suas vendas, sem pagar comissões por pedido.
      </p>
      <p>
        Acreditamos que a tecnologia deve ser acessível e fácil de usar. Por
        isso, oferecemos uma ferramenta intuitiva, com planos transparentes e
        suporte dedicado, para que você possa focar no que faz de melhor:
        preparar comida deliciosa e atender bem seus clientes.
      </p>
    </>
  );

  const termosDeUsoContent = (
    <>
      <h3 className="font-bold text-slate-900 dark:text-white text-base">
        1. Aceitação dos Termos
      </h3>
      <p>
        Ao acessar e utilizar a plataforma MenuFácil, você concorda em cumprir e
        estar vinculado a estes Termos de Uso. Se você não concordar com
        qualquer parte destes termos, não deverá utilizar nossos serviços.
      </p>

      <h3 className="font-bold text-slate-900 dark:text-white text-base mt-6">
        2. Descrição do Serviço
      </h3>
      <p>
        O MenuFácil oferece uma plataforma de cardápio digital, gestão de
        pedidos via WhatsApp e outras ferramentas para estabelecimentos do ramo
        alimentício. Os recursos disponíveis variam de acordo com o plano
        contratado.
      </p>

      <h3 className="font-bold text-slate-900 dark:text-white text-base mt-6">
        3. Planos e Pagamentos
      </h3>
      <p>
        Os valores e funcionalidades de cada plano estão descritos em nosso
        site. Não cobramos taxas ou comissões por pedido. O pagamento é
        realizado por meio de assinatura mensal recorrente.
      </p>
    </>
  );

  const privacidadeContent = (
    <>
      <h3 className="font-bold text-slate-900 dark:text-white text-base">
        1. Coleta de Informações
      </h3>
      <p>
        Coletamos informações necessárias para a prestação dos nossos serviços,
        como dados de cadastro do estabelecimento (nome, CNPJ, endereço) e
        informações operacionais inseridas na plataforma.
      </p>

      <h3 className="font-bold text-slate-900 dark:text-white text-base mt-6">
        2. Uso das Informações
      </h3>
      <p>
        As informações coletadas são utilizadas exclusivamente para viabilizar o
        funcionamento da plataforma, processar pagamentos da assinatura, prover
        suporte técnico e enviar comunicados importantes sobre o sistema.
      </p>

      <h3 className="font-bold text-slate-900 dark:text-white text-base mt-6">
        3. Compartilhamento de Dados
      </h3>
      <p>
        Não vendemos ou compartilhamos os dados dos seus clientes com terceiros.
        As informações do seu negócio podem ser compartilhadas apenas com
        parceiros de infraestrutura estritamente necessários para a operação do
        sistema (como provedores de hospedagem).
      </p>
    </>
  );

  const centralDeAjudaContent = (
    <div className="space-y-6">
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white text-base">
          Como configuro meu cardápio?
        </h3>
        <p className="mt-1">
          Após criar sua conta, acesse o painel, vá na aba "Cardápio" e comece a
          cadastrar suas categorias (Ex: Lanches, Bebidas) e em seguida adicione
          os produtos com fotos e preços.
        </p>
      </div>
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white text-base">
          Como os pedidos chegam no WhatsApp?
        </h3>
        <p className="mt-1">
          O cliente finaliza o pedido no seu link exclusivo. O sistema formata
          um texto organizado com os itens, valor total, taxa de entrega e
          endereço, e abre diretamente no WhatsApp do seu estabelecimento.
        </p>
      </div>
      <div>
        <h3 className="font-bold text-slate-900 dark:text-white text-base">
          Posso usar meu próprio domínio?
        </h3>
        <p className="mt-1">
          Sim! No plano Completo, você pode configurar um domínio personalizado
          (ex: www.seulanche.com.br) para o seu cardápio digital.
        </p>
      </div>
    </div>
  );

  const faleConoscoContent = (
    <div className="space-y-6">
      <p>
        Precisa de ajuda com sua conta ou quer saber mais sobre nossos planos?
        Nossa equipe está pronta para te atender.
      </p>
      <ContactForm />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-slate-200 dark:border-[#262626]">
        <div className="bg-slate-50 dark:bg-[#18181B] p-4 rounded-xl border border-slate-200 dark:border-[#262626]">
          <div className="text-orange-500 font-bold mb-1">
            WhatsApp de Vendas
          </div>
          <div className="text-slate-900 dark:text-white">(92) 98421-3885</div>
        </div>
        <div className="bg-slate-50 dark:bg-[#18181B] p-4 rounded-xl border border-slate-200 dark:border-[#262626]">
          <div className="text-orange-500 font-bold mb-1">
            E-mail de Suporte
          </div>
          <div className="text-slate-900 dark:text-white">
            contato.menufacil@gmail.com
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0B] text-slate-700 dark:text-slate-200 font-sans selection:bg-orange-500/30 overflow-x-hidden">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 z-50 origin-left"
        style={{ scaleX }}
      />

      {/* Navbar */}
      <nav className="fixed top-0 w-full z-40 bg-white/80 dark:bg-[#0A0A0B]/80 backdrop-blur-xl border-b border-slate-200 dark:border-[#262626]">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo — substitua o arquivo /public/logo.png pela sua marca */}
            <img
              src="/logo.png"
              alt="MenuFácil"
              className="h-20 w-auto object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none'
                const fallback = (e.target as HTMLImageElement).nextElementSibling
                if (fallback) (fallback as HTMLElement).style.display = 'flex'
              }}
            />
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.3)] hidden">
              <Utensils className="w-6 h-6 text-slate-900 dark:text-white" />
            </div>
            
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a
              href="#solucoes"
              className="hover:text-orange-400 transition-colors"
            >
              Soluções
            </a>
            <a
              href="#recursos"
              className="hover:text-orange-400 transition-colors"
            >
              Recursos
            </a>
            <a
              href="#planos"
              className="hover:text-orange-400 transition-colors"
            >
              Planos
            </a>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18181B] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
            {isAuthenticated ? (
              <button
                onClick={handleLoginClick}
                className="hidden sm:block text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Sair ({user?.name?.split(" ")[0]})
              </button>
            ) : (
              <button
                onClick={handleLoginClick}
                className="hidden sm:block text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Login
              </button>
            )}
            <button
              onClick={() => setIsModalOpen(true)}
              className="hidden sm:block bg-orange-600 hover:bg-orange-700 text-white text-sm px-6 py-2.5 rounded-lg font-bold transition-all shadow-[0_0_20px_rgba(234,88,12,0.4)] hover:shadow-[0_0_25px_rgba(234,88,12,0.6)] hover:-translate-y-0.5"
            >
              Novo Estabelecimento
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18181B] transition-colors"
              aria-label="Abrir menu"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-72 max-w-[85vw] bg-white dark:bg-[#121214] border-l border-slate-200 dark:border-[#262626] z-50 md:hidden flex flex-col"
            >
              <div className="p-4 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
                <span className="font-bold text-xl text-slate-900 dark:text-white">
                  Menu<span className="text-orange-500">Fácil</span>
                </span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#18181B] transition-colors"
                  aria-label="Fechar menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                <a
                  href="#solucoes"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-[#262626] transition-colors"
                >
                  Soluções
                </a>
                <a
                  href="#recursos"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-[#262626] transition-colors"
                >
                  Recursos
                </a>
                <a
                  href="#planos"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-4 py-3 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-[#262626] transition-colors"
                >
                  Planos
                </a>
                <div className="border-t border-slate-200 dark:border-[#262626] my-2" />
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleLoginClick();
                  }}
                  className="w-full text-left px-4 py-3 rounded-xl text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-[#262626] transition-colors"
                >
                  {isAuthenticated ? `Sair (${user?.name?.split(" ")[0]})` : "Login"}
                </button>
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsModalOpen(true);
                  }}
                  className="w-full mt-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-3 rounded-xl font-bold transition-colors"
                >
                  Novo Estabelecimento
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 md:pt-48 md:pb-32 px-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-orange-600/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="relative max-w-5xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-bold tracking-widest uppercase mb-4"
          >
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></span>
            A Plataforma Definitiva
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-7xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.1]"
          >
            O sistema ideal para{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">
              pequenos negócios.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-2xl text-slate-400 dark:text-slate-500 dark:text-slate-400 max-w-3xl mx-auto leading-relaxed"
          >
            Feito sob medida para MEIs: lanchonetes, doceiras, food trucks e
            deliveries. Tenha seu cardápio digital, receba pedidos direto no
            WhatsApp e organize suas vendas pagando uma mensalidade que cabe no
            seu bolso.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => setIsModalOpen(true)}
              className="w-full sm:w-auto bg-white text-orange-600 text-base px-8 py-4 rounded-xl font-bold transition-all hover:bg-orange-50 hover:scale-105 flex items-center justify-center gap-2 shadow-xl shadow-white/10"
            >
              Começar Agora <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => openInfoModal("Fale Conosco", faleConoscoContent)}
              className="w-full sm:w-auto bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] hover:bg-slate-200 dark:hover:bg-[#262626] text-slate-900 dark:text-white text-base px-8 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              Falar com Consultor
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="pt-16 grid grid-cols-2 md:grid-cols-4 gap-4 text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm font-medium justify-center items-center"
          >
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Setup em 5 min
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Sem taxas por
              pedido
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Suporte 24/7
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" /> Cancele quando
              quiser
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="pt-16 max-w-4xl mx-auto"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-[#262626] aspect-video max-h-[500px]">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentHeroImage}
                  src={heroImages[currentHeroImage]}
                  alt="Restaurante usando o sistema MenuFácil"
                  className="absolute inset-0 w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 }}
                />
              </AnimatePresence>
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>

              {/* Image Indicators */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {heroImages.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentHeroImage(index)}
                    className={`w-2 h-2 rounded-full transition-all ${index === currentHeroImage ? "bg-orange-500 w-6" : "bg-white/50 hover:bg-white"}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Segmentos Section */}
      <section
        id="solucoes"
        className="py-24 bg-slate-100 dark:bg-[#121214] border-y border-slate-200 dark:border-[#262626]"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Feito para o seu negócio
            </h2>
            <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Adaptamos nossa tecnologia para atender as necessidades
              específicas do seu modelo de atendimento.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="bg-slate-50 dark:bg-[#18181B] rounded-2xl border border-slate-200 dark:border-[#262626] hover:border-orange-500/50 transition-all group overflow-hidden flex flex-col"
            >
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=800&auto=format&fit=crop"
                  alt="Delivery"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Store className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  Deliveries (Em Casa)
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-1">
                  Trabalha da sua cozinha? Organize os pedidos do WhatsApp
                  automaticamente e pare de perder vendas na correria.
                </p>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-500" /> Link na
                    bio do Instagram
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-500" />{" "}
                    Impressão automática de pedidos
                  </li>
                </ul>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="bg-slate-50 dark:bg-[#18181B] rounded-2xl border border-slate-200 dark:border-[#262626] hover:border-orange-500/50 transition-all group overflow-hidden flex flex-col"
            >
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1551024506-0bccd828d307?q=80&w=800&auto=format&fit=crop"
                  alt="Confeitaria"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                    <ChefHat className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  Confeitarias & Docerias
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-1">
                  Venda bolos, doces e encomendas com um catálogo bonito. Aceite
                  pagamentos antecipados e agende entregas.
                </p>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-500" />{" "}
                    Catálogo com fotos profissionais
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-500" /> Gestão
                    de encomendas
                  </li>
                </ul>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="bg-slate-50 dark:bg-[#18181B] rounded-2xl border border-slate-200 dark:border-[#262626] hover:border-orange-500/50 transition-all group overflow-hidden flex flex-col"
            >
              <div className="h-48 w-full relative overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?q=80&w=800&auto=format&fit=crop"
                  alt="Food Truck"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center shadow-lg">
                    <Coffee className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3">
                  Food Trucks & Carrinhos
                </h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-1">
                  Atendimento rápido na rua. Seu cliente aponta a câmera, pede e
                  paga sem precisar de máquina de cartão.
                </p>
                <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-500" /> Pedido
                    via QR Code na mesa/balcão
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-500" />{" "}
                    Fechamento de caixa no celular
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="recursos" className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white leading-tight">
                Tudo o que você precisa em uma única tela.
              </h2>
              <p className="text-lg text-slate-400 dark:text-slate-500 dark:text-slate-400">
                Abandone os sistemas antigos e difíceis de usar. Nossa interface
                foi desenhada para que qualquer membro da sua equipe consiga
                operar em minutos.
              </p>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-12 h-12 shrink-0 bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl flex items-center justify-center">
                    <QrCode className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                      Cardápio via QR Code
                    </h4>
                    <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm">
                      O cliente escaneia, pede e paga diretamente do celular.
                      Reduza filas e aumente o ticket médio.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 shrink-0 bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                      App White-Label
                    </h4>
                    <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm">
                      Tenha seu próprio aplicativo de delivery com a sua marca,
                      sem pagar comissões abusivas.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-12 h-12 shrink-0 bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                      Dashboard de Vendas
                    </h4>
                    <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm">
                      Relatórios detalhados, controle de estoque e margem de
                      lucro em tempo real.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Visual Representation of the App */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative h-full flex items-center"
            >
              <div className="absolute inset-0 bg-gradient-to-tr from-orange-600/20 to-transparent rounded-3xl blur-3xl"></div>
              <div className="relative w-full aspect-square rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-[#262626]">
                <img
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=800&auto=format&fit=crop"
                  alt="Sistema de Gestão MenuFácil"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-8">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl text-white">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                      <span className="font-medium text-sm">
                        Sistema Online
                      </span>
                    </div>
                    <p className="text-sm text-white/80">
                      Acompanhe seus pedidos em tempo real de qualquer
                      dispositivo.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Success Stories Section */}
      <section
        id="clientes"
        className="py-24 bg-white dark:bg-[#0A0A0B] overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div>
              <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
                Quem usa, recomenda.
              </h2>
              <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-lg max-w-xl">
                Veja como o MenuFácil está ajudando empreendedores a venderem
                mais e trabalharem menos.
              </p>
            </div>
            <div className="flex gap-4">
              <button
                onClick={() => scrollCarousel("left")}
                className="w-12 h-12 rounded-full border border-slate-200 dark:border-[#262626] bg-slate-100 dark:bg-[#121214] flex items-center justify-center text-slate-900 dark:text-white hover:bg-orange-500 hover:border-orange-500 transition-colors focus:outline-none"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={() => scrollCarousel("right")}
                className="w-12 h-12 rounded-full border border-slate-200 dark:border-[#262626] bg-slate-100 dark:bg-[#121214] flex items-center justify-center text-slate-900 dark:text-white hover:bg-orange-500 hover:border-orange-500 transition-colors focus:outline-none"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>
          </div>

          <div
            ref={carouselRef}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-8 pt-4 -mx-6 px-6 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {(testimonials.length > 0 ? testimonials : defaultTestimonials).map((testimonial) => (
              <div
                key={testimonial.id}
                className="snap-start shrink-0 w-[300px] md:w-[400px] bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] p-8 rounded-3xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex gap-1 mb-6 text-orange-500">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`w-4 h-4 ${n <= (testimonial.stats?.rating || 5) ? 'fill-current' : ''}`} />
                    ))}
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 text-lg leading-relaxed mb-8">
                    "{testimonial.text}"
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {testimonial.photo ? (
                    <img src={testimonial.photo} alt={testimonial.name} className="w-12 h-12 rounded-full object-cover bg-[#262626]" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-600 flex items-center justify-center text-white font-bold text-lg">
                      {testimonial.avatar}
                    </div>
                  )}
                  <div className="flex-1">
                    <h4 className="text-slate-900 dark:text-white font-bold">
                      {testimonial.name}
                    </h4>
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      {testimonial.business}
                    </p>
                    {testimonial.stats && (
                      <p className="text-xs text-orange-500 mt-1 font-medium">
                        {testimonial.stats.orders} pedidos
                        {testimonial.stats.rating ? ` · ${testimonial.stats.rating} ⭐` : ''}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>


      {/* Planos Section */}
      <section
        id="planos"
        className="py-24 bg-slate-100 dark:bg-[#121214] border-y border-slate-200 dark:border-[#262626]"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 dark:text-white mb-4">
              Planos sem surpresas
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-lg">
              Comece grátis, escale quando precisar. Sem taxa de adesão, sem comissões por pedido.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {Object.values(PLANS).map((plan, index) => {
              const features = PLAN_FEATURES.filter((f) => f.availableIn.includes(plan.id));
              const missingFeatures = PLAN_FEATURES.filter(
                (f) => !f.availableIn.includes(plan.id) && f.availableIn.includes('completo')
              );
              const isComplete = plan.id === 'completo';

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, x: index === 0 ? -30 : 30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                  className={`p-8 rounded-3xl border flex flex-col transition-all ${
                    isComplete
                      ? 'bg-gradient-to-b from-orange-50 to-white dark:from-[#1c1c21] dark:to-[#18181B] border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.15)] relative'
                      : 'bg-slate-50 dark:bg-[#18181B] border-slate-200 dark:border-[#262626] hover:border-orange-500/50'
                  }`}
                >
                  {isComplete && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                      <span className="bg-orange-500 text-white text-xs font-bold uppercase tracking-wider py-1.5 px-4 rounded-full shadow-lg">
                        Mais Escolhido
                      </span>
                    </div>
                  )}

                  <div className={`mb-8 ${isComplete ? 'mt-2' : ''}`}>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                      {plan.name}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      {plan.description}
                    </p>
                  </div>

                  <div className="mb-8">
                    <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                      {formatPlanPrice(plan)}
                    </span>
                  </div>

                  <ul className="space-y-4 mb-8 flex-1">
                    {features.map((feature) => (
                      <li key={feature.id} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                        <span className={`text-slate-600 dark:text-slate-300 ${feature.highlight ? 'font-semibold' : ''}`}>
                          {feature.name}
                        </span>
                      </li>
                    ))}
                    {isComplete && missingFeatures.map((feature) => (
                      <li key={feature.id} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                        <span className="text-slate-600 dark:text-slate-300">
                          {feature.name}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => setIsModalOpen(true)}
                    className={`w-full py-4 rounded-xl font-bold transition-all ${
                      isComplete
                        ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-[0_0_15px_rgba(234,88,12,0.4)]'
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-[#262626] dark:hover:bg-[#3f3f46] text-slate-900 dark:text-white'
                    }`}
                  >
                    {isComplete ? `Assinar ${plan.name}` : 'Começar Grátis'}
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>


      {/* Comparativo de Planos */}
      <section className="py-24 px-6 bg-white dark:bg-[#0A0A0B]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Compare os planos
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
              Escolha o plano que faz sentido para o momento do seu negócio. Você pode fazer upgrade a qualquer momento.
            </p>
          </div>

          <div className="bg-white dark:bg-[#121214] rounded-3xl border border-slate-200 dark:border-[#262626] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-[#262626]">
                    <th className="p-6 text-slate-500 dark:text-slate-400 font-medium text-sm">Recurso</th>
                    {Object.values(PLANS).map((plan) => (
                      <th key={plan.id} className="p-6 text-center min-w-[160px]">
                        <span className={`text-lg font-bold ${plan.id === 'completo' ? 'text-orange-600 dark:text-orange-500' : 'text-slate-900 dark:text-white'}`}>
                          {plan.name}
                        </span>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                          {formatPlanPrice(plan)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PLAN_FEATURES.map((feature, index) => (
                    <tr key={feature.id} className={index !== PLAN_FEATURES.length - 1 ? 'border-b border-slate-200 dark:border-[#262626]' : ''}>
                      <td className="p-6">
                        <span className="font-medium text-slate-900 dark:text-white">{feature.name}</span>
                        {feature.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{feature.description}</p>
                        )}
                      </td>
                      {Object.values(PLANS).map((plan) => {
                        const hasAccess = feature.availableIn.includes(plan.id as import('../data/plans').PlanType);
                        return (
                          <td key={plan.id} className="p-6 text-center">
                            {hasAccess ? (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            ) : (
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-[#262626] text-slate-400">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#09090b]">
                    <td className="p-6 font-medium text-slate-900 dark:text-white"></td>
                    {Object.values(PLANS).map((plan) => (
                      <td key={plan.id} className="p-6 text-center">
                        <button
                          onClick={() => setIsModalOpen(true)}
                          className={`px-6 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                            plan.id === 'completo'
                              ? 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/20'
                              : 'bg-slate-200 hover:bg-slate-300 dark:bg-[#262626] dark:hover:bg-[#3f3f46] text-slate-900 dark:text-white'
                          }`}
                        >
                          {plan.id === 'completo' ? `Assinar ${plan.name}` : 'Começar Grátis'}
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Bottom */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=2000&auto=format&fit=crop"
            alt="Restaurante"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
        <div className="max-w-4xl mx-auto px-6 relative text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Pronto para digitalizar seu negócio?
          </h2>
          <p className="text-xl text-slate-300">
            Junte-se a mais de 1.000 estabelecimentos que já estão vendendo mais
            com o MenuFácil.
          </p>
          <div className="pt-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-orange-600 hover:bg-orange-500 text-white text-lg px-10 py-5 rounded-2xl font-bold transition-all shadow-[0_0_30px_rgba(234,88,12,0.5)] hover:shadow-[0_0_40px_rgba(234,88,12,0.7)] hover:-translate-y-1 inline-flex items-center gap-3"
            >
              Criar Conta Grátis <ArrowRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-[#050505] pt-16 pb-8 border-t border-slate-200 dark:border-[#262626]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="MenuFácil" className="h-8 w-auto object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <Utensils className="w-6 h-6 text-orange-500 logo-fallback" />
                <span className="font-bold text-xl text-slate-900 dark:text-white">
                  MenuFácil
                </span>
              </div>
              <p className="text-slate-400 dark:text-slate-500 dark:text-slate-400 text-sm max-w-sm mb-6">
                O sistema ideal para pequenos negócios. Feito sob medida para
                MEIs, lanchonetes, docerias, food trucks e deliveries.
              </p>
            </div>

            <div>
              <h4 className="text-slate-900 dark:text-white font-bold mb-4">
                Produtos
              </h4>
              <ul className="space-y-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
                <li>
                  <Link
                    to="/cardapio-digital"
                    className="hover:text-orange-500 transition-colors"
                  >
                    Cardápio Digital
                  </Link>
                </li>
                <li>
                  <Link
                    to="/pedidos-whatsapp"
                    className="hover:text-orange-500 transition-colors"
                  >
                    Pedidos WhatsApp
                  </Link>
                </li>
                <li>
                  <Link
                    to="/painel-gestao"
                    className="hover:text-orange-500 transition-colors"
                  >
                    Painel de Gestão
                  </Link>
                </li>
                <li>
                  <Link
                    to="/app-whitelabel"
                    className="hover:text-orange-500 transition-colors"
                  >
                    App White-Label
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-slate-900 dark:text-white font-bold mb-4">
                Empresa
              </h4>
              <ul className="space-y-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
                <li>
                  <button
                    onClick={() => openInfoModal("Sobre Nós", sobreNosContent)}
                    className="hover:text-orange-500 transition-colors text-left w-full"
                  >
                    Sobre Nós
                  </button>
                </li>
                <li>
                  <a
                    href="#clientes"
                    className="hover:text-orange-500 transition-colors block"
                  >
                    Clientes
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="text-slate-900 dark:text-white font-bold mb-4">
                Legal & Suporte
              </h4>
              <ul className="space-y-2 text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400">
                <li>
                  <button
                    onClick={() =>
                      openInfoModal("Termos de Uso", termosDeUsoContent)
                    }
                    className="hover:text-orange-500 transition-colors text-left w-full"
                  >
                    Termos de Uso
                  </button>
                </li>
                <li>
                  <button
                    onClick={() =>
                      openInfoModal("Privacidade", privacidadeContent)
                    }
                    className="hover:text-orange-500 transition-colors text-left w-full"
                  >
                    Privacidade
                  </button>
                </li>
                <li>
                  <button
                    onClick={() =>
                      openInfoModal("Central de Ajuda", centralDeAjudaContent)
                    }
                    className="hover:text-orange-500 transition-colors text-left w-full"
                  >
                    Central de Ajuda
                  </button>
                </li>
                <li>
                  <button
                    onClick={() =>
                      openInfoModal("Fale Conosco", faleConoscoContent)
                    }
                    className="hover:text-orange-500 transition-colors text-left w-full"
                  >
                    Fale Conosco
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-[#262626] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-sm text-slate-400 dark:text-slate-500 text-center md:text-left flex flex-col md:flex-row gap-1 md:gap-2">
              <span>© 2026 MenuFácil. Todos os direitos reservados.</span>
              <span className="hidden md:inline">|</span>
              <span>
                Desenvolvido por{" "}
                <a 
                  href="https://www.dewas.com.br" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-orange-500 transition-colors font-medium"
                >
                  DEWAS Sistemas Soluções em Tecnologia
                </a>
              </span>
            </div>
            <div className="flex gap-4">
              <a
                href="#"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-white hover:border-orange-500 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a
                href="#"
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-[#121214] border border-slate-200 dark:border-[#262626] flex items-center justify-center text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-white hover:border-orange-500 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>

      <NewTenantModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTenant}
        isSubmitting={isRegistering}
      />
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
      <InfoModal
        isOpen={infoModalConfig.isOpen}
        onClose={closeInfoModal}
        title={infoModalConfig.title}
        content={infoModalConfig.content}
      />
    </div>
  );
}
