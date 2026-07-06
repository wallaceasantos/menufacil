import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import { verifyToken } from '../utils/jwt'
import { v2 as cloudinary } from 'cloudinary'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/pdf',
      'image/',
    ]
    const isAllowed = allowed.some((type) => file.mimetype === type || file.mimetype.startsWith(type))
    if (!isAllowed) {
      cb(new Error('Apenas PDF e imagens são permitidos'))
      return
    }
    cb(null, true)
  },
})

// ─── Rota pública de download (token via query param, pois <a href> não envia Authorization) ───
router.get('/:id/download', async (req, res, next) => {
  try {
    const { id } = req.params
    const token = req.query.token as string | undefined

    if (!token) {
      res.status(401).json({ error: 'Token não fornecido' })
      return
    }

    try {
      verifyToken(token)
    } catch {
      res.status(401).json({ error: 'Token inválido ou expirado' })
      return
    }

    const invoice = await prisma.invoice.findUnique({ where: { id } })

    if (!invoice || !invoice.documentUrl) {
      res.status(404).json({ error: 'Documento não encontrado' })
      return
    }

    // Adiciona flag de attachment ao final da URL do Cloudinary
    const sep = invoice.documentUrl.includes('?') ? '&' : '?'
    res.redirect(`${invoice.documentUrl}${sep}fl_attachment=true`)
  } catch (err) {
    next(err)
  }
})

// ─── Rotas autenticadas ───
router.use(authenticate)
router.use(extractTenant)

function mapInvoice(invoice: any) {
  return {
    id: invoice.id,
    tenantId: invoice.tenantId,
    tenantName: invoice.tenant?.name,
    amount: Number(invoice.amount),
    dueDate: invoice.dueDate.toISOString().split('T')[0],
    status: invoice.status,
    paymentMethod: invoice.paymentMethod,
    description: invoice.description,
    documentUrl: invoice.documentUrl,
    externalId: invoice.externalId,
    paidAt: invoice.paidAt?.toISOString() || null,
    createdAt: invoice.createdAt?.toISOString(),
    updatedAt: invoice.updatedAt?.toISOString(),
  }
}

// Lista faturas
router.get('/', async (req, res, next) => {
  try {
    const user = req.user!

    if (user.role === 'admin') {
      const { tenantId } = req.query
      const invoices = await prisma.invoice.findMany({
        where: tenantId ? { tenantId: String(tenantId) } : undefined,
        include: { tenant: { select: { name: true } } },
        orderBy: { dueDate: 'desc' },
      })
      res.json(invoices.map(mapInvoice))
      return
    }

    if (!req.tenant) {
      res.status(404).json({ error: 'Tenant não encontrado' })
      return
    }

    const invoices = await prisma.invoice.findMany({
      where: { tenantId: req.tenant.id },
      orderBy: { dueDate: 'desc' },
    })

    res.json(invoices.map(mapInvoice))
  } catch (err) {
    next(err)
  }
})

// Detalhes
router.get('/:id', async (req, res, next) => {
  try {
    const user = req.user!
    const { id } = req.params

    const invoice = await prisma.invoice.findFirst({
      where: user.role === 'admin' ? { id } : { id, tenantId: req.tenant?.id },
      include: { tenant: { select: { name: true } } },
    })

    if (!invoice) {
      res.status(404).json({ error: 'Fatura não encontrada' })
      return
    }

    res.json(mapInvoice(invoice))
  } catch (err) {
    next(err)
  }
})

// Criação (admin)
router.post('/', async (req, res, next) => {
  try {
    const user = req.user!
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Apenas admin pode criar faturas' })
      return
    }

    const { tenantId, amount, dueDate, paymentMethod, description, status } = req.body

    if (!tenantId || amount === undefined || !dueDate) {
      res.status(400).json({ error: 'Tenant, valor e vencimento são obrigatórios' })
      return
    }

    const invoice = await prisma.invoice.create({
      data: {
        tenantId,
        amount,
        dueDate: new Date(dueDate),
        paymentMethod: paymentMethod || 'boleto',
        description: description || '',
        status: status || 'pending',
      },
      include: { tenant: { select: { name: true } } },
    })

    res.status(201).json(mapInvoice(invoice))
  } catch (err) {
    next(err)
  }
})

// Atualização (admin)
router.put('/:id', async (req, res, next) => {
  try {
    const user = req.user!
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Apenas admin pode editar faturas' })
      return
    }

    const { id } = req.params
    const { amount, dueDate, paymentMethod, description, status } = req.body

    const data: any = {}
    if (amount !== undefined) data.amount = amount
    if (dueDate !== undefined) data.dueDate = new Date(dueDate)
    if (paymentMethod !== undefined) data.paymentMethod = paymentMethod
    if (description !== undefined) data.description = description
    if (status !== undefined) {
      data.status = status
      if (status === 'paid') {
        data.paidAt = new Date()
      } else {
        data.paidAt = null
      }
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data,
      include: { tenant: { select: { name: true } } },
    })

    res.json(mapInvoice(invoice))
  } catch (err) {
    next(err)
  }
})

// Upload de documento (boleto/PDF)
router.post('/:id/document', upload.single('document'), async (req, res, next) => {
  try {
    const user = req.user!
    if (user.role !== 'admin') {
      res.status(403).json({ error: 'Apenas admin pode enviar documentos' })
      return
    }

    const { id } = req.params
    const file = req.file

    if (!file) {
      res.status(400).json({ error: 'Nenhum documento enviado' })
      return
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { tenant: { select: { id: true } } },
    })

    if (!invoice) {
      res.status(404).json({ error: 'Fatura não encontrada' })
      return
    }

    const publicId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    // Upload direto como 'raw' para PDFs — isso garante acesso público ao download
    const uploadResult = await new Promise<{ secure_url: string }>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `menufacil/invoices/${invoice.tenant.id}`,
          public_id: publicId,
          resource_type: 'raw',   // PDF = raw, não image
          format: 'pdf',
        },
        (error, result) => {
          if (error) reject(error)
          else if (!result?.secure_url) reject(new Error('Falha no upload'))
          else resolve({ secure_url: result.secure_url })
        }
      )
      stream.end(file.buffer)
    })

    const updated = await prisma.invoice.update({
      where: { id },
      data: { documentUrl: uploadResult.secure_url },
      include: { tenant: { select: { name: true } } },
    })

    res.json(mapInvoice(updated))
  } catch (err) {
    next(err)
  }
})

// Solicitar 2ª via (lojista)
router.post('/:id/request-copy', async (req, res, next) => {
  try {
    const user = req.user!
    if (user.role === 'admin') {
      res.status(403).json({ error: 'Admin não pode solicitar 2ª via' })
      return
    }

    if (!req.tenant) {
      res.status(404).json({ error: 'Tenant não encontrado' })
      return
    }

    const { id } = req.params
    const invoice = await prisma.invoice.findFirst({
      where: { id, tenantId: req.tenant.id },
    })

    if (!invoice) {
      res.status(404).json({ error: 'Fatura não encontrada' })
      return
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        tenantId: req.tenant.id,
        userId: user.userId,
        subject: 'Financeiro / 2ª Via',
        description: `Solicito a segunda via do boleto da fatura #${invoice.id.slice(0, 8).toUpperCase()} - vencimento ${invoice.dueDate.toLocaleDateString('pt-BR')}.`,
        status: 'open',
      },
      include: { user: { select: { name: true } }, messages: true },
    })

    res.status(201).json({
      ticketId: ticket.id,
      message: 'Solicitação de 2ª via enviada ao suporte',
    })
  } catch (err) {
    next(err)
  }
})

export default router
