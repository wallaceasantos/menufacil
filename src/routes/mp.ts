import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'
import * as mp from '../lib/mercadopago'
import { PLANS } from '../data/plans'
import { logPlanChange } from '../lib/planLog'
import { eventBus } from '../lib/eventBus'
import { sanitizeCpf } from '../lib/cpf'

const router = Router()

const WEBHOOK_URL = process.env.MP_WEBHOOK_URL || ''
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || ''
const TEST_PRICE = process.env.MP_TEST_PRICE ? parseFloat(process.env.MP_TEST_PRICE) : null
const LOCAL_MODE = process.env.MP_LOCAL_MODE === 'true'

function getPlanPrice(): number {
  return TEST_PRICE ?? PLANS.completo.price
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getExpirationDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.toISOString()
}

function getNextDueDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return formatDate(d)
}

async function getOrCreateMpCustomer(tenant: {
  id: string
  name: string
  email: string
  billingEmail?: string | null
  ownerFirstName?: string | null
  ownerLastName?: string | null
}) {
  const existingId = (tenant as any).asaasCustomerId
  if (existingId) {
    return existingId
  }

  const email = tenant.billingEmail || tenant.email
  const search = await mp.findCustomerByEmail(email)
  if (search.results.length > 0) {
    const cust = search.results[0]
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { asaasCustomerId: cust.id },
    })
    return cust.id
  }

  const firstName = tenant.ownerFirstName || tenant.name.split(' ')[0] || tenant.name
  const lastName = tenant.ownerLastName || tenant.name.split(' ').slice(1).join(' ') || undefined
  const customer = await mp.createCustomer({
    email,
    first_name: firstName,
    last_name: lastName,
  })

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { asaasCustomerId: customer.id },
  })

  return customer.id
}

