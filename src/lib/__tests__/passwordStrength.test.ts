import { describe, it, expect } from 'vitest'
import { scorePassword } from '../passwordStrength'

describe('passwordStrength', () => {
  it('retorna vazio para senha vazia', () => {
    expect(scorePassword('')).toEqual({ score: 0, label: '' })
    expect(scorePassword('')).toEqual({ score: 0, label: '' })
  })

  it('marca como muito fraca abaixo de 8 caracteres', () => {
    expect(scorePassword('Ab1$')).toEqual({ score: 0, label: 'Muito fraca' })
    expect(scorePassword('abc1234').score).toBe(0)
  })

  it('penaliza senhas comuns', () => {
    expect(scorePassword('senha123').score).toBe(1)
    expect(scorePassword('password99').score).toBe(1)
  })

  it('avalia complexidade crescente', () => {
    expect(scorePassword('abcdefgh').score).toBe(1)
    expect(scorePassword('abcdefghij12').score).toBeGreaterThanOrEqual(2)
    expect(scorePassword('Abcdefghij12').score).toBeGreaterThanOrEqual(3)
    expect(scorePassword('Abcdefghij12!').score).toBe(4)
  })
})