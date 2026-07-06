import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'

export async function extractTenant(req: Request, res: Response, next: NextFunction) {
  try {
    const slug = req.headers['x-tenant-slug'] as string | undefined

    let tenant = null

    // Prioridade 1: slug informado no header
    if (slug) {
      tenant = await prisma.tenant.findUnique({ where: { slug } })
    }

    // Prioridade 2: tenantId do token JWT (fallback quando slug não existe ou não foi informado)
    if (!tenant && req.user?.tenantId) {
      tenant = await prisma.tenant.findUnique({ where: { id: req.user.tenantId } })
    }

    if (!tenant) {
      if (req.user?.role === 'admin') {
        req.tenant = null as any
        next()
        return
      }
      res.status(404).json({ error: 'Tenant não encontrado' })
      return
    }

    req.tenant = tenant
    next()
  } catch (err) {
    next(err)
  }
}
