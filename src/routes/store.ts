import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import crypto from 'crypto'

function formatTime(date: Date | null | undefined): string | null {
  if (!date) return null
  return date.toISOString().slice(11, 16)
}

function parseTimeInput(value: string | null | undefined): Date | undefined {
  if (!value) return undefined
  const match = String(value).match(/(\d{2}):(\d{2})/)
  if (!match) return undefined
  return new Date(`1970-01-01T${match[1]}:${match[2]}:00Z`)
}

const router = Router()

router.use(authenticate)
router.use(extractTenant)

router.get('/', async (req, res, next) => {
  try {
    const tenant = req.tenant!

    res.json({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      description: tenant.description,
      address: tenant.address,
      phone: tenant.phone,
      deliveryFee: tenant.deliveryFee,
      minOrder: tenant.minOrder,
      openingHours: formatTime(tenant.openingHours),
      closingHours: formatTime(tenant.closingHours),
      logoUrl: tenant.logoUrl,
      bannerUrl: tenant.bannerUrl,
      customDomain: tenant.customDomain,
      domainVerified: tenant.domainVerified,
      domainToken: tenant.domainToken,
      ownerCpfCnpj: tenant.ownerCpfCnpj,
      ownerFirstName: tenant.ownerFirstName,
      ownerLastName: tenant.ownerLastName,
      billingEmail: tenant.billingEmail,
      billingPhone: tenant.billingPhone,
      billingPostalCode: tenant.billingPostalCode,
      billingAddressNumber: tenant.billingAddressNumber,
    })
  } catch (err) {
    next(err)
  }
})

router.put('/', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const {
      name,
      description,
      address,
      phone,
      deliveryFee,
      minOrder,
      openingHours,
      closingHours,
      logoUrl,
      bannerUrl,
      customDomain,
      ownerCpfCnpj,
      ownerFirstName,
      ownerLastName,
      billingEmail,
      billingPhone,
      billingPostalCode,
      billingAddressNumber,
    } = req.body

    const updated = await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name,
        description,
        address,
        phone,
        deliveryFee,
        minOrder,
        openingHours: parseTimeInput(openingHours),
        closingHours: parseTimeInput(closingHours),
        logoUrl,
        bannerUrl,
        customDomain,
        ownerCpfCnpj,
        ownerFirstName,
        ownerLastName,
        billingEmail,
        billingPhone,
        billingPostalCode,
        billingAddressNumber,
      },
    })

    res.json(updated)
  } catch (err) {
    next(err)
  }
})

router.post('/domain/verify', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { domain } = req.body

    if (!domain || !domain.includes('.')) {
      res.status(400).json({ error: 'Domínio inválido' })
      return
    }

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase()

    const existing = await prisma.tenant.findFirst({
      where: { customDomain: cleanDomain, id: { not: tenant.id } },
    })
    if (existing) {
      res.status(400).json({ error: 'Este domínio já está em uso por outra loja' })
      return
    }

    const token = crypto.randomBytes(16).toString('hex')

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { customDomain: cleanDomain, domainToken: token, domainVerified: false },
    })

    res.json({
      domain: cleanDomain,
      token,
      verified: false,
      dnsRecord: { type: 'CNAME', name: cleanDomain, value: process.env.MP_WEBHOOK_URL?.replace('https://', '') || 'seu-dominio.ngrok-free.dev' },
      instructions: `Adicione o seguinte registro DNS no seu provedor de domínio:\n\nTipo: CNAME\nNome: ${cleanDomain}\nValor: ${process.env.MP_WEBHOOK_URL?.replace('https://', '') || 'seu-dominio.ngrok-free.dev'}\n\nApós configurar, clique em "Verificar".`,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/domain/status', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    res.json({
      domain: tenant.customDomain || null,
      verified: tenant.domainVerified || false,
      token: tenant.domainToken || null,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/domain/check', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    if (!tenant.customDomain || !tenant.domainToken) {
      res.status(400).json({ error: 'Nenhum domínio configurado para verificar' })
      return
    }

    const domainUrl = `http://${tenant.customDomain}/api/domain-check?token=${tenant.domainToken}`

    let verified = false
    try {
      const response = await fetch(domainUrl, { method: 'GET', signal: AbortSignal.timeout(5000) })
      if (response.ok) verified = true
    } catch {}

    if (verified) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { domainVerified: true },
      })
      res.json({ verified: true, message: 'Domínio verificado com sucesso!' })
    } else {
      res.json({
        verified: false,
        message: 'Não foi possível verificar o domínio. Certifique-se de que o registro DNS foi configurado corretamente e aguardou a propagação (pode levar até 24h).',
      })
    }
  } catch (err) {
    next(err)
  }
})

router.delete('/domain', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { customDomain: null, domainToken: null, domainVerified: false },
    })
    res.json({ message: 'Domínio removido' })
  } catch (err) {
    next(err)
  }
})

router.get('/review', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    res.json({
      rating: tenant.platformRating || null,
      comment: tenant.platformComment || null,
      name: tenant.name,
    })
  } catch (err) { next(err) }
})

router.post('/review', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    if (tenant.platformRating) {
      res.status(400).json({ error: 'Você já enviou sua avaliação. Obrigado!' })
      return
    }

    const { rating, comment } = req.body
    if (!rating || rating < 1 || rating > 5) {
      res.status(400).json({ error: 'Avaliação de 1 a 5 é obrigatória' })
      return
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { platformRating: Number(rating), platformComment: comment || null },
    })

    res.json({ message: 'Avaliação enviada! Obrigado pelo feedback.', rating: Number(rating) })
  } catch (err) { next(err) }
})

export default router
