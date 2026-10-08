import { describe, it, expect } from 'vitest'
import { generateSecret, generateTotp, verifyTotp, otpauthUrl } from '../totp'

describe('totp', () => {
  it('gera secret base32 válido (20+ chars, A-Z2-7)', () => {
    const secret = generateSecret()
    expect(secret.length).toBeGreaterThanOrEqual(26)
    expect(secret).toMatch(/^[A-Z2-7]+$/)
  })

  it('generateTotp gera código de 6 dígitos', () => {
    const code = generateTotp(generateSecret())
    expect(code).toMatch(/^\d{6}$/)
  })

  it('verifyTotp aceita o código atual', () => {
    const secret = generateSecret()
    const now = Date.now()
    const code = generateTotp(secret, now)
    expect(verifyTotp(code, secret, now)).toBe(true)
  })

  it('verifyTotp aceita janela de ±1 período (30s)', () => {
    const secret = generateSecret()
    const now = Date.now()
    const code = generateTotp(secret, now - 30_000)
    expect(verifyTotp(code, secret, now)).toBe(true)
  })

  it('verifyTotp rejeita código expirado (fora da janela)', () => {
    const secret = generateSecret()
    const now = Date.now()
    const code = generateTotp(secret, now - 5 * 30_000)
    expect(verifyTotp(code, secret, now)).toBe(false)
  })

  it('verifyTotp rejeita código de outro secret', () => {
    const now = Date.now()
    const code = generateTotp(generateSecret(), now)
    expect(verifyTotp(code, generateSecret(), now)).toBe(false)
  })

  it('verifyTotp rejeita formato inválido', () => {
    const secret = generateSecret()
    expect(verifyTotp('12345', secret)).toBe(false)
    expect(verifyTotp('abcdef', secret)).toBe(false)
    expect(verifyTotp('', secret)).toBe(false)
  })

  it('otpauthUrl monta URL TOTP padrão', () => {
    const secret = generateSecret()
    const url = otpauthUrl(secret, 'dono@burger.com')
    expect(url).toContain('otpauth://totp/')
    expect(url).toContain(`secret=${secret}`)
    expect(url).toContain('issuer=MenuF')
    expect(url).toContain('digits=6')
    expect(url).toContain('period=30')
  })
})