# MenuFácil — AI Agent Context

Full-stack SaaS para cardápio digital e gestão de restaurantes. Multi-tenant, planos Free/Completo, Mercado Pago, SSE, Web Push.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Vite 6, React 19, Tailwind CSS 4, React Router 7, Recharts, Framer Motion, Lucide React |
| Backend | Express 4, `tsx` runtime, ESM modules, TypeScript 5.8 |
| Database | PostgreSQL via Prisma ORM 6 |
| Auth | JWT (`jsonwebtoken`) + `bcryptjs`, tokens via `sessionStorage` |
| Payments | Mercado Pago (`src/lib/mercadopago.ts`) — PIX, cartão, boleto, subscription |
| Upload | Cloudinary + Multer |
| Push | Web Push (VAPID) — `web-push` lib |
| Security | Helmet, express-rate-limit, CORS restrito |
| Charts | Recharts |
| CSS | Tailwind CSS 4 via `@tailwindcss/vite` plugin |

## How to Run

```bash
npm install
npx prisma db push    # sync schema
npm run dev            # frontend :3000
npm run dev:server     # backend :3001 (tsx watch)
npm run dev:worker     # worker de cron/cobrança + filas (opcional)
npm run lint           # tsc --noEmit
npm test               # vitest run (testes unitários)
npm run test:e2e       # Playwright (fluxo pedido/PIX)
npm start              # production: vite build + tsx server
npm run db:backup      # backup do Postgres (requer pg_dump)
```

**Dev workflow:** Always 2 terminals — `npm run dev` + `npm run dev:server`. Backend needs restart on route/schema changes. Frontend HMR auto-reloads.

## Environment Variables (.env)

```
DATABASE_URL=postgresql://...
VITE_API_URL=http://localhost:3001/api
JWT_SECRET=...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
MP_ACCESS_TOKEN=TEST-xxx
MP_WEBHOOK_SECRET=
MP_WEBHOOK_URL=https://xxx.ngrok-free.dev
MP_TEST_PRICE=10
MP_LOCAL_MODE=true          # simulates payments without real MP API
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
APP_URL=http://localhost:3000
ADDITIONAL_CORS_ORIGINS=    # optional extra domains (comma-separated)
```

**Important:** `MP_LOCAL_MODE=true` bypasses Mercado Pago API. All payment flows simulate locally. `MP_TEST_PRICE` overrides the Completo plan price for testing.

## Folder Structure

