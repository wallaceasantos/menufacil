import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-jwt'
})

describe('password', () => {
  it('hash e verificação funcionam', async () => {
    const { hashPassword, verifyPassword } = await import('../password')
    const hash = await hashPassword('S3nh4Forte!')
    expect(hash).not.toBe('S3nh4Forte!')
    expect(await verifyPassword('S3nh4Forte!', hash)).toBe(true)
    expect(await verifyPassword('errada', hash)).toBe(false)
  })
})

describe('jwt', () => {
  it('sign + verify faz o round trip', async () => {
    const { signToken, verifyToken } = await import('../jwt')
    const token = signToken({ userId: 'u1', email: 'a@b.com', role: 'tenant', tenantId: 't1' })
    const payload = verifyToken(token)
    expect(payload.userId).toBe('u1')
    expect(payload.tenantId).toBe('t1')
  })

  it('rejeita token adulterado', async () => {
    const { signToken, verifyToken } = await import('../jwt')
    const token = signToken({ userId: 'u1', email: 'a@b.com', role: 'tenant' })
    expect(() => verifyToken(token + 'x')).toThrow()
    expect(() => verifyToken('not-a-token')).toThrow()
  })
})