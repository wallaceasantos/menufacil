import { describe, it, expect } from 'vitest'
import { registerHandler, enqueue } from '../queue'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('queue', () => {
  it('reenfileira job com falha até dar certo', async () => {
    let calls = 0
    registerHandler('test:retry-ok', async () => {
      calls += 1
      if (calls < 3) throw new Error('falha temporária')
    })

    await enqueue('test:retry-ok', { hello: 'world' }, { maxAttempts: 3 })
    await wait(3000)

    expect(calls).toBe(3)
  })

  it('descarta o job após esgotar as tentativas', async () => {
    let calls = 0
    registerHandler('test:retry-fail', async () => {
      calls += 1
      throw new Error('sempre falha')
    })

    await enqueue('test:retry-fail', {}, { maxAttempts: 2 })
    await wait(3000)

    expect(calls).toBe(2)
  })

  it('processa job sem erro uma única vez', async () => {
    let calls = 0
    registerHandler('test:ok', async () => {
      calls += 1
    })

    await enqueue('test:ok', {})
    await wait(500)

    expect(calls).toBe(1)
  })
})