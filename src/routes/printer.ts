import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import { formatOrderReceipt, formatStatusReceipt, type PrintOrderData } from '../lib/escpos'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

function toNumber(value: any): number {
  return value === null || value === undefined ? 0 : Number(value)
}

async function createPrintJob(
  tenantId: string,
  printerId: string,
  orderId: string | null,
  printType: string,
  title: string,
  content: string
) {
  await prisma.printJob.create({
    data: { tenantId, printerId, orderId, status: 'completed', printType, title, content, printedAt: new Date() },
  })
}

async function printOrder(tenantId: string, orderId: string, printType: 'new_order' | 'status_update' | 'kitchen' | 'delivery') {
  const printers = await prisma.printerConfig.findMany({
    where: { tenantId, isActive: true },
  })

  for (const printer of printers) {
    const shouldPrint =
      (printType === 'new_order' && printer.autoPrintNew) ||
      (printType === 'status_update' && printer.autoPrintStatus) ||
      (printType === 'kitchen' && printer.printKitchen) ||
      (printType === 'delivery' && printer.printDelivery)

    if (!shouldPrint) continue

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
            orderItemComponents: true,
            orderItemChoices: true,
          },
        },
      },
    })

    if (!order) continue

    const printData: PrintOrderData = {
      orderId: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      deliveryAddress: order.deliveryAddress || 'Retirada no Local',
      paymentMethod: order.paymentMethod || 'Nao informado',
      status: order.status,
      items: order.items.map((i) => ({
        name: i.product?.name || 'Produto removido',
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        notes: i.notes,
        components: i.orderItemComponents?.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          unitPrice: Number(c.unitPrice),
        })),
        choices: i.orderItemChoices?.map((ch) => ({
          groupName: ch.choiceGroupName,
          optionName: ch.optionName,
          quantity: ch.quantity,
        })),
      })),
      total: Number(order.totalAmount),
      createdAt: order.createdAt?.toISOString() || new Date().toISOString(),
      footerMessage: printer.footerMessage,
      printType: printType,
    }

    const content = printType === 'status_update'
      ? formatStatusReceipt(printData, printer.charPerLine)
      : formatOrderReceipt(printData, printer.charPerLine)

    const title = printType === 'new_order' ? 'Novo Pedido' :
      printType === 'status_update' ? 'Status Atualizado' :
      printType === 'kitchen' ? 'Cozinha' : 'Entrega'

    await createPrintJob(tenantId, printer.id, orderId, printType, title, content)
  }
}

export { printOrder }

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const configs = await prisma.printerConfig.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ printers: configs })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { name, printerType, connectionType, ipAddress, port, autoPrintNew, autoPrintStatus, printKitchen, printDelivery, charPerLine, footerMessage, isActive } = req.body

    if (!name) {
      res.status(400).json({ error: 'Nome da impressora é obrigatório' })
      return
    }

    const config = await prisma.printerConfig.create({
      data: {
        tenantId: tenant.id,
        name,
        printerType: printerType || 'escpos',
        connectionType: connectionType || 'usb',
        ipAddress: ipAddress || null,
        port: port || 9100,
        autoPrintNew: autoPrintNew !== false,
        autoPrintStatus: autoPrintStatus !== false,
        printKitchen: printKitchen ?? false,
        printDelivery: printDelivery ?? false,
        charPerLine: charPerLine || 48,
        footerMessage: footerMessage || null,
        isActive: isActive !== false,
      },
    })
    res.json(config)
  } catch (err) {
    next(err)
  }
})

router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { id } = req.params
    const existing = await prisma.printerConfig.findFirst({ where: { id, tenantId: tenant.id } })
    if (!existing) {
      res.status(404).json({ error: 'Impressora não encontrada' })
      return
    }

    const { name, printerType, connectionType, ipAddress, port, autoPrintNew, autoPrintStatus, printKitchen, printDelivery, charPerLine, footerMessage, isActive } = req.body
    const data: any = {}
    if (name !== undefined) data.name = name
    if (printerType !== undefined) data.printerType = printerType
    if (connectionType !== undefined) data.connectionType = connectionType
    if (ipAddress !== undefined) data.ipAddress = ipAddress
    if (port !== undefined) data.port = port
    if (autoPrintNew !== undefined) data.autoPrintNew = autoPrintNew
    if (autoPrintStatus !== undefined) data.autoPrintStatus = autoPrintStatus
    if (printKitchen !== undefined) data.printKitchen = printKitchen
    if (printDelivery !== undefined) data.printDelivery = printDelivery
    if (charPerLine !== undefined) data.charPerLine = charPerLine
    if (footerMessage !== undefined) data.footerMessage = footerMessage
    if (isActive !== undefined) data.isActive = isActive

    const config = await prisma.printerConfig.update({ where: { id }, data })
    res.json(config)
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { id } = req.params
    const existing = await prisma.printerConfig.findFirst({ where: { id, tenantId: tenant.id } })
    if (!existing) {
      res.status(404).json({ error: 'Impressora não encontrada' })
      return
    }
    await prisma.printerConfig.delete({ where: { id } })
    res.json({ message: 'Impressora removida' })
  } catch (err) {
    next(err)
  }
})

router.post('/test/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { id } = req.params
    const printer = await prisma.printerConfig.findFirst({ where: { id, tenantId: tenant.id } })
    if (!printer) {
      res.status(404).json({ error: 'Impressora não encontrada' })
      return
    }

    const content = 'MENU FACIL\nTeste de Impressao\n========================\n\nImpressora configurada!\nNome: ' + printer.name + '\nTipo: ' + (printer.connectionType === 'usb' ? 'USB' : printer.connectionType === 'network' ? 'Rede' : 'Cloud') + '\n\n========================\n\n\n\n'

    await createPrintJob(tenant.id, printer.id, null, 'test', 'Teste de Impressão', content)
    res.json({ message: 'Teste enviado para fila de impressão' })
  } catch (err) {
    next(err)
  }
})

router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const jobs = await prisma.printJob.findMany({
      where: { tenantId: tenant.id },
      include: { printer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    res.json({ jobs })
  } catch (err) {
    next(err)
  }
})

router.get('/jobs/:id/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { id } = req.params
    const job = await prisma.printJob.findFirst({ where: { id, tenantId: tenant.id } })
    if (!job) {
      res.status(404).json({ error: 'Job não encontrado' })
      return
    }
    res.json({ id: job.id, content: job.content, title: job.title, type: job.printType })
  } catch (err) {
    next(err)
  }
})

export default router
