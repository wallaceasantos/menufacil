import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { generateSlug } from '../data/tenantStorage'

const router = Router()

router.get('/', async (_req, res, next) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        plan: true,
        status: true,
        description: true,
        address: true,
        phone: true,
      },
    })
    res.json(tenants)
  } catch (err) {
    next(err)
  }
})

router.get('/:slug', async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { slug: req.params.slug },
      include: {
        categories: {
          include: {
            products: {
              where: { isActive: true },
            },
          },
        },
      },
    })

    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    res.json(tenant)
  } catch (err) {
    next(err)
  }
})

router.post('/', authenticate, async (req, res, next) => {
  try {
    const {
      slug,
      name,
      type,
      email,
      plan = 'basico',
      description,
      address,
      phone,
      deliveryFee,
      minOrder,
      openingHours,
      closingHours,
      logoUrl,
      bannerUrl,
    } = req.body

    if (!name || !type || !email) {
      res.status(400).json({ error: 'Nome, tipo e email são obrigatórios' })
      return
    }

    const finalSlug = slug || generateSlug(name)

    const existing = await prisma.tenant.findUnique({ where: { slug: finalSlug } })
    if (existing) {
      res.status(409).json({ error: 'Slug já existe' })
      return
    }

    const tenant = await prisma.tenant.create({
      data: {
        slug: finalSlug,
        name,
        type,
        email,
        plan,
        description,
        address,
        phone,
        deliveryFee,
        minOrder,
        openingHours,
        closingHours,
        logoUrl,
        bannerUrl,
      },
    })

    res.status(201).json(tenant)
  } catch (err) {
    next(err)
  }
})

router.put('/:slug', authenticate, async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.update({
      where: { slug: req.params.slug },
      data: req.body,
    })

    res.json(tenant)
  } catch (err) {
    next(err)
  }
})

export default router
