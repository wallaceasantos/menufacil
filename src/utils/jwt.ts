import jwt from 'jsonwebtoken'
import { getJwtSecret } from './env'

const JWT_SECRET = getJwtSecret()

export interface TokenPayload {
  userId: string
  email: string
  role: string
  tenantId?: string | null
  twoFactorPending?: boolean
}

export function signToken(payload: TokenPayload, expiresIn: jwt.SignOptions['expiresIn'] = '7d'): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}
