import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

router.post('/subscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    const user = (req as any).user
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const { endpoint, keys } = req.body
    if (!endpoint || !keys?.auth || !keys?.p256dh) {
      res.status(400).json({ error: 'Dados de subscription inválidos' })
      return
    }

    const existing = await prisma.pushSubscription.findUnique({ where: { endpoint } })
    if (existing) {
      await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: { auth: keys.auth, p256dh: keys.p256dh, userId: user?.id || null, tenantId: tenant.id },
      })
    } else {
      await prisma.pushSubscription.create({
        data: {
          tenantId: tenant.id,
          endpoint,
          auth: keys.auth,
          p256dh: keys.p256dh,
          userId: user?.id || null,
          deviceInfo: req.headers['user-agent']?.slice(0, 200) || null,
        },
      })
    }

    res.json({ subscribed: true })
  } catch (err) { next(err) }
})

router.post('/unsubscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const { endpoint } = req.body
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint, tenantId: tenant.id } })
    }

    res.json({ subscribed: false })
  } catch (err) { next(err) }
})

router.get('/vapid-key', async (_req: Request, res: Response) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' })
})

export default router
