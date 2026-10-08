import { test, expect } from '@playwright/test'

const SLUG = 'burger-house'

test('tracking page mostra PIX e confirma pagamento via simulação', async ({ request, page }) => {
  const menu = await (await request.get(`/api/loja/${SLUG}/produtos`)).json()
  const product = menu[0].products[0]

  const orderRes = await request.post(`/api/loja/${SLUG}/orders`, {
    data: {
      customerName: 'Cliente UI',
      customerPhone: '11977776666',
      deliveryAddress: 'Retirada no Local',
      paymentMethod: 'pix',
      totalAmount: product.price,
      items: [{ productId: product.id, quantity: 1, unitPrice: product.price, components: [], choices: [] }],
    },
  })
  const order = await orderRes.json()

  await page.goto(`/rastrear/${SLUG}?orderId=${order.id}`)

  await expect(page.getByText('Pagamento PIX')).toBeVisible()
  await expect(page.getByText('Aguardando pagamento...')).toBeVisible()
  await expect(page.locator('input[readonly]').first()).toHaveValue(order.pixData.payload)

  await page.getByText('Simular Pagamento PIX (dev)').click()

  await expect(page.getByText('Pagamento Confirmado!')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Seu PIX foi aprovado')).toBeVisible()
})

test('loja pública renderiza cardápio', async ({ page }) => {
  await page.goto(`/loja/${SLUG}`)
  await expect(page.getByText('Burger House').first()).toBeVisible()
  await expect(page.getByText('Ver Carrinho')).not.toBeVisible()
})