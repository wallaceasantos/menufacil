const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN || ''
const MP_WEBHOOK_SECRET = process.env.MP_WEBHOOK_SECRET || ''
const BASE_URL = 'https://api.mercadopago.com/v1'

interface MpCustomer {
  id: string
  email: string
  first_name?: string
  last_name?: string
}

interface MpCardToken {
  id: string
  card_number: string
  last_four_digits: string
  expiration_month: number
  expiration_year: number
  cardholder: { name: string }
}

interface MpPayment {
  id: number
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' | 'in_process'
  status_detail: string
  transaction_amount: number
  payment_method_id: string
  date_created: string
  date_approved?: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code: string
      qr_code_base64: string
      ticket_url: string
    }
  }
  boleto_url?: string
  external_reference?: string
  preapproval_id?: string
}

interface MpPreapproval {
  id: string
  status: 'pending' | 'authorized' | 'paused' | 'cancelled'
  reason: string
  auto_recurring: {
    frequency: number
    frequency_type: 'months'
    transaction_amount: number
  }
  payer_id: number
  card_id?: number
  external_reference?: string
}

function makeIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function mpFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${path}`
  const method = (options.method || 'GET').toUpperCase()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
    ...(options.headers as Record<string, string> || {}),
  }

  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    headers['X-Idempotency-Key'] = headers['X-Idempotency-Key'] || makeIdempotencyKey()
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    const body = await response.text()
    console.error(`[MP API Error] ${response.status} - ${method} ${path}: ${body.slice(0, 500)}`)
    let message = `Mercado Pago API error ${response.status}`
    try {
      const parsed = JSON.parse(body)
      message = parsed.message || parsed.error || parsed.cause?.[0]?.description || message
    } catch { }
    throw new Error(message)
  }

  const text = await response.text()
  if (!text) return undefined as T
  return JSON.parse(text) as T
}

export function createCustomer(data: {
  email: string
  first_name?: string
  last_name?: string
  phone?: { area_code?: string; number?: string }
}): Promise<MpCustomer> {
  return mpFetch<MpCustomer>('/customers', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function findCustomerByEmail(email: string): Promise<{ results: MpCustomer[] }> {
  return mpFetch<{ results: MpCustomer[] }>(`/customers/search?email=${encodeURIComponent(email)}`)
}

export function tokenizeCard(data: {
  card_number: string
  expiration_month: number
  expiration_year: number
  security_code: string
  cardholder: { name: string; identification?: { type: string; number: string } }
}): Promise<MpCardToken> {
  return mpFetch<MpCardToken>('/card_tokens', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function addCustomerCard(customerId: string, tokenId: string): Promise<any> {
  return mpFetch<any>(`/customers/${customerId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ token: tokenId }),
  })
}

export function createPayment(data: {
  transaction_amount: number
  description: string
  payment_method_id: 'pix' | 'bolbradesco'
  payer: { email: string; first_name?: string; last_name?: string; identification?: { type: string; number: string } }
  external_reference?: string
  date_of_expiration?: string
  notification_url?: string
}): Promise<MpPayment> {
  return mpFetch<MpPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function createCardPayment(data: {
  transaction_amount: number
  description: string
  token: string
  installments: number
  payment_method_id: string
  issuer_id?: string
  payer: { email: string; identification: { type: string; number: string } }
  external_reference?: string
  notification_url?: string
}): Promise<MpPayment> {
  return mpFetch<MpPayment>('/payments', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getPayment(paymentId: number): Promise<MpPayment> {
  return mpFetch<MpPayment>(`/payments/${paymentId}`)
}

export function createPreapproval(data: {
  preapproval_plan_id?: string
  reason: string
  external_reference?: string
  payer_email: string
  card_token_id: string
  auto_recurring: {
    frequency: number
    frequency_type: 'months'
    transaction_amount: number
    currency_id: string
  }
  back_url?: string
  status?: 'authorized' | 'pending'
  notification_url?: string
}): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>('/preapproval', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function getPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`)
}

export function cancelPreapproval(id: string): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
  })
}

export function updatePreapproval(id: string, data: {
  card_token_id?: string
  status?: 'authorized' | 'paused' | 'cancelled'
}): Promise<MpPreapproval> {
  return mpFetch<MpPreapproval>(`/preapproval/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function getPaymentByExternalRef(externalRef: string): Promise<{ results: MpPayment[] }> {
  return mpFetch<{ results: MpPayment[] }>(`/payments/search?external_reference=${encodeURIComponent(externalRef)}&sort=date_created&criteria=desc`)
}

export function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!MP_WEBHOOK_SECRET) return true
  const crypto = require('crypto')
  const expected = crypto
    .createHmac('sha256', MP_WEBHOOK_SECRET)
    .update(body)
    .digest('hex')
  return signature === expected
}
