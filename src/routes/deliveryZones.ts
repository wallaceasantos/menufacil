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
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const zones = await prisma.deliveryZone.findMany({
      where: { tenantId: tenant.id },
      orderBy: [{ priority: 'desc' }, { name: 'asc' }],
    })

    res.json({ zones })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { name, zoneType, fee, estimatedTime, minOrder, radiusKm, cepList, neighborhoodList, priority, isActive } = req.body

    if (!name) {
      res.status(400).json({ error: 'Nome da área é obrigatório' })
      return
    }

    const zone = await prisma.deliveryZone.create({
      data: {
        tenantId: tenant.id,
        name,
        zoneType: zoneType || 'radius',
        fee: toNumber(fee),
        estimatedTime: estimatedTime || 60,
        minOrder: minOrder != null ? toNumber(minOrder) : null,
        radiusKm: radiusKm != null ? toNumber(radiusKm) : null,
        cepList: cepList || null,
        neighborhoodList: neighborhoodList || null,
        priority: priority || 0,
        isActive: isActive !== false,
      },
    })

    res.json(zone)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { id } = req.params
    const existing = await prisma.deliveryZone.findFirst({
      where: { id, tenantId: tenant.id },
    })
    if (!existing) {
      res.status(404).json({ error: 'Área não encontrada' })
      return
    }

    const { name, zoneType, fee, estimatedTime, minOrder, radiusKm, cepList, neighborhoodList, priority, isActive } = req.body

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (zoneType !== undefined) updateData.zoneType = zoneType
    if (fee !== undefined) updateData.fee = toNumber(fee)
    if (estimatedTime !== undefined) updateData.estimatedTime = estimatedTime
    if (minOrder !== undefined) updateData.minOrder = minOrder == null ? null : toNumber(minOrder)
    if (radiusKm !== undefined) updateData.radiusKm = radiusKm == null ? null : toNumber(radiusKm)
    if (cepList !== undefined) updateData.cepList = cepList
    if (neighborhoodList !== undefined) updateData.neighborhoodList = neighborhoodList
    if (priority !== undefined) updateData.priority = priority
    if (isActive !== undefined) updateData.isActive = isActive

    const zone = await prisma.deliveryZone.update({
      where: { id },
      data: updateData,
    })

    res.json(zone)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { id } = req.params
    const existing = await prisma.deliveryZone.findFirst({
      where: { id, tenantId: tenant.id },
    })
    if (!existing) {
      res.status(404).json({ error: 'Área não encontrada' })
      return
    }

    await prisma.deliveryZone.delete({ where: { id } })
    res.json({ message: 'Área removida com sucesso' })
  } catch (err) {
    next(err)
  }
})

router.post('/reorder', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { orders } = req.body
    if (!Array.isArray(orders)) {
      res.status(400).json({ error: 'orders deve ser um array' })
      return
    }

    await Promise.all(
      orders.map((o: { id: string; priority: number }) =>
        prisma.deliveryZone.updateMany({
          where: { id: o.id, tenantId: tenant.id },
          data: { priority: o.priority },
        })
      )
    )

    res.json({ message: 'Ordem atualizada' })
  } catch (err) {
    next(err)
  }
})

export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function findDeliveryZone(
  zones: any[],
  tenant: { latitude: any; longitude: any },
  address: string,
  cep: string
): any | null {
  const cleanCep = (cep || '').replace(/\D/g, '')

  for (const zone of zones) {
    if (!zone.isActive) continue

    if (zone.zoneType === 'cep' && cleanCep) {
      const cepList = (zone.cepList || '').split(',').map((c: string) => c.replace(/\D/g, '').trim()).filter(Boolean)
      if (cepList.includes(cleanCep)) return zone
    }

    if (zone.zoneType === 'neighborhood' && address) {
      const neighborhoods = (zone.neighborhoodList || '').split(',').map((n: string) => n.trim().toLowerCase()).filter(Boolean)
      const addressLower = address.toLowerCase()
      if (neighborhoods.some((n: string) => addressLower.includes(n))) return zone
    }

    if (zone.zoneType === 'radius' && zone.radiusKm && tenant.latitude && tenant.longitude) {
      const match = address?.match(/(-?\d+[\.,]?\d*)\s*,\s*(-?\d+[\.,]?\d*)/)
      if (match) {
        const lat = parseFloat(match[1].replace(',', '.'))
        const lng = parseFloat(match[2].replace(',', '.'))
        const distance = calculateDistanceKm(
          toNumber(tenant.latitude),
          toNumber(tenant.longitude),
          lat,
          lng
        )
        if (distance <= toNumber(zone.radiusKm)) return zone
      }
    }
  }

  return null
}

export async function calculateDeliveryFee(
  tenantId: string,
  address: string,
  cep: string
): Promise<{ fee: number; zone: any | null; estimatedTime: number }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) return { fee: 0, zone: null, estimatedTime: 60 }

  const zones = await prisma.deliveryZone.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  })

  const matchedZone = findDeliveryZone(zones, tenant, address, cep)

  if (matchedZone) {
    return {
      fee: toNumber(matchedZone.fee),
      zone: {
        id: matchedZone.id,
        name: matchedZone.name,
        estimatedTime: matchedZone.estimatedTime,
        minOrder: matchedZone.minOrder ? toNumber(matchedZone.minOrder) : null,
      },
      estimatedTime: matchedZone.estimatedTime,
    }
  }

  return {
    fee: toNumber(tenant.deliveryFee),
    zone: null,
    estimatedTime: 60,
  }
}

export default router