```
prisma/schema.prisma          — single source of truth, 34 models
public/
  sw.js                       — service worker (push + cache)
  manifest.json               — PWA manifest
  icon-192.svg                — PWA icon
  logo.png                    — site logo (optional, loaded by Home/dashboards/public store)
src/
  server.ts                   — Express app, cron, graceful shutdown, static SPA serving
  main.tsx                    — React entry + SW registration
  App.tsx                     — routes + lazy pages
  routes/                     — 23 route files, all registered in index.ts
    index.ts                  — master router (all /api/* mounts)
    auth.ts                   — register, login, me, register-tenant (with invite token), forgot-password, reset-password
    tenants.ts                — CRUD tenants
    public.ts                 — storefront, orders, tracking, PIX, ratings, coupon validation
    menu.ts                   — categories + products CRUD
    orders.ts                 — list, detail, status change, bulk
    inventory.ts              — items, batches, movements, suppliers, PO
    mp.ts                     — Mercado Pago checkout, webhook, subscription
    store.ts                  — tenant settings, domain config, platform review
    reports.ts                — analytics with 10 dimensions, CSV export
    customers.ts              — CRM CRUD, stats, search
    deliveryZones.ts          — zones by radius/CEP/neighborhood, fee calc
    events.ts                 — SSE stream (token in query params, admin heartbeat)
    printer.ts                — ESC/POS formatting, print queue, auto-print
    discounts.ts              — coupon CRUD, validation
    push.ts                   — web push subscribe/unsubscribe
    team.ts                   — members CRUD, invite, accept (with existing account)
    testimonials.ts           — auto-generated testimonials from real tenant data
    support.ts                — tickets, messages, attachments
    whatsapp.ts               — WhatsApp config, test message
    payments.ts               — PIX/cash/card config + pixQrCodeImage upload
    invoices.ts               — invoice CRUD
    upload.ts                 — Cloudinary image upload
    admin.ts                  — tenant list, finance, announcements, reset-db
  lib/
    prisma.ts                 — PrismaClient singleton (import from here)
    api.ts                    — client-side fetch wrappers (api, apiWithTenant, apiWithTenantBlob)
    mercadopago.ts            — MP API client (payments, customers, cards, preapproval)
    escpos.ts                 — ESC/POS receipt formatter
    eventBus.ts               — in-memory pub/sub for SSE
    webPush.ts                — send web push via VAPID
    pushNotify.ts             — send push to all tenant subscriptions
    cache.ts                  — simple Map-based cache with TTL
    logger.ts                 — structured JSON logging (LOG_LEVEL)
    alerts.ts                 — error alerts to ALERT_WEBHOOK_URL (throttled)
    planLog.ts                — log plan changes
    jwt.ts / password.ts      — JWT sign/verify, bcrypt hash/verify
    whatsapp.ts               — send WhatsApp notifications (includes tracking link)
    email.ts                  — Nodemailer email sender
    cloudinary.ts             — Cloudinary upload helper
    menuValidation.ts         — server-side order validation
    masks.ts / cpf.ts         — input masks, CPF validation
    time.ts / utils.ts        — time/string utilities
  middleware/
    auth.ts                   — authenticate (JWT), requireAdmin
    tenant.ts                 — extractTenant (x-tenant-slug header or JWT fallback)
    permissions.ts            — requirePermission(permissionString)
    domain.ts                 — resolveTenantByDomain (custom domain routing)
    errorHandler.ts           — global error handler
  contexts/
    AuthContext.tsx            — useAuth() hook, User state, login/logout
    ThemeContext.tsx           — dark/light toggle
    NotificationContext.tsx    — SSE + notification state management
  hooks/
    useApi.ts                 — generic data fetching hook
    useInstallPrompt.ts       — PWA install detection
    usePushNotifications.ts   — web push subscribe/unsubscribe
  data/
    plans.ts                  — PLAN_FEATURES, hasFeature(), formatPlanPrice()
    tenantStorage.ts          — getTenantSlug(user)
  components/                 — 17 reusable components
  pages/
    dashboard/                — 17 dashboard pages (Overview, Orders, Menu, etc.)
    admin/                    — AdminDashboard, InvoiceManager
    Home.tsx                  — landing page (with customizable logo)
    PublicStore.tsx           — customer-facing menu + checkout (manual PIX key + QR image)
    TrackingPage.tsx          — order tracking (SSE, QR, rating, PIX status)
    RegisterPage.tsx          — invite registration
    ProductFeature.tsx        — feature pages (marketing)
  types/index.ts              — ApiUser, ApiTenant, ApiProduct, etc.
```

## Database (Prisma)

**34 models.** Key ones:

- **Tenant** — core. slug, plan (basico/completo), paymentStatus, subscriptionStatus, cardLastFour, nextBillingDate, coordinates, customDomain, platformRating, domainVerified
- **User** — role (admin/tenant), tenantRole (dono/atendente/cozinha/entregador), tenantId
- **Order** — mpPaymentId/Status/PixPayload/QrCode, rating/comment/ratedAt, customerPhone
- **Product** — productType (simple/combo/buildable), autoDeductStock
- **Category** — startTime/endTime (menu scheduling)
- **DeliveryZone** — zoneType (radius/cep/neighborhood), fee, priority
- **PrinterConfig / PrintJob** — thermal printer queue
- **Discount** — coupon codes (percentage/fixed)
- **Invite** — team invites with token, expires in 7 days
- **PushSubscription** — web push endpoints
- **PaymentConfig** — PIX key, QR code image, cash/card toggles
- **PlanChangeLog** — audit trail

**Important field notes:**
- `asaasCustomerId` / `asaasSubscriptionId` — misnamed, actually hold Mercado Pago IDs
- `product_complements` / `order_item_complements` — legacy tables, new code uses ProductComponent/ProductChoiceGroup
- Schema file: **only** `prisma/schema.prisma` (deleted `database/schema.prisma` duplicate)
- Migrations: `prisma/migrations/` versionadas. Produção usa `npm run db:migrate` (`prisma migrate deploy`). Em dev, mudanças de schema: `npm run db:migrate:dev` (gera migração nova). Bancos criados antes das migrations: rodar `npm run db:baseline` uma vez

## Authentication & Multi-Tenancy

**Auth flow:**
1. JWT stored in `sessionStorage` (key: `jwt_token`)
2. Client sends `Authorization: Bearer <token>` header
3. `authenticate` middleware decodes token, sets `req.user`
4. `extractTenant` middleware: reads `x-tenant-slug` header OR falls back to `req.user.tenantId`
5. All authenticated routes need both `authenticate` + `extractTenant`

**Roles (per-tenant):**
- `dono` — wildcard access `*`
- `atendente` — orders:rw, customers:r, menu:r
- `cozinha` — orders:rw
- `entregador` — orders:r

