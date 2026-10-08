import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'
import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import * as Sentry from '@sentry/node'
import routes from './routes'
import { prisma } from './lib/prisma'
import { errorHandler } from './middleware/errorHandler'
import { billingCron } from './jobs/billing'
import { logger } from './lib/logger'
import { resolveTenantByDomain } from './middleware/domain'
import { RedisRateLimitStore } from './lib/rateLimitStore'

dotenv.config()

const SENTRY_DSN = process.env.SENTRY_DSN || ''
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  })
}

const app = express()
app.set('trust proxy', 1)

const PORT = process.env.PORT || 3001

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://api.qrserver.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:", "https://images.unsplash.com"],
      connectSrc: ["'self'", "ws:", "wss:", "https://api.mercadopago.com", "https://api.qrserver.com", "https://images.unsplash.com", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", "https://*.mercadopago.com", "https://*.mercadolibre.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}))

app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self), payment=(self)')
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')
  next()
})

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
      console.warn(`[CORS] Origem bloqueada (não listada em APP_URL/ADDITIONAL_CORS_ORIGINS): ${origin}`)
      callback(new Error('Origem não permitida'))
    }
  },
  credentials: true,
}))

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  store: new RedisRateLimitStore('rl:auth:'),
  message: { error: 'Muitas tentativas. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  store: new RedisRateLimitStore('rl:login:'),
  skipSuccessfulRequests: true,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  store: new RedisRateLimitStore('rl:register:'),
  message: { error: 'Muitos cadastros. Tente novamente em 1 hora.' },
  standardHeaders: true,
  legacyHeaders: false,
})

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 200,
  store: new RedisRateLimitStore('rl:general:'),
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
app.use('/api/auth/login', loginLimiter)
app.use('/api/auth/register', registerLimiter)
app.use('/api/auth', authLimiter)

// General rate limit for API
app.use('/api', generalLimiter)

app.use('/api', routes)

app.get('/health', async (_req, res) => {
  const startedAt = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'ok',
      database: 'ok',
      dbLatencyMs: Date.now() - startedAt,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  } catch {
    res.status(503).json({
      status: 'degraded',
      database: 'error',
      dbLatencyMs: Date.now() - startedAt,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    })
  }
})

// Serve React SPA in production
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(__dirname, '..', 'dist')

if (
  process.env.NODE_ENV === 'production' ||
  process.env.SERVE_STATIC === 'true' ||
  fs.existsSync(path.join(distPath, 'index.html'))
) {
  app.use(express.static(distPath))
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    const indexPath = path.join(distPath, 'index.html')
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error(`[Static] Failed to send ${indexPath}:`, err.message)
        res.status(500).json({ error: 'App not built. Run vite build first.' })
      }
    })
  })
  console.log(`📦 Serving static files from ${distPath}`)
}

if (SENTRY_DSN) {
  app.use(Sentry.expressErrorHandler())
}

app.use(errorHandler)

const LOCAL_MODE = process.env.MP_LOCAL_MODE === 'true'
const BILLING_IN_WORKER = process.env.BILLING_IN_WORKER === 'true'

if (!BILLING_IN_WORKER) {
  setInterval(billingCron, 60 * 60 * 1000)
  setTimeout(billingCron, 60 * 1000)
  logger.info('[Billing] Cron de cobrança ativo no servidor (defina BILLING_IN_WORKER=true para rodar no worker)')
}

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
