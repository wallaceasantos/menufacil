import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { hashPassword, verifyPassword } from '../utils/password'
import { signToken } from '../utils/jwt'
import { authenticate } from '../middleware/auth'
import { isValidCpf, sanitizeCpf } from '../lib/cpf'

const router = Router()

function serializeUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
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
    const { email, password } = req.body

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

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    })

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