**Sessões (tokenVersion):** JWT carrega `tokenVersion`; `authenticate` compara com `User.tokenVersion` no banco. Recuperação de senha incrementa a versão → todas as sessões do usuário são invalidadas. Recuperação também: throttling 3 e-mails/hora por destinatário, auditoria (`auth.forgot_password`/`auth.reset_password`) e e-mail de confirmação "senha alterada".

**Sidebar filtering:** `DashboardLayout.tsx` uses `allNavItems.filter(item => item.roles.includes(tenantRole) && item.plans.includes(userPlan))`

**Public routes (no auth):** `/api/loja/*`, `/api/mp/webhook`, `/api/domain-check`, `/api/testimonials`, `/api/events/stream` (token in query params), `/register`

## Plan Features & Feature Gating

```ts
// src/data/plans.ts — single source of truth
PLANS.basico.price   // 0 (Grátis) — cardápio + WhatsApp
PLANS.completo.price // 79.90 — tudo incluso

// Check feature access
hasFeature('stock-control', user?.plan) // true only for completo
```

**Sidebar plan filtering:** Each nav item has `plans: ['basico', 'completo']` or `plans: ['completo']`. Grátis vê 9 itens, Completo vê todos.

**Key plan exclusives:** Estoque, Relatórios, Áreas de Entrega, Impressão, Cupons, Equipe, Clientes, Pedidos (painel), WhatsApp config, order-status-management.

## API Patterns

