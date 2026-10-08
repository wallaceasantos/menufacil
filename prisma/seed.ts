import { prisma } from '../src/lib/prisma'
import { hashPassword } from '../src/utils/password'

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.log('[Seed] ADMIN_EMAIL e ADMIN_INITIAL_PASSWORD não configurados. Pulando criação de admin.')
    return
  }

  const existing = await prisma.user.findFirst({ where: { email: adminEmail } })
  if (existing) {
    console.log(`[Seed] Admin ${adminEmail} já existe.`)
    return
  }

  await prisma.user.create({
    data: {
      name: 'Administrador',
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      role: 'admin',
    },
  })

  console.log(`[Seed] Admin ${adminEmail} criado com sucesso.`)
}

main()
  .catch((e) => {
    console.error('[Seed] Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
