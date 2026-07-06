import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import { uploadAttachmentToCloudinary } from '../lib/cloudinary'
import { sendEmail } from '../lib/email'
import { sendWhatsAppText } from '../lib/whatsapp'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ]
    const isAllowed = allowed.some((type) => file.mimetype.startsWith(type) || file.mimetype === type)
    if (!isAllowed) {
      cb(new Error('Tipo de arquivo não permitido'))
      return
    }
    cb(null, true)
  },
})

router.use(authenticate)
router.use(extractTenant)

function mapAttachment(attachment: any) {
  return {
    id: attachment.id,
    filename: attachment.filename,
    url: attachment.url,
    mimeType: attachment.mimeType,
    size: attachment.size,
    createdAt: attachment.createdAt?.toISOString?.() || attachment.createdAt,
  }
}

function mapMessage(message: any) {
  return {
    id: message.id,
    sender: message.senderRole === 'admin' ? 'admin' : 'user',
    text: message.message,
    createdAt: message.createdAt.toISOString(),
    attachments: (message.attachments || []).map(mapAttachment),
  }
}

function mapTicket(ticket: any) {
  return {
    id: ticket.id,
    userId: ticket.userId,
    userName: ticket.user.name,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    messages: (ticket.messages || []).map(mapMessage),
  }
}