- Always use `apiWithTenant<T>(endpoint, tenantSlug, options?)` for tenant-scoped endpoints
- Public endpoints use `api<T>(endpoint, options?)` without tenant slug
- SSE: `EventSource` with `{ token, tenantSlug }` as query params (EventSource can't send headers)
- `res.status(201).json(...)` for creates
- All errors through `next(err)`
- Async side effects (print, push, WhatsApp, email) use `.catch(() => {})` — **never block the response**

## Real-Time Events

- **`eventBus`** (`src/lib/eventBus.ts`) — in-memory pub/sub, one per tenant
- **SSE** (`src/routes/events.ts`) — `GET /api/events/stream?token=...&tenantSlug=...`
- Admin SSE: connects without tenant, heartbeat only
- Events emitted: `new_order`, `order_status_changed`, `inventory_low`
- **NotificationContext** (`src/contexts/NotificationContext.tsx`) — manages SSE connection, toast queue, notification list
- **NotificationCenter** (`src/components/NotificationCenter.tsx`) — bell icon with dropdown + push toggle
- **Web push** (`src/lib/webPush.ts` + `src/routes/push.ts`) — triggered via `notifyPush()` on new orders/status changes/stock alerts

## Mercado Pago Integration

- **`src/lib/mercadopago.ts`** — fetch wrapper with idempotency keys
- **`src/routes/mp.ts`** — checkout endpoints, webhook handler, subscription management
- **Local mode** (`MP_LOCAL_MODE=true`): bypasses all MP API calls, generates fake payment IDs
- **Webhook** (`POST /api/mp/webhook`): receives raw body (special parser in server.ts); detects if payment is for order (UUID) or tenant (subscription)
- **PIX for orders**: generated via `mp.createPayment({ payment_method_id: 'pix' })`, stored on `Order.mpPaymentId/mpPixPayload/mpPixQrCode` (Text fields, not Varchar)
- **Subscriptions**: card checkout creates `mp.createPreapproval()` for recurring billing
- **`MP_TEST_PRICE`**: overrides plan price for testing
- **Manual PIX**: each tenant can also set a manual PIX key or upload a QR code image (`PaymentConfig.pixQrCodeImage`)

## Billing Cron

`setInterval` runs every hour in `server.ts` (ou no worker — ver abaixo):
1. **Simulated billing** (`MP_LOCAL_MODE` only): charges tenants with `nextBillingDate <= today`
2. **Overdue detection** (always runs): finds tenants 31+ days past `lastBillingDate` → auto-downgrade to `basico`
3. At 3+ days: sets `paymentStatus = 'overdue'`

## Redis, Filas e Worker (Sprint 3)

- **Redis opcional** (`REDIS_URL`): rate limit distribuído (`src/lib/rateLimitStore.ts`) + filas (`src/lib/queue.ts`) com retry (3 tentativas, reenfileiramento com backoff). Sem Redis, tudo cai em fallback em memória.
- **Worker** (`npm run worker` / `src/worker.ts`): roda o cron de cobrança + consome filas (`billing:run`, `billing:tenant`, `email:send`). Com worker dedicado, subir o server com `BILLING_IN_WORKER=true` para não duplicar o cron.
- **E-mails via fila** (`src/jobs/email.ts`): `enqueueEmail()` dispara `email:send` com retry; usado na recuperação de senha (link + confirmação "senha alterada"). Handlers registrados no server e no worker.
- **Auditoria** (`src/lib/audit.ts` + model `AuditLog`): ações admin e login/2FA são gravadas. Consulta: `GET /api/admin/audit-logs`.
- **2FA TOTP** (`src/lib/totp.ts`): `POST /api/auth/2fa/setup` → `/2fa/enable` → login exige `code` e retorna `requires2FA` + `tempToken` (10min) → `POST /api/auth/2fa/verify`. Tokens com `twoFactorPending` são rejeitados pelo `authenticate`.
- **Frontend**: `LoginModal.tsx` tem passo de código 2FA; setup em Configurações → Conta (`TwoFactorSetup.tsx`).

## Onboarding, Ajuda e Métricas (Sprint 4)

- **Onboarding wizard** (`src/pages/dashboard/Onboarding.tsx`, rota `/onboarding`): 4 passos — perfil da loja → primeiro produto → pagamento → pronto. Campo `Tenant.onboardingCompletedAt`; `GET/POST /api/store/onboarding`. Login sem `onboardingCompletedAt` redireciona para o wizard.
- **Help Center** (`src/pages/dashboard/HelpCenter.tsx`, rota `/dashboard/help`): FAQ com busca + categorias, CTA para chamados. Item "Ajuda" na sidebar (todos os papéis/planos).
- **Métricas admin**: `GET /api/admin/metrics?days=30` — MRR, ARR, churn (via `PlanChangeLog`), upgrades/downgrades, novas lojas, lista de churned tenants e timeline diária. Cards no tab Financeiro do `AdminDashboard`.

## Logo Customization

Place a file `public/logo.png` in the project root. The system loads it in:
- Home page navbar + footer
- Dashboard sidebar header (lojista)
- Admin dashboard sidebar header
- Public store page (tenant's own logo, configured in StoreSettings)

All locations have automatic fallback to the default fork icon if `logo.png` doesn't exist.

## Payment Flow

**Manual PIX (per tenant):**
- Tenant configures PIX key OR uploads QR code image in Pagamentos
- Customer selects PIX at checkout → sees key (with copy button) or QR code image
- Customer pays via bank app, sends comprovante via WhatsApp
- No automatic verification — tenant confirms manually

**Automatic PIX (Mercado Pago):**
- `POST /api/loja/:slug/orders` → if `paymentMethod === 'pix'`, generates MP payment
- Stores `mpPaymentId`, `mpPixPayload`, `mpPixQrCode` on Order
- Webhook confirms payment → updates `Order.mpPaymentStatus`
- Tracking page shows QR code + simulate button in dev mode

## Code Conventions

- **No comments** unless absolutely necessary (user preference)
- **ESM imports** — no `require()`
- **Relative paths** — `'../contexts/AuthContext'` from components
- **Express route handlers**: `(req, res, next) => { try {...} catch(err) { next(err) } }`
- **State naming**: `setX` pattern, `useState` at top of component
- **Toast**: `import toast from 'react-hot-toast'` — use `toast.success()`, `toast.error()`
- **Icons**: from `lucide-react`, imported individually
- **Dark mode**: every `bg-white` needs `dark:bg-[#121214]`, every `bg-slate-50` needs `dark:bg-[#09090b]`, every `text-slate-900` needs `dark:text-white`
- **Dark mode colors**: cards `dark:bg-[#121214]`, page bg `dark:bg-[#09090b]`, borders `dark:border-[#262626]`

## Regras Importantes

1. **Nunca modificar planos sem autorização explícita** — os preços (Grátis R$0, Completo R$79,90) são decisão de negócio
2. **Prisma schema é single source of truth** — não existem migrations SQL manuais
3. **Windows**: `npx prisma generate` pode dar EPERM. Solução: `taskkill /F /IM node.exe` primeiro
4. **Testes**: `npm test` (Vitest) cobre regras puras — `menuValidation`, `cpf`, assinatura do webhook MP, senha/JWT. Fluxos com banco devem ser testados manualmente no `localhost:3000`/`localhost:3001`
5. **MP_LOCAL_MODE=true** no .env atual — todas as chamadas Mercado Pago são simuladas
6. **SSE timeout**: `server.timeout = 0` (infinito) para conexões SSE
7. **Sidebar**: itens filtrados por `tenantRole` + `plan`. Grátis vê 9 itens, Completo vê 17.
8. **Import paths**: de `src/components/` para `src/contexts/` = `'../contexts/...'` (1 nível acima, não 2)
9. **AnimatePresence** do framer-motion: filhos diretos precisam de `key` prop
10. **Rotas públicas**: não exigem auth — `/api/loja/*`, `/api/testimonials`, `/register`

## Common Issues & Fixes

| Issue | Fix |
|---|---|
| Prisma generate EPERM | `taskkill /F /IM node.exe` → `npx prisma generate` |
| `order.items.split is not a function` | API retorna array, não string. Usar `Array.isArray()` check |
| SSE 401 | Token deve ser passado como query param `?token=...&tenantSlug=...` |
| Admin SSE 401 | Admin não tem tenant — events.ts trata separadamente com heartbeat |
| Sidebar items overlapping footer | Usar `flex-1 overflow-y-auto` no nav, `shrink-0` no footer |
| AnimatePresence duplicate key | Adicionar `key="unique-id"` no filho direto |
| PIX column too long | `mpPixPayload` e `mpPixQrCode` são `@db.Text`, não `VarChar(500)` |
| CORS warning | Adicionar domínio extra em `ADDITIONAL_CORS_ORIGINS` no Railway |
| SPA not serving on Railway | Verificar `start:prod` script tem `vite build`, health check path = `/health` |

## Railway Deployment

Deploy fullstack no Railway: backend + frontend no mesmo serviço.

- **Domínio:** `https://menufacil.up.railway.app`
- **Build:** `vite build` (pelo script `start:prod`)
- **Start:** `npm run start:prod` → `vite build && prisma db push && tsx src/server.ts`
- **Static serving:** Express serve `dist/` + SPA fallback em produção
- **Health check path:** `/health`
- **Repositório:** `https://github.com/wallaceasantos/menufacil.git` branch `master`

### Variáveis no Railway

```
NODE_ENV=production
PORT=8080
APP_URL=https://menufacil.up.railway.app
VITE_API_URL=/api
JWT_SECRET=<obrigatório, forte>
DATABASE_URL=<interna do Railway>
MP_LOCAL_MODE=false
MP_ACCESS_TOKEN=<token de produção>
MP_WEBHOOK_SECRET=<senha do webhook>
MP_WEBHOOK_URL=https://menufacil.up.railway.app/api/mp/webhook
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

### Admin padrão
- Email: `ADMIN_EMAIL` / Senha: `ADMIN_INITIAL_PASSWORD` (variáveis de ambiente — nunca hardcodar credenciais)
- Resetar banco: Admin Dashboard → Finanças → Zona de Perigo → Resetar Banco (bloqueado em produção)

## Operação (Sprint 1)

### Migrations (importante no primeiro deploy após migrar do `db push`)
1. Banco já existente (criado com `db push`): rodar `npm run db:baseline` UMA vez (marca `0_init` como aplicada)
2. Depois disso, cada deploy usa `npm run db:migrate` (já incluso no `start:prod`)
3. Mudanças de schema em dev: `npm run db:migrate:dev -- --name nome_da_mudanca`

### Backup automático (GitHub Actions)
- Workflow: `.github/workflows/backup.yml` — roda todo dia às 05:00 UTC
- Secrets necessários no GitHub (Settings → Secrets → Actions):
  - `DATABASE_URL` — connection string do Postgres (aceita a pública do Railway)
  - `BACKUP_ENCRYPTION_KEY` — senha para criptografar o backup (guardar em local seguro!)
- Backups ficam como artifacts do workflow (retenção 30 dias), criptografados (AES-256)
- Restaurar: baixar artifact → `openssl enc -d -aes-256-cbc -pbkdf2 -in backup.sql.gz.enc -out backup.sql.gz -pass env:BACKUP_ENCRYPTION_KEY` → `gunzip` → `psql`

### Sentry (monitoramento de erros)
1. Criar projeto em https://sentry.io (free tier)
2. Copiar o DSN e configurar: `SENTRY_DSN` (backend) e `VITE_SENTRY_DSN` (frontend) no Railway
3. Sem DSN, o Sentry fica desativado (sem impacto)

### UptimeRobot (alerta de downtime)
1. Criar conta em https://uptimerobot.com (free tier, 50 monitores)
2. Monitor HTTP apontando para `https://<seu-dominio>/health`
3. Intervalo: 5 minutos; alertas por e-mail
4. O `/health` valida o banco (retorna 503 se o Postgres cair)

### Recuperação de senha
- Fluxo: Login → "Esqueci minha senha" → e-mail com link (1h de validade) → `/reset-password?token=...`
- Requer SMTP configurado (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`); sem SMTP, o link aparece apenas no log do servidor (modo dev)
