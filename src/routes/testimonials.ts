import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    // Find tenants with the most orders
    const tenants = await prisma.tenant.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        name: true,
        _count: { select: { orders: true } },
      },
      orderBy: { orders: { _count: 'desc' } },
      take: 10,
    })

    const active = tenants.filter((t) => t._count.orders >= 3)

    if (active.length === 0) {
      res.json({ testimonials: [] })
      return
    }

    const testimonials = active.map((t) => {
      const totalOrders = t._count.orders
      const saved = Math.round(totalOrders * 13)

      const templates = [
        {
          text: `Já recebemos ${totalOrders} pedidos pelo MenuFácil. Antes era tudo pelo WhatsApp e sempre perdíamos alguma coisa. Agora é tudo organizado e o cliente recebe o link de rastreio automático.`,
        },
        {
          text: `Economizamos cerca de R$ ${saved.toLocaleString('pt-BR')} em taxas de apps de delivery desde que migramos para o MenuFácil. Com 0% de taxa por pedido, o lucro aumentou muito.`,
        },
        {
          text: `O cardápio digital com QR Code trouxe uma imagem muito mais profissional para o nosso negócio. Os clientes elogiam a praticidade de pedir pelo celular.`,
        },
        {
          text: `Com o painel de pedidos e a impressão automática, minha equipe trabalha muito mais rápido. O pedido chega, já aparece no sistema e a cozinha recebe na hora.`,
        },
      ]

      const template = templates[Math.floor(Math.random() * templates.length)]

      return {
        id: t.id,
        name: t.name.split(' ').slice(0, 2).join(' '),
        business: t.name,
        photo: null,
        avatar: t.name.charAt(0).toUpperCase(),
        text: template.text,
        stats: { orders: totalOrders, rating: null as number | null },
      }
    })

    // Also fetch platform reviews (tenants who rated the SaaS)
    const platformReviews = await prisma.tenant.findMany({
      where: { platformRating: { not: null }, status: 'active' },
      select: {
        id: true, name: true, platformRating: true, platformComment: true,
        _count: { select: { orders: true } },
      },
      orderBy: { platformRating: 'desc' },
      take: 3,
    })

    const extras = platformReviews
      .filter((t) => !testimonials.some((tt) => tt.id === t.id))
      .map((t) => ({
        id: t.id + '-review',
        name: t.name.split(' ').slice(0, 2).join(' '),
        business: t.name,
        photo: null,
        avatar: t.name.charAt(0).toUpperCase(),
        text: t.platformComment || `O MenuFácil tem sido essencial para o meu negócio. Recomendo!`,
        stats: { orders: t._count.orders, rating: t.platformRating || null },
        isPlatformReview: true,
      }))

    const combined = [...testimonials.slice(0, 4), ...extras].slice(0, 6)
    res.json({ testimonials: combined })
  } catch (err) {
    console.error('[Testimonials] Error:', err)
    res.json({ testimonials: [] })
  }
})

export default router
