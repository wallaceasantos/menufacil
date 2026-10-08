import { Router } from 'express'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { signToken, verifyToken } from '../utils/jwt'
import { authenticate } from '../middleware/auth'
import { isValidCpf, sanitizeCpf } from '../lib/cpf'
import { sendEmail } from '../lib/email'
import { logger, errorMeta } from '../lib/logger'
import { generateSecret, verifyTotp, otpauthUrl } from '../lib/totp'
import { auditFromRequest, logAudit } from '../lib/audit'
import { getRedis, isRedisAvailable } from '../lib/redis'

const router = Router()

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const RESET_EMAIL_LIMIT = 3
const RESET_EMAIL_WINDOW_MS = 60 * 60 * 1000
const resetEmailAttempts = new Map<string, { count: number; resetTime: number }>()

function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

async function isResetEmailThrottled(email: string): Promise<boolean> {
  const redis = getRedis()
  const key = `rl:reset:${email}`

  if (redis && isRedisAvailable()) {
    const count = await redis.incr(key).catch(() => 1)
    if (count === 1) await redis.expire(key, Math.floor(RESET_EMAIL_WINDOW_MS / 1000)).catch(() => {})
    return count > RESET_EMAIL_LIMIT
  }

  const now = Date.now()
  const entry = resetEmailAttempts.get(key)
  if (!entry || entry.resetTime <= now) {
    resetEmailAttempts.set(key, { count: 1, resetTime: now + RESET_EMAIL_WINDOW_MS })
    return false
  }
  entry.count += 1
  return entry.count > RESET_EMAIL_LIMIT
}

function serializeUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    twoFactorEnabled: Boolean(user.twoFactorEnabled),
    onboardingCompletedAt: user.tenant?.onboardingCompletedAt?.toISOString?.() || null,
    tenantSlug: user.tenant?.slug,
    plan: user.tenant?.plan,
    paymentStatus: user.tenant?.paymentStatus,
    overdueDays: user.tenant?.overdueDays,
    subscriptionStatus: user.tenant?.subscriptionStatus,
    cardLastFour: user.tenant?.cardLastFour,
    nextBillingDate: user.tenant?.nextBillingDate?.toISOString?.() || null,
    tenantRole: user.tenantRole || 'dono',
    ownerCpfCnpj: user.tenant?.ownerCpfCnpj || null,
    ownerFirstName: user.tenant?.ownerFirstName || null,
    ownerLastName: user.tenant?.ownerLastName || null,
    billingEmail: user.tenant?.billingEmail || null,
    billingPhone: user.tenant?.billingPhone || null,
    billingPostalCode: user.tenant?.billingPostalCode || null,
    billingAddressNumber: user.tenant?.billingAddressNumber || null,
  }
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      res.status(400).json({ error: 'Nome, email e senha são obrigatórios' })
      return
    }

    const role = 'tenant'

    const existing = await prisma.user.findFirst({
      where: { email },
    })

    if (existing) {
      res.status(409).json({ error: 'Email já cadastrado' })
      return
    }

    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
      },
    })

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    })

    res.status(201).json({
      user: serializeUser(user),
      token,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password, code } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' })
      return
    }

    const user = await prisma.user.findFirst({
      where: { email },
      include: { tenant: true },
    })

    if (!user) {
      res.status(401).json({ error: 'Credenciais inválidas' })
      return
    }

    const valid = await verifyPassword(password, user.passwordHash)

    if (!valid) {
      res.status(401).json({ error: 'Credenciais inválidas' })
      return
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!code) {
        const tempToken = signToken(
          {
            userId: user.id,
            email: user.email,
            role: user.role,
            tenantId: user.tenantId,
            twoFactorPending: true,
            tokenVersion: user.tokenVersion,
          },
          '10m'
        )
        res.json({ requires2FA: true, tempToken })
        return
      }

      if (!verifyTotp(String(code), user.twoFactorSecret)) {
        res.status(401).json({ error: 'Código de verificação inválido' })
        return
      }
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    })

    auditFromRequest(req, 'auth.login', 'user', user.id, { email: user.email })

    res.json({
      user: serializeUser(user),
      token,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body

    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: 'Email é obrigatório' })
      return
    }

    const normalizedEmail = email.trim().toLowerCase()

    if (await isResetEmailThrottled(normalizedEmail)) {
      res.status(429).json({ error: 'Muitas solicitações de recuperação. Tente novamente em alguns minutos.' })
      return
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { tenant: true },
    })

    if (!user) {
      res.json({ message: 'Se o email estiver cadastrado, você receberá as instruções de recuperação.' })
      return
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = hashResetToken(rawToken)

    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    })

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    })

    logAudit(
      {
        userId: user.id,
        tenantId: user.tenantId || null,
        actorEmail: user.email,
        actorRole: user.role,
        action: 'auth.forgot_password',
        resource: 'user',
        resourceId: user.id,
      },
      req
    )

    const appUrl = process.env.APP_URL || 'http://localhost:3000'
    const resetLink = `${appUrl.replace(/\/$/, '')}/reset-password?token=${rawToken}`

    await sendEmail({
      to: user.email,
      subject: 'Recuperação de senha — MenuFácil',
      text: `Olá, ${user.name}.\n\nRecebemos uma solicitação para redefinir sua senha no MenuFácil.\n\nAcesse o link abaixo para criar uma nova senha (válido por 1 hora):\n${resetLink}\n\nSe você não solicitou esta alteração, ignore este email. Sua senha permanecerá a mesma.`,
      html: `
        <p>Olá, <strong>${user.name}</strong>.</p>
        <p>Recebemos uma solicitação para redefinir sua senha no <strong>MenuFácil</strong>.</p>
        <p><a href="${resetLink}">Clique aqui para criar uma nova senha</a> (válido por 1 hora).</p>
        <p>Ou copie o link: <br/> <code>${resetLink}</code></p>
        <p>Se você não solicitou esta alteração, ignore este email. Sua senha permanecerá a mesma.</p>
      `,
    })

    res.json({ message: 'Se o email estiver cadastrado, você receberá as instruções de recuperação.' })
  } catch (err) {
    logger.error('Erro em forgot-password', errorMeta(err))
    next(err)
  }
})

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      res.status(400).json({ error: 'Token e nova senha são obrigatórios' })
      return
    }

    if (typeof password !== 'string' || password.length < 8) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 8 caracteres' })
      return
    }

    const tokenHash = hashResetToken(String(token))
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    })

    if (!resetToken || resetToken.usedAt || new Date(resetToken.expiresAt) < new Date()) {
      res.status(400).json({ error: 'Token inválido ou expirado. Solicite uma nova recuperação de senha.' })
      return
    }

    const passwordHash = await hashPassword(password)

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, tokenVersion: { increment: 1 } },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ])

    logAudit(
      {
        userId: updatedUser.id,
        tenantId: updatedUser.tenantId || null,
        actorEmail: updatedUser.email,
        actorRole: updatedUser.role,
        action: 'auth.reset_password',
        resource: 'user',
        resourceId: updatedUser.id,
      },
      req
    )

    sendEmail({
      to: updatedUser.email,
      subject: 'Sua senha foi alterada — MenuFácil',
      text: `Olá, ${updatedUser.name}.\n\nSua senha no MenuFácil foi alterada com sucesso.\n\nSe você não fez esta alteração, recupere seu acesso imediatamente pela opção "Esqueci minha senha" na tela de login.`,
      html: `
        <p>Olá, <strong>${updatedUser.name}</strong>.</p>
        <p>Sua senha no <strong>MenuFácil</strong> foi alterada com sucesso.</p>
        <p>Se você não fez esta alteração, recupere seu acesso imediatamente pela opção <strong>"Esqueci minha senha"</strong> na tela de login.</p>
      `,
    }).catch(() => {})

    res.json({ message: 'Senha redefinida com sucesso. Você já pode entrar com a nova senha.' })
  } catch (err) {
    logger.error('Erro em reset-password', errorMeta(err))
    next(err)
  }
})

