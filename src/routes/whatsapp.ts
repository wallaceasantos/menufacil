import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

function maskApiKey(key: string): string {
  if (key.length <= 8) return '****'
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

router.get('/config', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const config = await prisma.whatsAppConfig.findUnique({
      where: { tenantId: tenant.id },
    })

    if (!config) {
      res.json({
        apiUrl: '',
        apiKey: '',
        instanceName: 'menufacil',
        connected: false,
        notifyReceived: true,
        notifyPreparing: true,
        notifyCompleted: true,
        notifyCancelled: true,
        defaultMessage: 'Olá {cliente}! Seu pedido #{pedido} foi atualizado para: {status}.',
      })
      return
    }

    res.json({
      apiUrl: config.apiUrl || '',
      apiKey: config.apiKey ? maskApiKey(config.apiKey) : '',
      instanceName: config.instanceName || 'menufacil',
      connected: config.connected ?? false,
      notifyReceived: config.notifyReceived ?? true,
      notifyPreparing: config.notifyPreparing ?? true,
      notifyCompleted: config.notifyCompleted ?? true,
      notifyCancelled: config.notifyCancelled ?? true,
      defaultMessage: config.defaultMessage || 'Olá {cliente}! Seu pedido #{pedido} foi atualizado para: {status}.',
    })
  } catch (err) {
    next(err)
  }
})

router.put('/config', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const {
      apiUrl,
      apiKey,
      instanceName,
      connected,
      notifyReceived,
      notifyPreparing,
      notifyCompleted,
      notifyCancelled,
      defaultMessage,
    } = req.body

    const existing = await prisma.whatsAppConfig.findUnique({
      where: { tenantId: tenant.id },
    })

    const data: any = {
      apiUrl: apiUrl || null,
      instanceName: instanceName || 'menufacil',
      connected: connected ?? false,
      notifyReceived: notifyReceived ?? true,
      notifyPreparing: notifyPreparing ?? true,
      notifyCompleted: notifyCompleted ?? true,
      notifyCancelled: notifyCancelled ?? true,
      defaultMessage: defaultMessage || 'Olá {cliente}! Seu pedido #{pedido} foi atualizado para: {status}.',
    }

    // Só atualiza a API key se não for a máscara de segurança
    if (apiKey && !apiKey.includes('****')) {
      data.apiKey = apiKey
    }

    const config = await prisma.whatsAppConfig.upsert({
      where: { tenantId: tenant.id },
      update: data,
      create: {
        tenantId: tenant.id,
        ...data,
        apiKey: apiKey || null,
      },
    })

    res.json({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey ? maskApiKey(config.apiKey) : '',
      instanceName: config.instanceName,
      connected: config.connected,
      notifyReceived: config.notifyReceived,
      notifyPreparing: config.notifyPreparing,
      notifyCompleted: config.notifyCompleted,
      notifyCancelled: config.notifyCancelled,
      defaultMessage: config.defaultMessage,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/test', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { phone } = req.body

    const config = await prisma.whatsAppConfig.findUnique({
      where: { tenantId: tenant.id },
    })

    if (!config || !config.apiUrl || !config.apiKey || !config.instanceName) {
      res.status(400).json({ error: 'WhatsApp não configurado' })
      return
    }

    if (!config.connected) {
      res.status(400).json({ error: 'WhatsApp não conectado' })
      return
    }

    const message = 'Teste de integração WhatsApp do Menu Fácil. Se você recebeu esta mensagem, a configuração está funcionando!'

    try {
      const response = await fetch(`${config.apiUrl}/message/sendText/${config.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey,
        },
        body: JSON.stringify({
          number: phone,
          text: message,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        res.status(502).json({ error: 'Erro ao enviar mensagem', details: errorData })
        return
      }

      res.json({ success: true })
    } catch (fetchErr) {
      res.status(502).json({ error: 'Não foi possível conectar à API do WhatsApp' })
    }
  } catch (err) {
    next(err)
  }
})

export default router
