import { registerHandler, enqueue } from '../lib/queue'
import { sendEmail } from '../lib/email'

export interface OutgoingEmail {
  to: string
  subject: string
  text: string
  html?: string
}

export function registerEmailJobs(): void {
  registerHandler('email:send', async (payload) => {
    const email = payload as unknown as OutgoingEmail
    const result = await sendEmail(email)
    if (!result.sent && result.reason !== 'smtp_not_configured') {
      throw new Error(`Falha ao enviar e-mail para ${email.to}`)
    }
  })
}

export function enqueueEmail(email: OutgoingEmail): void {
  enqueue('email:send', email as unknown as Record<string, unknown>).catch(() => {})
}