router.post('/checkout/pix', authenticate, extractTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const value = getPlanPrice()

    if (LOCAL_MODE) {
      const paymentId = `local_pix_${Date.now()}`
      res.json({
        paymentId,
        encodedImage: '',
        payload: `00020126580014br.gov.bcb.pix0136${paymentId}5204000053039865405${value.toFixed(2).replace('.', '')}5802BR5914MenuFacil6009SaoPaulo62070503***6304A1B2`,
        ticketUrl: '',
        value,
        status: 'pending',
      })
      return
    }

    const customerId = await getOrCreateMpCustomer(tenant)
    const nameParts = tenant.name.split(' ')
    const cleanCpf = sanitizeCpf(tenant.ownerCpfCnpj || '')

    const payment = await mp.createPayment({
      transaction_amount: value,
      description: `Plano Completo - MenuFácil`,
      payment_method_id: 'pix',
      payer: {
        email: tenant.billingEmail || tenant.email,
        first_name: tenant.ownerFirstName || nameParts[0] || tenant.name,
        last_name: tenant.ownerLastName || nameParts.slice(1).join(' ') || undefined,
        identification: cleanCpf ? { type: 'CPF', number: cleanCpf } : undefined,
      },
      external_reference: tenant.id,
      date_of_expiration: getExpirationDate(),
      notification_url: WEBHOOK_URL ? `${WEBHOOK_URL}/api/mp/webhook` : undefined,
    })

    const txData = payment.point_of_interaction?.transaction_data

    res.json({
      paymentId: String(payment.id),
      encodedImage: txData?.qr_code_base64 || '',
      payload: txData?.qr_code || '',
      ticketUrl: txData?.ticket_url || '',
      value,
      status: payment.status,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/checkout/card', authenticate, extractTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const { holderName, number } = req.body
    const value = getPlanPrice()

    if (tenant.subscriptionStatus === 'authorized') {
      res.status(400).json({ error: 'Você já possui uma assinatura ativa.' })
      return
    }

    if (LOCAL_MODE) {
      const nextBilling = new Date()
      nextBilling.setDate(nextBilling.getDate() + 30)

      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          plan: 'completo',
          paymentStatus: 'paid',
          overdueDays: 0,
          subscriptionStatus: 'authorized',
          cardLastFour: number?.replace(/\D/g, '').slice(-4) || '0000',
          asaasSubscriptionId: `local_preapproval_${Date.now()}`,
          nextBillingDate: nextBilling,
          lastBillingDate: new Date(),
        },
      })
      logPlanChange({ tenantId: tenant.id, oldPlan: tenant.plan, newPlan: 'completo', source: 'local' })
      res.json({
        subscriptionId: `local_preapproval_${Date.now()}`,
        status: 'authorized',
        value,
        cardLastFour: number?.replace(/\D/g, '').slice(-4) || '0000',
        message: 'Assinatura ativada! Você agora tem o plano Completo com cobrança recorrente.',
      })
      return
    }

    if (!holderName || !number) {
      res.status(400).json({ error: 'Dados do cartão incompletos' })
      return
    }

    const { expiryMonth, expiryYear, ccv, cpfCnpj } = req.body

    const customerId = await getOrCreateMpCustomer(tenant)
    const cleanCpf = cpfCnpj?.replace(/\D/g, '') || sanitizeCpf(tenant.ownerCpfCnpj || '')

    const expMonth = parseInt(String(expiryMonth).padStart(2, '0'), 10)
    let expYear = parseInt(String(expiryYear), 10)
    if (expYear < 100) expYear += 2000
    if (expYear < 2026 || expYear > 2040) expYear = 2028

    const cardToken = await mp.tokenizeCard({
      card_number: number.replace(/\s/g, ''),
      expiration_month: expMonth,
      expiration_year: expYear,
      security_code: ccv,
      cardholder: {
        name: holderName,
        identification: cleanCpf ? { type: 'CPF', number: cleanCpf } : undefined,
      },
    })

    // Add card to customer for recurring charges
    await mp.addCustomerCard(customerId, cardToken.id)

    // Create recurring subscription (preapproval)
    const preapproval = await mp.createPreapproval({
      reason: `MenuFácil - Plano Completo (${tenant.name})`,
      external_reference: tenant.id,
      payer_email: tenant.billingEmail || tenant.email,
      card_token_id: cardToken.id,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: value,
        currency_id: 'BRL',
      },
      back_url: `${process.env.APP_URL || WEBHOOK_URL || 'http://localhost:3001'}/dashboard`,
      notification_url: WEBHOOK_URL ? `${WEBHOOK_URL}/api/mp/webhook` : undefined,
    })

    const nextBilling = new Date()
    nextBilling.setDate(nextBilling.getDate() + 30)

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: 'completo',
        paymentStatus: 'paid',
        overdueDays: 0,
        subscriptionStatus: preapproval.status,
        cardLastFour: number.replace(/\D/g, '').slice(-4),
        asaasSubscriptionId: preapproval.id,
        nextBillingDate: nextBilling,
        lastBillingDate: new Date(),
      },
    })

    logPlanChange({ tenantId: tenant.id, oldPlan: tenant.plan, newPlan: 'completo', source: 'upgrade', changedBy: 'cartao' })

    res.json({
      subscriptionId: preapproval.id,
      status: preapproval.status,
      value,
      cardLastFour: number.replace(/\D/g, '').slice(-4),
      message: 'Assinatura criada! Seu plano foi atualizado para Completo com cobrança recorrente mensal.',
    })
  } catch (err) {
    next(err)
  }
})

