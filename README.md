# MenuFácil

**Gestão completa para seu restaurante**

Cardápio digital, pedidos via WhatsApp e painel de gestão para microempreendedores.

## Funcionalidades

- 🍽️ **Cardápio digital** — link e QR code para clientes
- 📱 **Pedidos via WhatsApp** — cliente escolhe e pede direto
- 📊 **Relatórios** — vendas, produtos mais vendidos, horários de pico
- 📦 **Controle de estoque** — FEFO, lotes, pedidos de compra
- 👥 **CRM** — histórico de clientes, VIP, bloqueio
- 🎫 **Cupons** — descontos percentuais e valor fixo
- 🚚 **Áreas de entrega** — por raio, CEP ou bairro
- 🔔 **Notificações** — SSE em tempo real + web push
- 💳 **PIX automático** — geração de QR code via Mercado Pago
- 👥 **Multiusuário** — perfis: dono, atendente, cozinha, entregador

## Stack

- **Frontend:** React 19, Vite, Tailwind CSS 4, Recharts, Framer Motion
- **Backend:** Express, Prisma ORM, PostgreSQL
- **Pagamentos:** Mercado Pago (PIX, cartão, boleto)
- **Notificações:** SSE + Web Push + WhatsApp API

## Setup

```bash
# Instalar dependências
npm install

# Configurar .env (baseado em .env.example)
cp .env.example .env

# Rodar migrations
npx prisma db push

# Iniciar dev
npm run dev        # frontend :3000
npm run dev:server # backend  :3001
```

## Planos

| Plano | Preço |
|---|---|
| Grátis | R$ 0,00 |
| Completo | R$ 79,90/mês |
