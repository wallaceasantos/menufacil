import { Link } from 'react-router-dom'
import { ArrowLeft, FileText, Shield } from 'lucide-react'

function LegalLayout({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b]">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/" className="inline-flex items-center gap-2 text-orange-600 dark:text-orange-400 hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Voltar ao início
        </Link>
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/10 rounded-2xl flex items-center justify-center">
            {icon}
          </div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{title}</h1>
        </div>
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-3xl p-8 shadow-xl space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed">
          {children}
        </div>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Última atualização: outubro de 2026
        </p>
      </div>
    </div>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{n}. {title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  )
}

export function TermosDeUso() {
  return (
    <LegalLayout title="Termos de Uso" icon={<FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />}>
      <p>
        Bem-vindo ao MenuFácil. Estes Termos de Uso regem a utilização da plataforma de cardápio digital e
        gestão de restaurantes MenuFácil ("Plataforma"). Ao criar uma conta ou utilizar a Plataforma, você
        concorda com estes Termos.
      </p>
      <Section n={1} title="Da descrição do serviço">
        <p>
          O MenuFácil é um software como serviço (SaaS) que permite a restaurantes, lanchonetes e estabelecimentos
          de alimentação ("Lojista") publicar cardápios digitais, receber e gerenciar pedidos, processar pagamentos
          (PIX, cartão e boleto), gerenciar estoque, clientes e equipe, e se comunicar com seus consumidores
          ("Consumidor") por WhatsApp e notificações.
        </p>
      </Section>
      <Section n={2} title="Da conta e cadastro">
        <p>
          Para utilizar a Plataforma, o Lojista deve fornecer informações verdadeiras e mantê-las atualizadas.
          O Lojista é responsável pela guarda de suas credenciais de acesso e por todas as atividades realizadas
          em sua conta, inclusive contas de equipe (atendente, cozinha, entregador).
        </p>
      </Section>
      <Section n={3} title="Dos planos e cobrança">
        <p>
          A Plataforma oferece plano gratuito (Grátis) e plano pago (Completo). As cobranças são realizadas
          mensalmente por meio do Mercado Pago (PIX, cartão de crédito ou boleto). O não pagamento pode resultar
          em suspensão ou rebaixamento automático para o plano gratuito, preservando os dados do Lojista.
        </p>
        <p>
          Cancelamentos podem ser solicitados a qualquer momento e produzem efeito ao término do ciclo vigente.
        </p>
      </Section>
      <Section n={4} title="Das obrigações do Lojista">
        <ul className="list-disc pl-5 space-y-1">
          <li>Manter informações de produtos, preços e disponibilidade sempre atualizadas;</li>
          <li>Honrar os pedidos realizados pelos Consumidores pela Plataforma;</li>
          <li>Cumprir a legislação aplicável, inclusive sanitária, de defesa do consumidor e tributária;</li>
          <li>Não utilizar a Plataforma para conteúdo ilícito, enganoso ou que viole direitos de terceiros;</li>
          <li>Responder pelos produtos ofertados e entregas realizadas.</li>
        </ul>
      </Section>
      <Section n={5} title="Dos limites de responsabilidade">
        <p>
          O MenuFácil disponibiliza a infraestrutura tecnológica e não se responsabiliza pela relação comercial
          entre Lojista e Consumidor, qualidade dos produtos ou entregas, nem por indisponibilidades de serviços
          de terceiros (Mercado Pago, WhatsApp, hospedagem). Nossa responsabilidade limita-se ao valor dos
          serviços pagos nos 12 meses anteriores ao evento.
        </p>
      </Section>
      <Section n={6} title="Da propriedade intelectual">
        <p>
          Todo o software, marca, layout e conteúdo da Plataforma pertencem ao MenuFácil. O Lojista mantém os
          direitos sobre seus conteúdos (imagens, textos, marca), concedendo licença de uso para exibição.
        </p>
      </Section>
      <Section n={7} title="Da suspensão e encerramento">
        <p>
          Violações destes Termos podem resultar em suspensão ou encerramento da conta. O Lojista pode exportar
          seus dados antes do encerramento, conforme a Política de Privacidade.
        </p>
      </Section>
      <Section n={8} title="Das alterações destes Termos">
        <p>
          Alterações relevantes serão comunicadas por e-mail ou notificação com antecedência mínima de 15 dias.
          O uso continuado após a vigência constitui aceitação.
        </p>
      </Section>
      <Section n={9} title="Do foro">
        <p>
          Fica eleito o foro da Comarca do domicílio do Lojista para dirimir controvérsias, com aplicação da
          legislação brasileira, sem prejuízo do foro do domicílio do consumidor.
        </p>
      </Section>
      <Section n={10} title="Contato">
        <p>Dúvidas podem ser enviadas pelo canal de suporte da Plataforma (Dashboard → Suporte).</p>
      </Section>
    </LegalLayout>
  )
}

