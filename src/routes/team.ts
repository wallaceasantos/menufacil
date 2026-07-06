import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import crypto from 'crypto'

const router = Router()

// Routes that don't require tenant context
router.get('/pending', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    if (!user) { res.status(401).json({ error: 'Não autorizado' }); return }

    const invites = await prisma.invite.findMany({
      where: {
        email: user.email.toLowerCase(),
        status: 'pending',
        expiresAt: { gt: new Date() },
      },
      include: { tenant: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      invites: invites.map((i) => ({
        id: i.id,
        token: i.token,
        tenantName: i.tenant.name,
        tenantRole: i.tenantRole,
        expiresAt: i.expiresAt,
      })),
    })
  } catch (err) { next(err) }
})

router.post('/accept', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user
    if (!user) { res.status(401).json({ error: 'Não autorizado' }); return }

    const { token } = req.body
    if (!token) { res.status(400).json({ error: 'Token é obrigatório' }); return }

    const invite = await prisma.invite.findUnique({
      where: { token },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    })

    if (!invite || invite.status !== 'pending' || new Date(invite.expiresAt) < new Date()) {
      res.status(400).json({ error: 'Convite inválido ou expirado' })
      return
    }

    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      res.status(400).json({ error: 'Este convite é para o email ' + invite.email })
      return
    }

    const existingUser = await prisma.user.findUnique({ where: { id: user.id || user.userId } })
    if (!existingUser) { res.status(404).json({ error: 'Usuário não encontrado' }); return }

    if (existingUser.tenantId === invite.tenantId) {
      res.status(400).json({ error: 'Você já pertence a esta equipe' })
      return
    }

    await prisma.user.update({
      where: { id: existingUser.id },
      data: { tenantId: invite.tenantId, tenantRole: invite.tenantRole },
    })

    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'accepted', usedBy: existingUser.id },
    })

    res.json({
      message: `Você agora faz parte da equipe de ${invite.tenant.name} como ${invite.tenantRole}`,
      tenantName: invite.tenant.name,
      tenantSlug: invite.tenant.slug,
      tenantRole: invite.tenantRole,
    })
  } catch (err) { next(err) }
})

// Routes that require tenant context
router.use(authenticate)
router.use(extractTenant)

function maskEmail(email: string): string {
  if (!email.includes('@')) return email
  return email[0] + '***@' + email.split('@')[1]
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const user = (req as any).user

    const [members, invites] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId: tenant.id },
        select: {
          id: true, name: true, email: true, tenantRole: true, role: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.invite.findMany({
        where: { tenantId: tenant.id, status: 'pending' },
        select: {
          id: true, email: true, tenantRole: true, createdAt: true, expiresAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    res.json({
      members: members.map((m) => ({
        ...m,
        emailMasked: maskEmail(m.email),
        isMe: m.id === user.id || m.id === user.userId,
      })),
      invites: invites.map((i) => ({
        ...i,
        emailMasked: maskEmail(i.email),
      })),
      myRole: user.tenantRole || 'dono',
    })
  } catch (err) { next(err) }
})

router.post('/invite', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    const user = (req as any).user
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const callerRole = user.tenantRole || 'dono'
    if (callerRole !== 'dono') {
      res.status(403).json({ error: 'Apenas o dono pode convidar membros' }); return
    }

    const { email, tenantRole = 'atendente' } = req.body
    if (!email || !email.includes('@')) { res.status(400).json({ error: 'Email inválido' }); return }

    const validRoles = ['atendente', 'cozinha', 'entregador']
    if (!validRoles.includes(tenantRole)) {
      res.status(400).json({ error: 'Perfil inválido' }); return
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), tenantId: tenant.id },
    })
    if (existingUser) {
      res.status(409).json({ error: 'Este email já pertence a um membro da equipe' })
      return
    }

    const existingInvite = await prisma.invite.findFirst({
      where: { email: email.toLowerCase(), tenantId: tenant.id, status: 'pending' },
    })
    if (existingInvite) {
      res.status(409).json({ error: 'Já existe um convite pendente para este email' })
      return
    }

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const invite = await prisma.invite.create({
      data: {
        tenantId: tenant.id,
        email: email.toLowerCase(),
        token,
        tenantRole,
        invitedBy: user.id || user.userId,
        status: 'pending',
        expiresAt,
      },
    })

    res.json({
      invite: {
        id: invite.id,
        email: maskEmail(email),
        tenantRole: invite.tenantRole,
        expiresAt: invite.expiresAt,
        token: invite.token,
      },
      registerUrl: `${process.env.APP_URL || 'http://localhost:3000'}/register?invite=${token}`,
    })
  } catch (err) { next(err) }
})

router.patch('/member/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    const user = (req as any).user
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const callerRole = user.tenantRole || 'dono'
    if (callerRole !== 'dono') {
      res.status(403).json({ error: 'Apenas o dono pode alterar perfis' }); return
    }

    const { userId } = req.params
    const { tenantRole } = req.body

    const validRoles = ['dono', 'atendente', 'cozinha', 'entregador']
    if (!validRoles.includes(tenantRole)) {
      res.status(400).json({ error: 'Perfil inválido' }); return
    }

    const member = await prisma.user.findFirst({
      where: { id: userId, tenantId: tenant.id },
    })
    if (!member) { res.status(404).json({ error: 'Membro não encontrado' }); return }

    if (member.id === user.id || member.id === user.userId) {
      res.status(400).json({ error: 'Você não pode alterar seu próprio perfil' }); return
    }

    await prisma.user.update({
      where: { id: userId },
      data: { tenantRole },
    })

    res.json({ id: userId, tenantRole, message: 'Perfil atualizado' })
  } catch (err) { next(err) }
})

router.delete('/member/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    const user = (req as any).user
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const callerRole = user.tenantRole || 'dono'
    if (callerRole !== 'dono') {
      res.status(403).json({ error: 'Apenas o dono pode remover membros' }); return
    }

    const { userId } = req.params
    const member = await prisma.user.findFirst({
      where: { id: userId, tenantId: tenant.id },
    })
    if (!member) { res.status(404).json({ error: 'Membro não encontrado' }); return }

    if (member.id === user.id || member.id === user.userId) {
      res.status(400).json({ error: 'Você não pode remover a si mesmo' }); return
    }

    await prisma.user.delete({ where: { id: userId } })

    res.json({ message: 'Membro removido da equipe' })
  } catch (err) { next(err) }
})

router.delete('/invite/:inviteId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    const user = (req as any).user
    if (!tenant) { res.status(404).json({ error: 'Loja não encontrada' }); return }

    const callerRole = user.tenantRole || 'dono'
    if (callerRole !== 'dono') {
      res.status(403).json({ error: 'Apenas o dono pode cancelar convites' }); return
    }

    const { inviteId } = req.params
    await prisma.invite.deleteMany({ where: { id: inviteId, tenantId: tenant.id } })
    res.json({ message: 'Convite cancelado' })
  } catch (err) { next(err) }
})

export default router
