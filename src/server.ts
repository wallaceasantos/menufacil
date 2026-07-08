import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import routes from './routes'
import { prisma } from './lib/prisma'
import { errorHandler } from './middleware/errorHandler'
import { logPlanChange } from './lib/planLog'
import { resolveTenantByDomain } from './middleware/domain'

dotenv.config()

const app = express()
app.set('trust proxy', 1)

const PORT = process.env.PORT || 3001

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://api.qrserver.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://images.unsplash.com"],
      connectSrc: ["'self'", "ws:", "wss:", "https://api.mercadopago.com", "https://api.qrserver.com", "https://images.unsplash.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://*.mercadopago.com", "https://*.mercadolibre.com"],
    },
  },
  crossOriginEmbedderPolicy: false,
}))

// CORS — reflete a origem da requisição. Frontend e backend rodam no mesmo domínio,
// então requisições sem origin (same-origin) e requisições da própria URL são permitidas.
// Para restringir origens, configure APP_URL e ADDITIONAL_CORS_ORIGINS.
const allowedOrigins = new Set(
  [process.env.APP_URL, ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || [])]
    .map((o) => o?.replace(/\/$/, ''))
    .filter((o): o is string => Boolean(o))
)

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true)
      return
    }
    const normalized = origin.replace(/\/$/, '')
    if (allowedOrigins.size === 0 || allowedOrigins.has(normalized)) {
      callback(null, origin)
    } else {
      console.warn(`[CORS] Origem não listada em APP_URL/ADDITIONAL_CORS_ORIGINS: ${origin}`)
      callback(null, origin)
    }
  },
  credentials: true,
}))

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use((req, res, next) => {
  if (req.path === '/api/mp/webhook') {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 50000) { res.status(413).end(); return }
    })
    req.on('end', () => {
      try {
        (req as any).rawBody = data
        req.body = JSON.parse(data)
      } catch {
        req.body = {}
      }
      next()
    })
  } else {
    express.json({ limit: '1mb' })(req, res, next)
  }
})

app.use(resolveTenantByDomain)

app.get('/api/domain-check', async (req, res) => {
  const token = req.query.token as string
  if (!token) { res.status(400).json({ error: 'Token required' }); return }
  try {
    const tenant = await prisma.tenant.findFirst({ where: { domainToken: token } })
    if (tenant) {
      res.json({ verified: true, tenant: tenant.slug })
    } else {
      res.status(404).json({ error: 'Token not found' })
    }
  } catch { res.status(500).json({ error: 'Server error' }) }
})

// Rate limit auth endpoints
app.use('/api/auth', authLimiter)

// General rate limit for API
app.use('/api', generalLimiter)

app.use('/api', routes)

app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'MenuFácil API', timestamp: new Date().toISOString() })
})

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Serve React SPA in production
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '..', 'dist')

if (process.env.NODE_ENV === 'production' || process.env.SERVE_STATIC === 'true') {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
  console.log(`📦 Serving static files from ${distPath}`)
}

app.use(errorHandler)

const LOCAL_MODE = process.env.MP_LOCAL_MODE === 'true'

async function billingCron() {
  try {
    const now = new Date()
    const todayStr = now.toISOString().split('T')[0]

    // 1. Check authorized subscriptions past due for billing
    const toBill = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'authorized',
        nextBillingDate: { lte: new Date(todayStr) },
        plan: 'completo',
      },
    })

    for (const tenant of toBill) {
      if (LOCAL_MODE) {
        // Simulate monthly charge
        const nextBilling = new Date()
        nextBilling.setDate(nextBilling.getDate() + 30)

        await prisma.tenant.update({
          where: { id: tenant.id },
          data: {
            paymentStatus: 'paid',
            overdueDays: 0,
            lastBillingDate: new Date(),
            nextBillingDate: nextBilling,
          },
        })
        console.log(`[Billing Cron] Local charge OK for tenant ${tenant.id} - next billing ${nextBilling.toISOString().split('T')[0]}`)
      } else {
        // In production, MP handles the charge via webhook
        // Just mark as processing
        console.log(`[Billing Cron] Tenant ${tenant.id} awaiting MP charge`)
      }
    }

    // 2. Check tenants that missed payment (always runs)
    const overdueThreshold = new Date()
    overdueThreshold.setDate(overdueThreshold.getDate() - 31)

    const missed = await prisma.tenant.findMany({
      where: {
        subscriptionStatus: 'authorized',
        paymentStatus: 'paid',
        lastBillingDate: { lte: overdueThreshold },
        plan: 'completo',
      },
    })

    for (const tenant of missed) {
      const daysSinceLastBilling = tenant.lastBillingDate
        ? Math.floor((now.getTime() - new Date(tenant.lastBillingDate).getTime()) / (1000 * 60 * 60 * 24)) - 30
        : 1

      const actualOverdue = Math.max(1, daysSinceLastBilling)
      const updateData: any = { overdueDays: actualOverdue }

      if (actualOverdue >= 30) {
        updateData.plan = 'basico'
        updateData.subscriptionStatus = 'cancelled'
        updateData.cardLastFour = null
        updateData.nextBillingDate = null
        updateData.paymentStatus = 'overdue'

        await logPlanChange({
          tenantId: tenant.id,
          oldPlan: tenant.plan,
          newPlan: 'basico',
          source: 'downgrade',
          changedBy: 'system',
        })
        console.log(`[Billing Cron] Tenant ${tenant.id} downgraded to BASICO after ${actualOverdue} days overdue`)
      } else {
        if (actualOverdue >= 3 && tenant.paymentStatus !== 'overdue') {
          updateData.paymentStatus = 'overdue'
          }
          console.log(`[Billing Cron] Tenant ${tenant.id} overdue day ${actualOverdue}`)
        }

        await prisma.tenant.update({ where: { id: tenant.id }, data: updateData })
    }
  } catch (err) {
    console.error('[Billing Cron] Error:', err)
  }
}

// Run billing check every hour
setInterval(billingCron, 60 * 60 * 1000)
// Run first check after 1 minute
setTimeout(billingCron, 60 * 1000)

const server = http.createServer(app)
server.timeout = 0
server.keepAliveTimeout = 65000
server.headersTimeout = 66000

server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em http://localhost:${PORT}`)
  console.log(`🔄 Billing cron ${LOCAL_MODE ? '(modo local)' : '(produção)'} ativado`)
  console.log(`📡 SSE habilitado em /api/events/stream`)
})

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n🛑 Recebido ${signal}. Encerrando servidor...`)
  server.close(async () => {
    console.log('🔌 Conexões HTTP fechadas')
    await prisma.$disconnect()
    console.log('💾 Prisma desconectado')
    process.exit(0)
  })
  // Force exit after 10s
  setTimeout(() => { console.log('⏰ Timeout — forçando saída'); process.exit(1) }, 10000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// Remove the eventBus push listener code block