router.post('/2fa/setup', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' })
      return
    }

    const secret = generateSecret()
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    })

    res.json({
      secret,
      otpauthUrl: otpauthUrl(secret, user.email),
    })
  } catch (err) {
    next(err)
  }
})

router.post('/2fa/enable', authenticate, async (req, res, next) => {
  try {
    const { code } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user || !user.twoFactorSecret) {
      res.status(400).json({ error: 'Execute o setup do 2FA primeiro' })
      return
    }

    if (!code || !verifyTotp(String(code), user.twoFactorSecret)) {
      res.status(400).json({ error: 'Código de verificação inválido' })
      return
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: true },
    })

    auditFromRequest(req, 'auth.2fa_enable', 'user', user.id)

    res.json({ message: 'Autenticação de dois fatores ativada com sucesso.' })
  } catch (err) {
    next(err)
  }
})

router.post('/2fa/disable', authenticate, async (req, res, next) => {
  try {
    const { code } = req.body

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' })
      return
    }

    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!code || !verifyTotp(String(code), user.twoFactorSecret)) {
        res.status(400).json({ error: 'Código de verificação inválido' })
        return
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    })

    auditFromRequest(req, 'auth.2fa_disable', 'user', user.id)

    res.json({ message: 'Autenticação de dois fatores desativada.' })
  } catch (err) {
    next(err)
  }
})

