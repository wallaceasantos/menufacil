import crypto from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const PERIOD = 30
const DIGITS = 6

function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

function base32Decode(str: string): Buffer {
  const cleaned = str.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(out)
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0')
}

export function generateSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

export function generateTotp(secret: string, timestamp: number = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / PERIOD)
  return hotp(base32Decode(secret), counter)
}

export function verifyTotp(token: string, secret: string, timestamp: number = Date.now(), window = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false
  const counter = Math.floor(timestamp / 1000 / PERIOD)
  const secretBuf = base32Decode(secret)

  for (let i = -window; i <= window; i++) {
    if (crypto.timingSafeEqual(Buffer.from(hotp(secretBuf, counter + i)), Buffer.from(token))) {
      return true
    }
  }

  return false
}

export function otpauthUrl(secret: string, email: string, issuer = 'MenuFácil'): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${PERIOD}`
}