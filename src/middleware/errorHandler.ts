import type { Request, Response, NextFunction } from 'express'
import { logger, errorMeta } from '../lib/logger'
import { sendAlert } from '../lib/alerts'

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const meta = { method: req.method, path: req.originalUrl, ...errorMeta(err) }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    logger.warn('Token inválido', meta)
    res.status(401).json({ error: 'Token inválido ou expirado' })
    return
  }

  logger.error('Erro no servidor', meta)

  if (process.env.NODE_ENV === 'production') {
    sendAlert('errorHandler', `${req.method} ${req.originalUrl}: ${err.message}`, meta).catch(() => {})
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Erro interno' : err.message,
  })
}