router.post('/checkout/boleto', authenticate, extractTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const value = getPlanPrice()

    if (LOCAL_MODE) {
      res.json({
        paymentId: `local_boleto_${Date.now()}`,
        boletoUrl: `https://sandbox.mercadopago.com/boleto/local_${Date.now()}`,
        value,
        status: 'pending',
      })
      return
    }

    const customerId = await getOrCreateMpCustomer(tenant)
    const nameParts = tenant.name.split(' ')
    const cleanCpf = sanitizeCpf(tenant.ownerCpfCnpj || '')

    if (!cleanCpf) {
      res.status(400).json({ error: 'CPF do pagador é obrigatório para gerar boleto.' })
      return
    }

    const payment = await mp.createPayment({
      transaction_amount: value,
      description: `Plano Completo - MenuFácil`,
      payment_method_id: 'bolbradesco',
      payer: {
        email: tenant.billingEmail || tenant.email,
        first_name: tenant.ownerFirstName || nameParts[0] || tenant.name,
        last_name: tenant.ownerLastName || nameParts.slice(1).join(' ') || undefined,
        identification: { type: 'CPF', number: cleanCpf },
      },
      external_reference: tenant.id,
      date_of_expiration: getExpirationDate(),
      notification_url: WEBHOOK_URL ? `${WEBHOOK_URL}/api/mp/webhook` : undefined,
    })

    res.json({
      paymentId: String(payment.id),
      boletoUrl: payment.boleto_url || payment.point_of_interaction?.transaction_data?.ticket_url || '',
      value,
      status: payment.status,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/create-customer', authenticate, extractTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    const customerId = await getOrCreateMpCustomer(tenant)

    res.json({ customerId })
  } catch (err) {
    next(err)
  }
})

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const rawBody = (req as any).rawBody as string | undefined
    const signatureHeader = req.headers['x-signature'] as string | undefined

    if (!LOCAL_MODE && MP_WEBHOOK_SECRET && rawBody && signatureHeader) {
      const valid = mp.verifyWebhookSignature(rawBody, signatureHeader)
      if (!valid) {
        console.warn('[MP Webhook] Assinatura inválida')
        res.status(401).json({ error: 'Assinatura inválida' })
        return
      }
    }

    const body = req.body
    console.log('[MP Webhook] Received:', JSON.stringify(body).slice(0, 500))

    const action = body?.action || body?.type
    const data = body?.data

    if (!data || !data.id) {
      res.status(200).json({ received: true })
      return
    }

    if (action === 'payment.created' || action === 'payment.updated' || body?.topic === 'payment') {
      const paymentId = data.id || body?.id
      let payment

      try {
        payment = await mp.getPayment(Number(paymentId))
      } catch (err) {
        console.error('[MP Webhook] Failed to fetch payment:', err)
        res.status(200).json({ received: true })
        return
      }

      const refId = payment.external_reference
      if (!refId) {
        res.status(200).json({ received: true })
        return
      }

      // Try as order payment first
      const order = await prisma.order.findUnique({ where: { id: refId } })
      if (order) {
        await prisma.order.update({
          where: { id: refId },
          data: { mpPaymentStatus: payment.status },
        })

        if (payment.status === 'approved') {
          eventBus.emit(order.tenantId, 'order_status_changed', {
            orderId: order.id, status: order.status,
          })
          console.log(`[MP Webhook] Order ${refId.slice(0, 8)} payment approved, status: ${order.status}`)
        } else if (payment.status === 'rejected' || payment.status === 'cancelled') {
          console.log(`[MP Webhook] Order ${refId.slice(0, 8)} payment ${payment.status}`)
        }
        res.status(200).json({ received: true })
        return
      }

      // Fallback: tenant subscription payment
      const tenant = await prisma.tenant.findUnique({ where: { id: refId } })
      if (!tenant) {
        res.status(200).json({ received: true })
        return
      }

      switch (payment.status) {
        case 'approved':
          await prisma.tenant.update({
            where: { id: refId },
            data: {
              paymentStatus: 'paid',
              overdueDays: 0,
              plan: 'completo',
            },
          })
          logPlanChange({ tenantId: refId, oldPlan: tenant.plan, newPlan: 'completo', source: 'webhook' })
          console.log(`[MP Webhook] Tenant ${refId} pagamento aprovado - upgrade para COMPLETO`)
          break

        case 'rejected':
        case 'cancelled':
          console.log(`[MP Webhook] Tenant ${refId} pagamento ${payment.status}`)
          break

        case 'pending':
          console.log(`[MP Webhook] Tenant ${refId} pagamento pendente`)
          break

        default:
          break
      }
    }

    if (body?.topic === 'preapproval' || action?.includes('preapproval')) {
      const preapprovalId = data?.id || body?.id
      if (!preapprovalId) {
        res.status(200).json({ received: true })
        return
      }

      let preapproval
      try {
        preapproval = await mp.getPreapproval(preapprovalId)
      } catch {
        res.status(200).json({ received: true })
        return
      }

      const tenantId = preapproval.external_reference
      if (!tenantId) {
        res.status(200).json({ received: true })
        return
      }

      if (preapproval.status === 'cancelled') {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            plan: 'basico',
            paymentStatus: 'overdue',
            subscriptionStatus: 'cancelled',
            cardLastFour: null,
            nextBillingDate: null,
          },
        })
        logPlanChange({ tenantId, oldPlan: 'completo', newPlan: 'basico', source: 'webhook' })
        console.log(`[MP Webhook] Tenant ${tenantId} assinatura cancelada - downgrade para BASICO`)
      } else if (preapproval.status === 'authorized') {
        const nextBilling = new Date()
        nextBilling.setDate(nextBilling.getDate() + 30)
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            subscriptionStatus: 'authorized',
            paymentStatus: 'paid',
            overdueDays: 0,
            asaasSubscriptionId: preapproval.id,
            nextBillingDate: nextBilling,
            lastBillingDate: new Date(),
          },
        })
        console.log(`[MP Webhook] Tenant ${tenantId} assinatura autorizada`)
      } else if (preapproval.status === 'paused') {
        await prisma.tenant.update({
          where: { id: tenantId },
          data: {
            subscriptionStatus: 'paused',
            paymentStatus: 'overdue',
            overdueDays: (await prisma.tenant.findUnique({ where: { id: tenantId } }))?.overdueDays || 1,
          },
        })
        console.log(`[MP Webhook] Tenant ${tenantId} assinatura pausada (falha no pagamento)`)
      }
    }

    // subscription_charge - recurring charge payment events
    if (action === 'subscription_charge' || body?.topic === 'subscription_charge') {
      const chargeId = data?.id || body?.id
      if (!chargeId) {
        res.status(200).json({ received: true })
        return
      }

      try {
        const charge = await mp.getPayment(Number(chargeId))
        const tenantId = charge.external_reference
        if (!tenantId) {
          res.status(200).json({ received: true })
          return
        }

        if (charge.status === 'approved') {
          const nextBilling = new Date()
          nextBilling.setDate(nextBilling.getDate() + 30)
          await prisma.tenant.update({
            where: { id: tenantId },
            data: {
              paymentStatus: 'paid',
              overdueDays: 0,
              lastBillingDate: new Date(),
              nextBillingDate: nextBilling,
            },
          })
          console.log(`[MP Webhook] Tenant ${tenantId} cobrança recorrente aprovada`)
        } else if (charge.status === 'rejected' || charge.status === 'cancelled') {
          console.log(`[MP Webhook] Tenant ${tenantId} cobrança recorrente ${charge.status}`)
        }
      } catch (err) {
        console.error('[MP Webhook] Error processing subscription charge:', err)
      }
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('[MP Webhook] Error:', err)
    res.status(200).json({ received: true })
  }
})

