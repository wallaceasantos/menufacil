import { Request, Response, NextFunction } from 'express'

export type TenantRole = 'dono' | 'atendente' | 'cozinha' | 'entregador'

const ROLE_PERMISSIONS: Record<TenantRole, string[]> = {
  dono: ['*'],
  atendente: ['orders:read', 'orders:write', 'customers:read', 'menu:read'],
  cozinha: ['orders:read', 'orders:write'],
  entregador: ['orders:read'],
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user
    if (!user) { res.status(401).json({ error: 'Não autorizado' }); return }

    if (user.role === 'admin') return next()

    const tenantRole: TenantRole = user.tenantRole || 'dono'
    if (tenantRole === 'dono') return next()

    const allowed = ROLE_PERMISSIONS[tenantRole] || []
    if (allowed.includes('*') || allowed.includes(permission)) {
      return next()
    }

    res.status(403).json({ error: 'Você não tem permissão para esta ação' })
  }
}
