import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'menufacil-dev-secret'

export interface TokenPayload {
  userId: string
  email: string
  role: string
  tenantId?: string | null
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}