router.get('/payment/:id', authenticate, extractTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    if (LOCAL_MODE) {
      res.json({
        id,
        status: 'pending',
        value: getPlanPrice(),
        paymentMethod: 'pix',
      })
      return
    }

    const payment = await mp.getPayment(Number(id))
    res.json({
      id: String(payment.id),
      status: payment.status,
      statusDetail: payment.status_detail,
      value: payment.transaction_amount,
      paymentMethod: payment.payment_method_id,
      dateCreated: payment.date_created,
      dateApproved: payment.date_approved,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/payment/:id/approve', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params

    if (LOCAL_MODE) {
      if (req.tenant) {
        await prisma.tenant.update({
          where: { id: req.tenant.id },
          data: { plan: 'completo', paymentStatus: 'paid', overdueDays: 0 },
        })
        logPlanChange({ tenantId: req.tenant.id, oldPlan: req.tenant.plan, newPlan: 'completo', source: 'local' })
      }
      res.json({ id, status: 'approved' })
      return
    }
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN || ''}`,
      },
      body: JSON.stringify({ status: 'approved' }),
    })
    const result = await mpResponse.json()
    res.json(result)
  } catch (err) {
    next(err)
  }
})

router.get('/plan-price', (_req: Request, res: Response) => {
  res.json({ price: getPlanPrice() })
})

router.get('/subscription', authenticate, extractTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.json({ subscription: null, lastPayment: null })
      return
    }

    let lastPayment: any = null
    let preapproval: any = null

    if (tenant.asaasSubscriptionId && !LOCAL_MODE) {
      try {
        const search = await mp.getPaymentByExternalRef(tenant.id)
        if (search.results.length > 0) {
          const sorted = search.results.sort((a, b) =>
            new Date(b.date_created).getTime() - new Date(a.date_created).getTime()
          )
          const latest = sorted[0]
          lastPayment = {
            id: String(latest.id),
            value: latest.transaction_amount,
            status: latest.status,
            dateCreated: latest.date_created,
            dateApproved: latest.date_approved,
            paymentMethod: latest.payment_method_id,
            boletoUrl: latest.boleto_url || latest.point_of_interaction?.transaction_data?.ticket_url,
          }
        }
      } catch { }

      try {
        const pp = await mp.getPreapproval(tenant.asaasSubscriptionId)
        preapproval = {
          id: pp.id,
          status: pp.status,
          value: pp.auto_recurring.transaction_amount,
          frequency: pp.auto_recurring.frequency,
          frequencyType: pp.auto_recurring.frequency_type,
        }
      } catch {}
    }

    res.json({
      subscription: {
        id: tenant.asaasSubscriptionId,
        status: tenant.subscriptionStatus || 'none',
        plan: tenant.plan,
        cardLastFour: tenant.cardLastFour,
        nextBillingDate: tenant.nextBillingDate?.toISOString().split('T')[0] || null,
        lastBillingDate: tenant.lastBillingDate?.toISOString().split('T')[0] || null,
        paymentStatus: tenant.paymentStatus,
        overdueDays: tenant.overdueDays,
        ...(preapproval || {}),
      },
      lastPayment,
    })
  } catch (err) {
    next(err)
  }
})

router.post('/subscription/cancel', authenticate, extractTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    if (!tenant.asaasSubscriptionId || tenant.subscriptionStatus !== 'authorized') {
      res.status(400).json({ error: 'Nenhuma assinatura ativa para cancelar' })
      return
    }

    if (!LOCAL_MODE) {
      try {
        await mp.cancelPreapproval(tenant.asaasSubscriptionId)
      } catch (err) {
        console.error('[MP] Failed to cancel preapproval:', err)
      }
    }

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: 'basico',
        paymentStatus: 'paid',
        subscriptionStatus: 'cancelled',
        nextBillingDate: null,
        cardLastFour: null,
      },
    })

    logPlanChange({ tenantId: tenant.id, oldPlan: tenant.plan, newPlan: 'basico', source: 'downgrade', changedBy: 'tenant' })
    console.log(`[MP] Tenant ${tenant.id} assinatura cancelada voluntariamente`)

    res.json({ message: 'Assinatura cancelada com sucesso. Seu plano voltou para Básico.' })
  } catch (err) {
    next(err)
  }
})

router.post('/subscription/change-card', authenticate, extractTenant, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenant = req.tenant
    if (!tenant) {
      res.status(404).json({ error: 'Loja não encontrada' })
      return
    }

    if (!tenant.asaasSubscriptionId || tenant.subscriptionStatus !== 'authorized') {
      res.status(400).json({ error: 'Nenhuma assinatura ativa para alterar o cartão' })
      return
    }

    const { holderName, number, expiryMonth, expiryYear, ccv, cpfCnpj } = req.body

    if (!holderName || !number) {
      res.status(400).json({ error: 'Dados do cartão incompletos' })
      return
    }

    if (LOCAL_MODE) {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { cardLastFour: number.replace(/\D/g, '').slice(-4) },
      })
      res.json({ cardLastFour: number.replace(/\D/g, '').slice(-4), message: 'Cartão atualizado com sucesso!' })
      return
    }

    const cleanCpf = cpfCnpj?.replace(/\D/g, '') || sanitizeCpf(tenant.ownerCpfCnpj || '')
    const expMonth = parseInt(String(expiryMonth).padStart(2, '0'), 10)
    let expYear = parseInt(String(expiryYear), 10)
    if (expYear < 100) expYear += 2000
    if (expYear < 2026 || expYear > 2040) expYear = 2028

    const cardToken = await mp.tokenizeCard({
      card_number: number.replace(/\s/g, ''),
      expiration_month: expMonth,
      expiration_year: expYear,
      security_code: ccv,
      cardholder: {
        name: holderName,
        identification: cleanCpf ? { type: 'CPF', number: cleanCpf } : undefined,
      },
    })

    await mp.updatePreapproval(tenant.asaasSubscriptionId, { card_token_id: cardToken.id })

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { cardLastFour: number.replace(/\D/g, '').slice(-4) },
    })

    res.json({ cardLastFour: number.replace(/\D/g, '').slice(-4), message: 'Cartão atualizado com sucesso!' })
  } catch (err) {
    next(err)
  }
})

export default router