export function PoliticaPrivacidade() {
  return (
    <LegalLayout title="Política de Privacidade" icon={<Shield className="w-6 h-6 text-orange-600 dark:text-orange-400" />}>
      <p>
        Esta Política de Privacidade descreve como o MenuFácil coleta, utiliza, armazena e protege dados pessoais,
        em conformidade com a Lei Geral de Proteção de Dados — LGPD (Lei nº 13.709/2018).
      </p>
      <Section n={1} title="Dados que coletamos">
        <p><strong>Do Lojista:</strong> nome, e-mail, telefone, CPF/CNPJ, endereço, dados de cobrança, credenciais de acesso (em hash), dados do estabelecimento.</p>
        <p><strong>Do Consumidor:</strong> nome, telefone, endereço de entrega, itens e valores dos pedidos, avaliações e comentários opcionais.</p>
        <p><strong>De navegação:</strong> cookies técnicos, endereço IP, dados de dispositivo para funcionamento e segurança.</p>
      </Section>
      <Section n={2} title="Finalidades e bases legais">
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Execução do contrato:</strong> processar pedidos, pagamentos, entregas e o uso da Plataforma;</li>
          <li><strong>Obrigação legal:</strong> guarda de documentos fiscais e contábeis;</li>
          <li><strong>Legítimo interesse:</strong> segurança, prevenção a fraudes e melhoria do serviço;</li>
          <li><strong>Consentimento:</strong> comunicações de marketing (revogável a qualquer momento).</li>
        </ul>
      </Section>
      <Section n={3} title="Compartilhamento de dados">
        <p>
          Compartilhamos dados apenas com provedores necessários ao serviço: <strong>Mercado Pago</strong> (pagamentos),
          <strong>Cloudinary</strong> (imagens), provedores de e-mail e WhatsApp (notificações) e hospedagem.
          Também podemos compartilhar por obrigação legal ou ordem judicial. Não vendemos dados pessoais.
        </p>
      </Section>
      <Section n={4} title="Lojista e Consumidor">
        <p>
          O Consumidor que realiza um pedido compartilha seus dados (nome, telefone, endereço) com o Lojista
          daquele estabelecimento, que passa a ser controlador desses dados para execução do pedido e obrigações
          legais. O MenuFácil atua como operador nesse contexto.
        </p>
      </Section>
      <Section n={5} title="Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais: criptografia em trânsito (HTTPS), senhas em hash (bcrypt),
          isolamento de dados entre estabelecimentos (multi-tenant), controle de acesso por perfil, backups
          periódicos e monitoramento de eventos de segurança.
        </p>
      </Section>
      <Section n={6} title="Retenção de dados">
        <p>
          Dados são mantidos enquanto a conta estiver ativa e pelo período exigido por obrigações legais
          (ex.: documentos fiscais). Solicitações de exclusão são atendidas com anonimização dos dados pessoais,
          preservando registros exigidos por lei.
        </p>
      </Section>
      <Section n={7} title="Seus direitos (LGPD, Art. 18)">
        <ul className="list-disc pl-5 space-y-1">
          <li>Confirmação da existência de tratamento e acesso aos dados;</li>
          <li>Correção de dados incompletos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou excessivos;</li>
          <li>Portabilidade dos dados;</li>
          <li>Informações sobre compartilhamento;</li>
          <li>Revogação do consentimento.</li>
        </ul>
        <p>Solicitações podem ser feitas pelo canal de suporte (Dashboard → Suporte). Respondemos em até 15 dias.</p>
      </Section>
      <Section n={8} title="Cookies">
        <p>
          Utilizamos cookies essenciais para autenticação e funcionamento. Não utilizamos cookies de publicidade
          de terceiros.
        </p>
      </Section>
      <Section n={9} title="Encarregado de dados (DPO)">
        <p>
          Contato do encarregado pelo tratamento de dados disponível pelo canal de suporte da Plataforma,
          para questões relacionadas à LGPD.
        </p>
      </Section>
      <Section n={10} title="Alterações desta Política">
        <p>
          Esta Política pode ser atualizada para refletir mudanças legais ou operacionais. Alterações relevantes
          serão comunicadas na Plataforma ou por e-mail.
        </p>
      </Section>
    </LegalLayout>
  )
}

export default TermosDeUso