import type { TokenPayload } from '../utils/jwt'
import type { Tenant } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
      tenant?: Tenant
    }
  }
}
