import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

router.get('/config', async (req, res, next) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Tenant não encontrado' })
      return
    }
    const config = await prisma.paymentConfig.findUnique({
      where: { tenantId: tenant.id },
    })

    if (!config) {
      res.json({
        pixKey: '',
        pixKeyType: 'cpf',
        pixBeneficiary: '',
        pixBank: '',
        pixEnabled: false,
        cashEnabled: true,
        cardEnabled: true,
        pixOnDelivery: false,
        pixQrCodeImage: null,
        instructions: 'Envie o comprovante pelo WhatsApp após o pagamento.',
      })
      return
    }

    res.json({
      pixKey: config.pixKey || '',
      pixKeyType: config.pixKeyType || 'cpf',
      pixBeneficiary: config.pixBeneficiary || '',
      pixBank: config.pixBank || '',
      pixEnabled: config.pixEnabled ?? false,
      cashEnabled: config.cashEnabled ?? true,
      cardEnabled: config.cardEnabled ?? true,
      pixOnDelivery: config.pixOnDelivery ?? false,
      pixQrCodeImage: config.pixQrCodeImage || null,
      instructions: config.instructions || 'Envie o comprovante pelo WhatsApp após o pagamento.',
    })
  } catch (err) {
    next(err)
  }
})

router.put('/config', async (req, res, next) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Tenant não encontrado' })
      return
    }
    const {
      pixKey,
      pixKeyType,
      pixBeneficiary,
      pixBank,
      pixEnabled,
      cashEnabled,
      cardEnabled,
      pixOnDelivery,
      pixQrCodeImage,
      instructions,
    } = req.body

    if (pixEnabled && !pixKey?.trim() && !pixQrCodeImage?.trim()) {
      res.status(400).json({ error: 'Informe a chave PIX ou envie uma imagem do QR Code' })
      return
    }

    const config = await prisma.paymentConfig.upsert({
      where: { tenantId: tenant.id },
      update: {
        pixKey: pixKey?.trim() || null,
        pixKeyType: pixKeyType || 'cpf',
        pixBeneficiary: pixBeneficiary?.trim() || null,
        pixBank: pixBank?.trim() || null,
        pixEnabled: pixEnabled ?? false,
        cashEnabled: cashEnabled ?? true,
        cardEnabled: cardEnabled ?? true,
        pixOnDelivery: pixOnDelivery ?? false,
        pixQrCodeImage: pixQrCodeImage?.trim() || null,
        instructions: instructions?.trim() || null,
      },
      create: {
        tenantId: tenant.id,
        pixKey: pixKey?.trim() || null,
        pixKeyType: pixKeyType || 'cpf',
        pixBeneficiary: pixBeneficiary?.trim() || null,
        pixBank: pixBank?.trim() || null,
        pixEnabled: pixEnabled ?? false,
        cashEnabled: cashEnabled ?? true,
        cardEnabled: cardEnabled ?? true,
        pixOnDelivery: pixOnDelivery ?? false,
        pixQrCodeImage: pixQrCodeImage?.trim() || null,
        instructions: instructions?.trim() || null,
      },
    })

    res.json({
      pixKey: config.pixKey,
      pixKeyType: config.pixKeyType,
      pixBeneficiary: config.pixBeneficiary,
      pixBank: config.pixBank,
      pixEnabled: config.pixEnabled,
      cashEnabled: config.cashEnabled,
      cardEnabled: config.cardEnabled,
      pixOnDelivery: config.pixOnDelivery,
      pixQrCodeImage: config.pixQrCodeImage,
      instructions: config.instructions,
    })
  } catch (err) {
    next(err)
  }
})

export default router
