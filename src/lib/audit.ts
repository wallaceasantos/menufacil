import type { Request } from 'express'
import { prisma } from './prisma'
import { logger, errorMeta } from './logger'

export interface AuditEntry {
  userId?: string | null
  tenantId?: string | null
  actorEmail: string
  actorRole: string
  action: string
  resource: string
  resourceId?: string | null
  details?: Record<string, unknown>
}

export function logAudit(entry: AuditEntry, req?: Request): void {
  const ip =
    req?.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req?.socket.remoteAddress ||
    null
  const userAgent = req?.headers['user-agent']?.slice(0, 500) || null

  prisma.auditLog
    .create({
      data: {
        userId: entry.userId || null,
        tenantId: entry.tenantId || null,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId || null,
        details: entry.details ? (entry.details as any) : undefined,
        ip,
        userAgent,
      },
    })
    .catch((err) => logger.error('[Audit] Falha ao gravar log', errorMeta(err)))
}

export function auditFromRequest(
  req: Request,
  action: string,
  resource: string,
  resourceId?: string | null,
  details?: Record<string, unknown>
): void {
  const user = req.user
  if (!user) return

  logAudit(
    {
      userId: (user as any).userId,
      tenantId: (user as any).tenantId || null,
      actorEmail: user.email,
      actorRole: user.role,
      action,
      resource,
      resourceId: resourceId || null,
      details,
    },
    req
  )
}