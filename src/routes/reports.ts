import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import { getCached, setCache } from '../lib/cache'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

function toNumber(value: any): number {
  return value === null || value === undefined ? 0 : Number(value)
}

function getDateRange(period: string, customFrom?: string, customTo?: string) {
  const now = new Date()
  now.setHours(23, 59, 59, 999)
  let from: Date

  switch (period) {
    case 'today':
      from = new Date()
      from.setHours(0, 0, 0, 0)
      break
    case 'yesterday':
      from = new Date()
      from.setDate(from.getDate() - 1)
      from.setHours(0, 0, 0, 0)
      now.setDate(now.getDate() - 1)
      now.setHours(23, 59, 59, 999)
      break
    case '7days':
      from = new Date()
      from.setDate(from.getDate() - 7)
      from.setHours(0, 0, 0, 0)
      break
    case '30days':
      from = new Date()
      from.setDate(from.getDate() - 30)
      from.setHours(0, 0, 0, 0)
      break
    case '90days':
      from = new Date()
      from.setDate(from.getDate() - 90)
      from.setHours(0, 0, 0, 0)
      break
    case 'custom':
      from = customFrom ? new Date(customFrom) : new Date()
      from.setHours(0, 0, 0, 0)
      if (customTo) {
        const to = new Date(customTo)
        to.setHours(23, 59, 59, 999)
        return { from, to }
      }
      break
    default:
      from = new Date()
      from.setDate(from.getDate() - 30)
      from.setHours(0, 0, 0, 0)
  }

  return { from, to: now }
}