router.post('/2fa/verify', async (req, res, next) => {
  try {
    const { tempToken, code } = req.body

    if (!tempToken || !code) {
      res.status(400).json({ error: 'Token temporário e código são obrigatórios' })
      return
    }

    let payload
    try {
      payload = verifyToken(String(tempToken))
    } catch {
      res.status(401).json({ error: 'Token temporário inválido ou expirado' })
      return
    }

    if (!payload.twoFactorPending) {
      res.status(400).json({ error: 'Token não requer verificação 2FA' })
      return
    }

    const user = await prisma.user.findFirst({
      where: { id: payload.userId },
      include: { tenant: true },
    })

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      res.status(400).json({ error: '2FA não está ativo para esta conta' })
      return
    }

    if (!verifyTotp(String(code), user.twoFactorSecret)) {
      res.status(401).json({ error: 'Código de verificação inválido' })
      return
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    })

    auditFromRequest(req, 'auth.login_2fa', 'user', user.id, { email: user.email })

    res.json({
      user: serializeUser(user),
      token,
    })
  } catch (err) {
    next(err)
  }
})

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { tenant: true },
    })

    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado' })
      return
    }

    res.json({ user: serializeUser(user) })
  } catch (err) {
    next(err)
  }
})

// Registro combinado: cria tenant + usuário lojista em uma única chamada
router.post('/register-tenant', async (req, res, next) => {
  try {
    const { name, email, password, tenantName, slug, plan = 'basico', inviteToken, billing } = req.body

    if (!name || !email || !password || !tenantName || !slug) {
      res.status(400).json({ error: 'Nome, email, senha, nome do estabelecimento e endereço do cardápio são obrigatórios' })
      return
    }

    let billingData: {
      ownerCpfCnpj?: string
      ownerFirstName?: string
      ownerLastName?: string
      billingEmail?: string
      billingPhone?: string
      billingPostalCode?: string
      billingAddressNumber?: string
    } = {}

    if (billing && typeof billing === 'object') {
      const cpfRaw = billing.cpf ? sanitizeCpf(String(billing.cpf)) : ''
      if (!billing.firstName || !billing.lastName || !cpfRaw || !billing.email) {
        res.status(400).json({ error: 'Nome, sobrenome, CPF e e-mail de cobrança são obrigatórios' })
        return
      }
      if (!isValidCpf(cpfRaw)) {
        res.status(400).json({ error: 'CPF inválido' })
        return
      }
      billingData = {
        ownerCpfCnpj: cpfRaw,
        ownerFirstName: String(billing.firstName).trim(),
        ownerLastName: String(billing.lastName).trim(),
        billingEmail: String(billing.email).trim().toLowerCase(),
        billingPhone: billing.phone ? String(billing.phone) : undefined,
        billingPostalCode: billing.postalCode ? String(billing.postalCode) : undefined,
        billingAddressNumber: billing.addressNumber ? String(billing.addressNumber) : undefined,
      }
    }

    let invite = null
    if (inviteToken) {
      invite = await prisma.invite.findUnique({ where: { token: inviteToken }, include: { tenant: true } })
      if (!invite || invite.status !== 'pending' || new Date(invite.expiresAt) < new Date()) {
        res.status(400).json({ error: 'Convite inválido ou expirado' })
        return
      }
      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        res.status(400).json({ error: 'Este convite é para o email ' + invite.email })
        return
      }

      await prisma.user.create({
        data: {
          name,
          email,
          passwordHash: await hashPassword(password),
          role: 'tenant',
          tenantRole: invite.tenantRole,
          tenantId: invite.tenantId,
        },
        include: { tenant: true },
      })

      await prisma.invite.update({
        where: { id: invite.id },
        data: { status: 'accepted', usedBy: (await prisma.user.findFirst({ where: { email } }))!.id },
      })

      const token = signToken({
        userId: (await prisma.user.findFirst({ where: { email } }))!.id,
        email,
        role: 'tenant',
        tenantId: invite.tenantId,
        tokenVersion: 0,
      })

      res.status(201).json({
        user: serializeUser(await prisma.user.findFirst({ where: { email }, include: { tenant: true } })),
        token,
      })
      return
    }

    // Verifica se o email já está cadastrado
    const existingUser = await prisma.user.findFirst({ where: { email } })
    if (existingUser) {
      res.status(409).json({ error: 'Email já cadastrado' })
      return
    }

    // Verifica se o slug já está em uso
    const existingTenant = await prisma.tenant.findUnique({ where: { slug } })
    if (existingTenant) {
      res.status(409).json({ error: 'Este endereço de cardápio já está em uso. Escolha outro.' })
      return
    }

    // Cria o tenant
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name: tenantName,
        type: 'restaurante',
        email,
        plan,
        status: 'active',
        paymentStatus: 'paid',
        ...billingData,
      },
    })

    // Cria o usuário vinculado ao tenant
    const passwordHash = await hashPassword(password)
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'tenant',
        tenantId: tenant.id,
      },
      include: { tenant: true },
    })

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tokenVersion: user.tokenVersion,
    })

    res.status(201).json({
      user: serializeUser(user),
      token,
    })
  } catch (err) {
    next(err)
  }
})

export default router
