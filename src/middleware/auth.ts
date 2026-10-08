import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'
import { prisma } from '../lib/prisma'

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  const token = authHeader?.split(' ')[1]

  if (!token) {
    res.status(401).json({ error: 'Token não fornecido' })
    return
  }

  try {
    const payload = verifyToken(token)
    if (payload.twoFactorPending) {
      res.status(401).json({ error: 'Verificação de dois fatores pendente' })
      return
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true },
    })

    if (!user) {
      res.status(401).json({ error: 'Token inválido' })
      return
    }

    if ((payload.tokenVersion ?? 0) !== user.tokenVersion) {
      res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' })
      return
    }

    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido' })
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores' })
    return
  }
  next()
}
