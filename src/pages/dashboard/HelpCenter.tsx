import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown, MessageCircle, BookOpen, QrCode, CreditCard, ShoppingBag, Settings as SettingsIcon } from 'lucide-react'

interface FaqItem {
  id: string
  category: string
  icon: React.ElementType
  question: string
  answer: string
}

const FAQ: FaqItem[] = [
  {
    id: 'share-menu',
    category: 'Cardápio',
    icon: QrCode,
    question: 'Como compartilho meu cardápio com os clientes?',
    answer: 'Acesse "Minha Loja" e copie o link da sua loja (formato /loja/seu-restaurante). Você também pode gerar um QR Code para imprimir no balcão ou nas mesas. O cardápio funciona em qualquer celular, sem app.',
  },
  {
    id: 'first-product',
    category: 'Cardápio',
    icon: ShoppingBag,
    question: 'Como crio categorias e produtos?',
    answer: 'Vá em "Cardápio", clique em "Nova Categoria" (ex: Lanches, Bebidas) e depois em "Novo Produto". Defina nome, preço, descrição e foto. Produtos podem ter componentes e grupos de opções (ex: ponto da carne, adicionais).',
  },
  {
    id: 'schedule-menu',
    category: 'Cardápio',
    icon: BookOpen,
    question: 'Posso agendar o cardápio por horário?',
    answer: 'Sim. Categorias têm horários de início e fim — ideal para almoço, jantar ou café da manhã. A categoria só aparece no cardápio público dentro da janela configurada.',
  },
  {
    id: 'pix-manual',
    category: 'Pagamentos',
    icon: CreditCard,
    question: 'Como recebo por PIX?',
    answer: 'Em "Pagamentos", cadastre sua chave PIX ou envie a imagem do QR Code. O cliente escolhe PIX no checkout, vê a chave/QR e envia o comprovante pelo WhatsApp. A confirmação é feita manualmente por você.',
  },
  {
    id: 'pix-auto',
    category: 'Pagamentos',
    icon: CreditCard,
    question: 'O que é o PIX automático (Mercado Pago)?',
    answer: 'No plano Completo, o PIX é gerado automaticamente via Mercado Pago: o pedido já nasce com QR Code e o status muda para "aprovado" sozinho quando o pagamento cai. Requer conta Mercado Pago configurada.',
  },
  {
    id: 'order-status',
    category: 'Pedidos',
    icon: ShoppingBag,
    question: 'Como gerencio o status dos pedidos?',
    answer: 'Em "Pedidos", você acompanha a fila em tempo real e muda o status: confirmado → preparando → saiu para entrega → concluído. O cliente acompanha tudo pela página de rastreio, com atualização ao vivo.',
  },
  {
    id: 'printer',
    category: 'Pedidos',
    icon: SettingsIcon,
    question: 'Como configuro a impressora térmica?',
    answer: 'Em "Impressão", cadastre sua impressora ESC/POS e ative a impressão automática de novos pedidos. Há também uma fila de impressão para reenviar cupons.',
  },
  {
    id: 'plan-change',
    category: 'Conta e Cobrança',
    icon: CreditCard,
    question: 'Como faço upgrade para o plano Completo?',
    answer: 'Em "Assinatura", clique em "Fazer Upgrade". O pagamento pode ser por PIX, cartão ou boleto via Mercado Pago. Os recursos são liberados imediatamente após a confirmação.',
  },
  {
    id: 'billing-overdue',
    category: 'Conta e Cobrança',
    icon: CreditCard,
    question: 'O que acontece se eu atrasar o pagamento?',
    answer: 'Após 3 dias o pagamento é marcado como em atraso e após 30 dias a conta volta automaticamente para o plano Grátis. Seus dados e cardápio continuam salvos — basta regularizar para reativar.',
  },
  {
    id: 'team',
    category: 'Equipe',
    icon: SettingsIcon,
    question: 'Como adiciono funcionários?',
    answer: 'Em "Equipe", convide por e-mail e defina o papel: dono (acesso total), atendente (pedidos e clientes), cozinha (pedidos) ou entregador (pedidos). Cada acesso é protegido por permissões.',
  },
  {
    id: '2fa',
    category: 'Segurança',
    icon: SettingsIcon,
    question: 'Como ativo a autenticação em duas etapas (2FA)?',
    answer: 'Em "Configurações → Conta", clique em "Configurar 2FA" e escaneie o QR Code com Google Authenticator ou Authy. A partir daí, o login exige o código de 6 dígitos além da senha.',
  },
]

const CATEGORIES = ['Todos', 'Cardápio', 'Pagamentos', 'Pedidos', 'Conta e Cobrança', 'Equipe', 'Segurança']

export function HelpCenter() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [openId, setOpenId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return FAQ.filter((item) => {
      const matchesCategory = category === 'Todos' || item.category === category
      const matchesSearch =
        !term ||
        item.question.toLowerCase().includes(term) ||
        item.answer.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term)
      return matchesCategory && matchesSearch
    })
  }, [search, category])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Central de Ajuda</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Respostas rápidas para as dúvidas mais comuns</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar ajuda... (ex: PIX, produto, impressora)"
          className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              category === cat
                ? 'bg-orange-600 text-white'
                : 'bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] text-slate-600 dark:text-slate-300 hover:border-orange-500/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-8 text-center">
            <p className="text-slate-500 dark:text-slate-400">Nenhum resultado para "{search}"</p>
            <button
              onClick={() => navigate('/dashboard/support')}
              className="mt-4 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Abrir um chamado
            </button>
          </div>
        ) : (
          filtered.map((item) => {
            const Icon = item.icon
            const isOpen = openId === item.id
            return (
              <div key={item.id} className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : item.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-[#18181b] transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{item.question}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{item.category}</p>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 pl-16">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
          <MessageCircle className="w-5 h-5 text-orange-600 dark:text-orange-500" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white">Não encontrou o que precisava?</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">Nossa equipe responde em até 1 dia útil.</p>
        </div>
        <button
          onClick={() => navigate('/dashboard/support')}
          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-semibold transition-colors shrink-0"
        >
          Falar com suporte
        </button>
      </div>
    </div>
  )
}