function fillMissingDays(from: Date, to: Date, data: { date: string; value: number }[]) {
  const result: { date: string; value: number; orders: number }[] = []
  const dataMap = new Map(data.map((d) => [d.date, d.value]))

  const current = new Date(from)
  current.setHours(0, 0, 0, 0)
  const end = new Date(to)
  end.setHours(0, 0, 0, 0)

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0]
    result.push({
      date: dateStr,
      value: dataMap.get(dateStr) || 0,
      orders: 0,
    })
    current.setDate(current.getDate() + 1)
  }

  return result
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const period = (req.query.period as string) || '30days'
    const customFrom = req.query.from as string | undefined
    const customTo = req.query.to as string | undefined

    const cacheKey = `reports:${tenant.id}:${period}:${customFrom || ''}:${customTo || ''}`
    const cached = getCached(cacheKey)
    if (cached) { res.json(cached); return }

    const { from, to } = getDateRange(period, customFrom, customTo)

    // 1. Buscar todos os pedidos do período
    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: from, lte: to },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true, price: true } },
          },
        },
        customer: { select: { id: true, name: true, phone: true } },
      },
    })

    const allOrders = orders
    const validOrders = orders.filter((o) => o.status !== 'cancelled')

    // 2. Métricas gerais
    const totalOrders = validOrders.length
    const totalRevenue = validOrders.reduce((sum, o) => sum + toNumber(o.totalAmount), 0)
    const ticketMedio = totalOrders > 0 ? totalRevenue / totalOrders : 0
    const cancelledOrders = allOrders.length - validOrders.length
    const cancellationRate = allOrders.length > 0 ? (cancelledOrders / allOrders.length) * 100 : 0

    // 3. Comparação com período anterior
    const periodDuration = to.getTime() - from.getTime()
    const prevFrom = new Date(from.getTime() - periodDuration)
    const prevTo = from

    const prevOrders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: prevFrom, lte: prevTo },
        status: { not: 'cancelled' },
      },
    })
    const prevRevenue = prevOrders.reduce((sum, o) => sum + toNumber(o.totalAmount), 0)
    const prevOrderCount = prevOrders.length
    const revenueChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0
    const ordersChange = prevOrderCount > 0 ? ((totalOrders - prevOrderCount) / prevOrderCount) * 100 : 0

    // 4. Vendas por dia (para gráfico de linha)
    const salesByDayMap = new Map<string, { value: number; orders: number }>()
    validOrders.forEach((o) => {
      const dateStr = new Date(o.createdAt!).toISOString().split('T')[0]
      const current = salesByDayMap.get(dateStr) || { value: 0, orders: 0 }
      current.value += toNumber(o.totalAmount)
      current.orders += 1
      salesByDayMap.set(dateStr, current)
    })
    const salesByDayRaw = Array.from(salesByDayMap.entries()).map(([date, v]) => ({
      date,
      value: v.value,
      orders: v.orders,
    }))
    const salesByDay = fillMissingDays(from, to, salesByDayRaw)

    // 5. Top produtos mais vendidos
    const productSales = new Map<string, { name: string; quantity: number; revenue: number }>()
    validOrders.forEach((o) => {
      o.items.forEach((item) => {
        const name = item.product?.name || 'Produto removido'
        const current = productSales.get(name) || { name, quantity: 0, revenue: 0 }
        current.quantity += item.quantity
        current.revenue += item.quantity * toNumber(item.unitPrice)
        productSales.set(name, current)
      })
    })
    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10)

    // 6. Distribuição por forma de pagamento
    const paymentMap = new Map<string, { count: number; value: number }>()
    validOrders.forEach((o) => {
      const method = o.paymentMethod || 'Não informado'
      const current = paymentMap.get(method) || { count: 0, value: 0 }
      current.count += 1
      current.value += toNumber(o.totalAmount)
      paymentMap.set(method, current)
    })
    const paymentMethods = Array.from(paymentMap.entries())
      .map(([method, data]) => ({ method, count: data.count, value: data.value }))
      .sort((a, b) => b.value - a.value)

    // 7. Distribuição por status
    const statusMap = new Map<string, number>()
    allOrders.forEach((o) => {
      const status = o.status || 'pending'
      statusMap.set(status, (statusMap.get(status) || 0) + 1)
    })
    const statusDistribution = Array.from(statusMap.entries()).map(([status, count]) => ({
      status,
      count,
    }))

    // 8. Top clientes
    const customerMap = new Map<string, { name: string; phone: string; orders: number; spent: number }>()
    validOrders.forEach((o) => {
      if (!o.customer) return
      const key = o.customer.id
      const current = customerMap.get(key) || {
        name: o.customer.name,
        phone: o.customerPhone,
        orders: 0,
        spent: 0,
      }
      current.orders += 1
      current.spent += toNumber(o.totalAmount)
      customerMap.set(key, current)
    })
    const topCustomers = Array.from(customerMap.values())
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10)

    // 9. Vendas por dia da semana
    const weekdayMap = new Map<number, { orders: number; revenue: number }>()
    for (let i = 0; i < 7; i++) weekdayMap.set(i, { orders: 0, revenue: 0 })
    validOrders.forEach((o) => {
      const day = new Date(o.createdAt!).getDay()
      const current = weekdayMap.get(day) || { orders: 0, revenue: 0 }
      current.orders += 1
      current.revenue += toNumber(o.totalAmount)
      weekdayMap.set(day, current)
    })
    const weekdayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
    const byWeekday = Array.from(weekdayMap.entries())
      .map(([day, data]) => ({ day, name: weekdayNames[day], orders: data.orders, revenue: data.revenue }))
      .sort((a, b) => a.day - b.day)

    // 10. Vendas por horário (0-23h)
    const hourlyMap = new Map<number, { orders: number; revenue: number }>()
    for (let i = 0; i < 24; i++) hourlyMap.set(i, { orders: 0, revenue: 0 })
    validOrders.forEach((o) => {
      const hour = new Date(o.createdAt!).getHours()
      const current = hourlyMap.get(hour) || { orders: 0, revenue: 0 }
      current.orders += 1
      current.revenue += toNumber(o.totalAmount)
      hourlyMap.set(hour, current)
    })
    const byHour = Array.from(hourlyMap.entries())
      .map(([hour, data]) => ({ hour, orders: data.orders, revenue: data.revenue }))
      .sort((a, b) => a.hour - b.hour)

    const reportData = {
      period: { from, to, type: period },
      summary: {
        totalOrders,
        totalRevenue,
        ticketMedio,
        cancelledOrders,
        cancellationRate,
        revenueChange,
        ordersChange,
      },
      salesByDay,
      topProducts,
      paymentMethods,
      statusDistribution,
      topCustomers,
      byWeekday,
      byHour,
    }

    setCache(cacheKey, reportData, 30000)
    res.json(reportData)
  } catch (err) {
    next(err)
  }
})

router.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const period = (req.query.period as string) || '30days'
    const customFrom = req.query.from as string | undefined
    const customTo = req.query.to as string | undefined

    const { from, to } = getDateRange(period, customFrom, customTo)

    const orders = await prisma.order.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: { gte: from, lte: to },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    const header = ['Data', 'Pedido', 'Cliente', 'Telefone', 'Status', 'Itens', 'Total', 'Pagamento']
    const rows = orders.map((o) => {
      const items = o.items
        .map((i) => `${i.quantity}x ${i.product?.name || 'Produto'}`)
        .join(' | ')
      return [
        new Date(o.createdAt!).toLocaleString('pt-BR'),
        o.id,
        o.customerName,
        o.customerPhone,
        o.status,
        items,
        toNumber(o.totalAmount).toFixed(2),
        o.paymentMethod || 'Não informado',
      ]
    })

    const csv = [
      header.join(','),
      ...rows.map((r) =>
        r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="relatorio-pedidos-${new Date().toISOString().split('T')[0]}.csv"`
    )
    res.send('\ufeff' + csv)
  } catch (err) {
    next(err)
  }
})

export default router
