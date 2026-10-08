import { describe, it, expect } from 'vitest'
import { isValidCpf, sanitizeCpf, maskCpf } from '../cpf'

describe('sanitizeCpf', () => {
  it('remove formatação', () => {
    expect(sanitizeCpf('111.444.777-35')).toBe('11144477735')
    expect(sanitizeCpf('11144477735')).toBe('11144477735')
  })
})

describe('isValidCpf', () => {
  it('aceita CPF válido com máscara', () => {
    expect(isValidCpf('111.444.777-35')).toBe(true)
  })

  it('aceita CPF válido sem máscara', () => {
    expect(isValidCpf('11144477735')).toBe(true)
  })

  it('rejeita dígito verificador errado', () => {
    expect(isValidCpf('123.456.789-00')).toBe(false)
    expect(isValidCpf('11144477736')).toBe(false)
  })

  it('rejeita CPFs com todos os dígitos iguais', () => {
    expect(isValidCpf('00000000000')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('99999999999')).toBe(false)
  })

  it('rejeita tamanho diferente de 11', () => {
    expect(isValidCpf('1234567890')).toBe(false)
    expect(isValidCpf('123456789012')).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })
})

describe('maskCpf', () => {
  it('aplica máscara progressiva', () => {
    expect(maskCpf('111')).toBe('111')
    expect(maskCpf('111444')).toBe('111.444')
    expect(maskCpf('111444777')).toBe('111.444.777')
    expect(maskCpf('11144477735')).toBe('111.444.777-35')
    expect(maskCpf('11144477735999')).toBe('111.444.777-35')
  })
})