router.get('/tickets', async (req, res, next) => {
  try {
    const tenant = req.tenant
    const user = req.user!

    if (user.role === 'admin') {
      const tickets = await prisma.supportTicket.findMany({
        include: {
          user: { select: { name: true } },
          messages: {
            orderBy: { createdAt: 'asc' },
            include: { attachments: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      res.json(tickets.map(mapTicket))
      return
    }

    if (!tenant) {
      res.status(404).json({ error: 'Tenant não encontrado' })
      return
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { tenantId: tenant.id, userId: user.userId },
      include: {
        user: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { attachments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(tickets.map(mapTicket))
  } catch (err) {
    next(err)
  }
})

router.post('/tickets', async (req, res, next) => {
  try {
    const tenant = req.tenant
    const user = req.user!
    const { subject, description } = req.body

    if (user.role === 'admin') {
      res.status(403).json({ error: 'Admin não pode abrir chamado' })
      return
    }

    if (!tenant) {
      res.status(400).json({ error: 'Tenant não identificado' })
      return
    }

    if (!subject || !description) {
      res.status(400).json({ error: 'Assunto e descrição são obrigatórios' })
      return
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: tenant.id,
        userId: user.userId,
        subject,
        description,
        status: 'open',
      },
      include: { user: { select: { name: true } }, messages: { include: { attachments: true } } },
    })

    res.status(201).json(mapTicket(ticket))
  } catch (err) {
    next(err)
  }
})

router.get('/tickets/:id', async (req, res, next) => {
  try {
    const user = req.user!
    const { id } = req.params

    const ticket = await prisma.supportTicket.findFirst({
      where: user.role === 'admin' ? { id } : { id, tenantId: req.tenant?.id, userId: user.userId },
      include: {
        user: { select: { name: true, email: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { attachments: true },
        },
      },
    })

    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' })
      return
    }

    res.json(mapTicket(ticket))
  } catch (err) {
    next(err)
  }
})

router.post('/tickets/:id/attachments', upload.single('file'), async (req, res, next) => {
  try {
    const user = req.user!
    const { id } = req.params

    const ticket = await prisma.supportTicket.findFirst({
      where: user.role === 'admin' ? { id } : { id, tenantId: req.tenant?.id, userId: user.userId },
      include: { tenant: { select: { id: true } } },
    })

    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' })
      return
    }

    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'Nenhum arquivo enviado' })
      return
    }

    const publicId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const result = await uploadAttachmentToCloudinary(
      file.buffer,
      `menufacil/attachments/${ticket.tenant.id}`,
      publicId
    )

    res.status(201).json({
      filename: file.originalname,
      url: result.url,
      mimeType: file.mimetype,
      size: file.size,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/tickets/:id/messages', async (req, res, next) => {
  try {
    const user = req.user!
    const { id } = req.params
    const { text, attachments: rawAttachments } = req.body

    if (!text || !text.trim()) {
      res.status(400).json({ error: 'Mensagem é obrigatória' })
      return
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: user.role === 'admin' ? { id } : { id, tenantId: req.tenant?.id, userId: user.userId },
      include: { user: { select: { name: true, email: true } }, tenant: { select: { id: true, phone: true } } },
    })

    if (!ticket) {
      res.status(404).json({ error: 'Chamado não encontrado' })
      return
    }

    if (ticket.status !== 'open') {
      res.status(400).json({ error: 'Chamado está fechado' })
      return
    }

    const message = await prisma.ticketMessage.create({
      data: {
        ticketId: id,
        senderRole: user.role === 'admin' ? 'admin' : 'user',
        message: text.trim(),
      },
      include: { attachments: true },
    })

    // Cria anexos vinculados à mensagem
    const attachments = Array.isArray(rawAttachments) ? rawAttachments : []
    if (attachments.length > 0) {
      await prisma.ticketAttachment.createMany({
        data: attachments.map((a: any) => ({
          messageId: message.id,
          filename: String(a.filename || 'anexo'),
          url: String(a.url),
          mimeType: a.mimeType ? String(a.mimeType) : null,
          size: typeof a.size === 'number' ? a.size : null,
        })),
      })
    }

    // Notificações apenas quando admin responde ao lojista
    if (user.role === 'admin') {
      const appUrl = process.env.APP_URL || 'http://localhost:3000'
      const ticketUrl = `${appUrl}/dashboard/suporte`
      const messageAttachments = await prisma.ticketAttachment.findMany({
        where: { messageId: message.id },
      })

      const attachmentLinks = messageAttachments.length
        ? '\n\nAnexos:\n' + messageAttachments.map((a) => `- ${a.filename}: ${a.url}`).join('\n')
        : ''

      const notificationText =
        `Olá, ${ticket.user.name}!\n` +
        `Há uma nova resposta do suporte no seu chamado *#${ticket.id.slice(0, 8).toUpperCase()} - ${ticket.subject}*.\n` +
        `Acesse: ${ticketUrl}${attachmentLinks}`

      // WhatsApp
      if (ticket.tenant.phone) {
        sendWhatsAppText(ticket.tenant.id, ticket.tenant.phone, notificationText).catch((err) =>
          console.error('[WhatsApp] Erro ao notificar:', err)
        )
      }

      // E-mail
      if (ticket.user.email) {
        sendEmail({
          to: ticket.user.email,
          subject: `[MenuFácil] Nova resposta no chamado #${ticket.id.slice(0, 8).toUpperCase()}`,
          text: `Olá, ${ticket.user.name}!\n\nHá uma nova resposta do suporte no seu chamado "${ticket.subject}".\n\nMensagem:\n${text.trim()}\n\nAcesse o chamado: ${ticketUrl}${attachmentLinks}`,
          html: `<p>Olá, <strong>${ticket.user.name}</strong>!</p>
<p>Há uma nova resposta do suporte no seu chamado <strong>#${ticket.id.slice(0, 8).toUpperCase()} - ${ticket.subject}</strong>.</p>
<blockquote style="border-left: 3px solid #f97316; padding-left: 12px; color: #555;">${text.trim().replace(/\n/g, '<br>')}</blockquote>
<p><a href="${ticketUrl}" style="background:#f97316;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;display:inline-block;">Acessar chamado</a></p>
${messageAttachments.length ? '<p><strong>Anexos:</strong></p><ul>' + messageAttachments.map((a) => `<li><a href="${a.url}">${a.filename}</a></li>`).join('') + '</ul>' : ''}`,
          attachments: messageAttachments.map((a) => ({ filename: a.filename, url: a.url })),
        }).catch((err) => console.error('[Email] Erro ao notificar:', err))
      }
    }

    const updatedMessage = await prisma.ticketMessage.findUnique({
      where: { id: message.id },
      include: { attachments: true },
    })

    res.status(201).json(mapMessage(updatedMessage!))
  } catch (err) {
    next(err)
  }
})

router.patch('/tickets/:id/status', async (req, res, next) => {
  try {
    const user = req.user!
    const { id } = req.params
    const { status } = req.body

    if (!['open', 'closed'].includes(status)) {
      res.status(400).json({ error: 'Status inválido' })
      return
    }

    const ticket = await prisma.supportTicket.updateMany({
      where: user.role === 'admin' ? { id } : { id, tenantId: req.tenant?.id, userId: user.userId },
      data: { status },
    })

    if (ticket.count === 0) {
      res.status(404).json({ error: 'Chamado não encontrado' })
      return
    }

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

export default router
