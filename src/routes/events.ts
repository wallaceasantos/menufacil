import { Router, Request, Response } from 'express'
import { prisma } from '../lib/prisma'
import { eventBus } from '../lib/eventBus'
import jwt from 'jsonwebtoken'
import { getJwtSecret } from '../utils/env'

const router = Router()
const JWT_SECRET = getJwtSecret()

router.get('/stream', async (req: Request, res: Response) => {
  const token = req.query.token as string || req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }

  let userId: string
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (!decoded?.userId) throw new Error('invalid')
    userId = decoded.userId
  } catch {
    res.status(401).json({ error: 'Token inválido' })
    return
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: { select: { id: true } } },
  })

  if (!user) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }

  if (user.role === 'admin') {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders?.()

    res.write(`event: connected\ndata: ${JSON.stringify({ role: 'admin', timestamp: new Date().toISOString() })}\n\n`)
    const hb = setInterval(() => { try { res.write(`: heartbeat ${Date.now()}\n\n`) } catch {} }, 25000)
    const cleanup = () => { clearInterval(hb); try { res.end() } catch {} }
    req.on('close', cleanup)
    req.on('error', cleanup)
    res.on('close', cleanup)
    return
  }

  const tenantId = user.tenant?.id

  if (!tenantId) {
    res.status(401).json({ error: 'Não autorizado' })
    return
  }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  res.write(`event: connected\ndata: ${JSON.stringify({ tenantId, timestamp: new Date().toISOString() })}\n\n`)

  const send = (event: any) => {
    try {
      res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
    } catch (err) {
      console.error('[SSE] Write error:', err)
    }
  }

  const unsubscribe = eventBus.subscribe(tenantId, send)

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`)
    } catch {}
  }, 25000)

  const cleanup = () => {
    clearInterval(heartbeat)
    unsubscribe()
    try { res.end() } catch {}
  }

  req.on('close', cleanup)
  req.on('error', cleanup)
  res.on('close', cleanup)
})

export default router
