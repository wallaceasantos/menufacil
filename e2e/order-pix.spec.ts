import { test, expect } from '@playwright/test'

const SLUG = 'burger-house'

test.describe.configure({ mode: 'serial' })

let orderId = ''
let pixPayload = ''

test('loja pública responde com dados do tenant', async ({ request }) => {
  const res = await request.get(`/api/loja/${SLUG}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.slug).toBe(SLUG)
  expect(body.paymentMethods.pix).toBeTruthy()
})

test('cardápio público retorna produtos', async ({ request }) => {
  const res = await request.get(`/api/loja/${SLUG}/produtos`)
  expect(res.status()).toBe(200)
  const categories = await res.json()
  expect(Array.isArray(categories)).toBe(true)
  expect(categories.length).toBeGreaterThan(0)
})

test('cria pedido com PIX e retorna payload de pagamento', async ({ request }) => {
  const menu = await (await request.get(`/api/loja/${SLUG}/produtos`)).json()
  const product = menu[0].products[0]

  const res = await request.post(`/api/loja/${SLUG}/orders`, {
    data: {
      customerName: 'Cliente E2E',
      customerPhone: '11999990000',
      deliveryAddress: 'Retirada no Local',
      paymentMethod: 'pix',
      totalAmount: product.price,
      items: [
        {
          productId: product.id,
          quantity: 1,
          unitPrice: product.price,
          components: [],
          choices: [],
        },
      ],
    },
  })

  expect(res.status()).toBe(201)
  const body = await res.json()
  orderId = body.id
  pixPayload = body.pixData?.payload || ''

  expect(orderId).toBeTruthy()
  expect(body.status).toBe('pending')
  expect(body.mpPaymentStatus).toBe('pending')
  expect(pixPayload).toContain('br.gov.bcb.pix')
  expect(body.trackingUrl).toContain(`/rastrear/${SLUG}?orderId=${orderId}`)
})

test('pix-status retorna pagamento pendente com payload', async ({ request }) => {
  const res = await request.get(`/api/loja/${SLUG}/orders/${orderId}/pix-status`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.status).toBe('pending')
  expect(body.pixPayload).toBe(pixPayload)
})

test('pedido aparece no tracking', async ({ request }) => {
  const res = await request.get(`/api/loja/${SLUG}/track/${orderId}`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.id).toBe(orderId)
  expect(body.customerName).toBe('Cliente E2E')
  expect(body.pixPayload).toBe(pixPayload)
})

test('simula pagamento PIX e aprova', async ({ request }) => {
  const res = await request.post(`/api/loja/${SLUG}/pix/simulate`, {
    data: { orderId },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.status).toBe('approved')
})

test('pix-status reflete pagamento aprovado', async ({ request }) => {
  const res = await request.get(`/api/loja/${SLUG}/orders/${orderId}/pix-status`)
  const body = await res.json()
  expect(body.status).toBe('approved')
})

test('avaliação registra nota e comentário', async ({ request }) => {
  const res = await request.post(`/api/loja/${SLUG}/rate`, {
    data: { orderId, rating: 5, comment: 'Excelente, teste E2E!' },
  })
  expect(res.status()).toBe(200)

  const track = await (await request.get(`/api/loja/${SLUG}/track/${orderId}`)).json()
  expect(track.rating).toBe(5)
  expect(track.comment).toBe('Excelente, teste E2E!')
})

test('pedido inválido é rejeitado (preço divergente)', async ({ request }) => {
  const menu = await (await request.get(`/api/loja/${SLUG}/produtos`)).json()
  const product = menu[0].products[0]

  const res = await request.post(`/api/loja/${SLUG}/orders`, {
    data: {
      customerName: 'Trapaceiro',
      customerPhone: '11988887777',
      deliveryAddress: 'Retirada no Local',
      paymentMethod: 'pix',
      totalAmount: 0.01,
      items: [{ productId: product.id, quantity: 1, unitPrice: 0.01, components: [], choices: [] }],
    },
  })
  expect(res.status()).toBe(400)
})