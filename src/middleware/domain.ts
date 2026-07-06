import { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

export async function resolveTenantByDomain(req: Request, res: Response, next: NextFunction) {
  const host = req.get('host') || ''
  const cleanHost = host.split(':')[0].toLowerCase()

  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    return next()
  }

  try {
    const tenant = await prisma.tenant.findFirst({
      where: { customDomain: cleanHost, domainVerified: true },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        deliveryFee: true,
        minOrder: true,
        openingHours: true,
        closingHours: true,
        logoUrl: true,
        bannerUrl: true,
        latitude: true,
        longitude: true,
        plan: true,
      },
    })

    if (tenant) {
      ;(req as any).customDomainTenant = tenant
      ;(req as any).tenantSlug = tenant.slug
    }

    next()
  } catch {
    next()
  }
}
