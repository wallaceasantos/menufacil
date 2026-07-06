import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

function toNumber(value: any): number {
  return value === null || value === undefined ? 0 : Number(value)
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }
    const discounts = await prisma.discount.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ discounts })
  } catch (err) { next(err) }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const { code, discountType, value, minOrderAmount, maxUses, startsAt, expiresAt, isActive, appliesTo, appliesToIds } = req.body

    if (!code || !code.trim()) { res.status(400).json({ error: 'Código do cupom é obrigatório' }); return }
    if (!value || toNumber(value) <= 0) { res.status(400).json({ error: 'Valor do desconto inválido' }); return }

    const cleanCode = code.trim().toUpperCase().replace(/\s/g, '')
    const existing = await prisma.discount.findFirst({ where: { tenantId: tenant.id, code: cleanCode } })
    if (existing) { res.status(400).json({ error: 'Já existe um cupom com este código' }); return }

    const discount = await prisma.discount.create({
      data: {
        tenantId: tenant.id,
        code: cleanCode,
        discountType: discountType || 'percentage',
        value: toNumber(value),
        minOrderAmount: minOrderAmount ? toNumber(minOrderAmount) : 0,
        maxUses: maxUses || null,
        startsAt: startsAt ? new Date(startsAt) : new Date(),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== false,
        appliesTo: appliesTo || 'all',
        appliesToIds: appliesToIds || null,
      },
    })
    res.json(discount)
  } catch (err) { next(err) }
})

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }
    const { id } = req.params
    const existing = await prisma.discount.findFirst({ where: { id, tenantId: tenant.id } })
    if (!existing) { res.status(404).json({ error: 'Cupom não encontrado' }); return }

    const { code, discountType, value, minOrderAmount, maxUses, startsAt, expiresAt, isActive, appliesTo, appliesToIds } = req.body
    const data: any = {}
    if (code !== undefined) { const clean = code.trim().toUpperCase().replace(/\s/g, ''); data.code = clean }
    if (discountType !== undefined) data.discountType = discountType
    if (value !== undefined) data.value = toNumber(value)
    if (minOrderAmount !== undefined) data.minOrderAmount = toNumber(minOrderAmount)
    if (maxUses !== undefined) data.maxUses = maxUses
    if (startsAt !== undefined) data.startsAt = new Date(startsAt)
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null
    if (isActive !== undefined) data.isActive = isActive
    if (appliesTo !== undefined) data.appliesTo = appliesTo
    if (appliesToIds !== undefined) data.appliesToIds = appliesToIds

    const discount = await prisma.discount.update({ where: { id }, data })
    res.json(discount)
  } catch (err) { next(err) }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }
    const { id } = req.params
    const existing = await prisma.discount.findFirst({ where: { id, tenantId: tenant.id } })
    if (!existing) { res.status(404).json({ error: 'Cupom não encontrado' }); return }
    await prisma.discount.delete({ where: { id } })
    res.json({ message: 'Cupom removido' })
  } catch (err) { next(err) }
})

export async function validateDiscount(tenantId: string, code: string, orderTotal: number): Promise<{
  valid: boolean
  discount?: any
  error?: string
  finalAmount?: number
  discountAmount?: number
}> {
  const cleanCode = code.trim().toUpperCase().replace(/\s/g, '')
  const discount = await prisma.discount.findFirst({
    where: { tenantId, code: cleanCode, isActive: true },
  })

  if (!discount) return { valid: false, error: 'Cupom inválido ou expirado' }

  const now = new Date()
  if (discount.startsAt && new Date(discount.startsAt) > now) return { valid: false, error: 'Cupom ainda não está ativo' }
  if (discount.expiresAt && new Date(discount.expiresAt) < now) return { valid: false, error: 'Cupom expirado' }
  if (discount.maxUses && discount.usedCount >= discount.maxUses) return { valid: false, error: 'Cupom esgotado' }

  const minOrder = toNumber(discount.minOrderAmount)
  if (orderTotal < minOrder) return { valid: false, error: `Pedido mínimo de R$ ${minOrder.toFixed(2).replace('.', ',')} para este cupom` }

  let discountAmount = 0
  if (discount.discountType === 'percentage') {
    discountAmount = orderTotal * (toNumber(discount.value) / 100)
  } else {
    discountAmount = Math.min(toNumber(discount.value), orderTotal)
  }

  return {
    valid: true,
    discount,
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalAmount: Math.max(0, orderTotal - discountAmount),
  }
}

export { router }
export default router
