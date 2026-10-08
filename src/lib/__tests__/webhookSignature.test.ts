import { describe, it, expect, beforeAll } from 'vitest'
import crypto from 'node:crypto'

const SECRET = 'test-webhook-secret'

function sign(manifest: string): string {
  return crypto.createHmac('sha256', SECRET).update(manifest).digest('hex')
}

function makeHeader(manifest: string, overrides: Record<string, string> = {}): string {
  return `ts=${overrides.ts ?? '1700000000'},v1=${overrides.v1 ?? sign(manifest)}`
}

beforeAll(() => {
  process.env.MP_WEBHOOK_SECRET = SECRET
})

describe('verifyWebhookSignature', () => {
  it('valida manifest completo id + request-id + ts', async () => {
    const { verifyWebhookSignature } = await import('../mercadopago')
    const manifest = 'id:12345;request-id:req-1;ts:1700000000;'
    const header = makeHeader(manifest)
    expect(verifyWebhookSignature(header, { dataId: '12345', requestId: 'req-1' })).toBe(true)
  })

  it('valida manifest sem request-id (par omitido)', async () => {
    const { verifyWebhookSignature } = await import('../mercadopago')
    const manifest = 'id:12345;ts:1700000000;'
    const header = makeHeader(manifest)
    expect(verifyWebhookSignature(header, { dataId: '12345', requestId: null })).toBe(true)
  })

  it('rejeita hash forjado', async () => {
    const { verifyWebhookSignature } = await import('../mercadopago')
    const header = 'ts=1700000000,v1=' + 'a'.repeat(64)
    expect(verifyWebhookSignature(header, { dataId: '12345', requestId: 'req-1' })).toBe(false)
  })

  it('rejeita header sem ts ou v1', async () => {
    const { verifyWebhookSignature } = await import('../mercadopago')
    expect(verifyWebhookSignature('v1=abc', { dataId: '1', requestId: null })).toBe(false)
    expect(verifyWebhookSignature('ts=1700000000', { dataId: '1', requestId: null })).toBe(false)
    expect(verifyWebhookSignature('', { dataId: '1', requestId: null })).toBe(false)
  })

  it('rejeita assinatura feita sobre dataId diferente do evento', async () => {
    const { verifyWebhookSignature } = await import('../mercadopago')
    const manifest = 'id:99999;request-id:req-1;ts:1700000000;'
    const header = makeHeader(manifest)
    expect(verifyWebhookSignature(header, { dataId: '12345', requestId: 'req-1' })).toBe(false)
  })

  it('aceita header com espaços e chave em maiúsculas', async () => {
    const { verifyWebhookSignature } = await import('../mercadopago')
    const manifest = 'id:12345;ts:1700000000;'
    const header = `ts = 1700000000 , v1 = ${sign(manifest)}`
    expect(verifyWebhookSignature(header, { dataId: '12345', requestId: null })).toBe(true)
  })
})