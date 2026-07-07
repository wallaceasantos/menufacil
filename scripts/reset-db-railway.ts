import readline from 'node:readline'
import { prisma } from '../src/lib/prisma'
import { hashPassword } from '../src/utils/password'

const ADMIN_EMAIL = 'admin@menufacil.com'
const ADMIN_PASSWORD = 'S100cem%'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })
}

async function countRows() {
  const [
    tenants,
    users,
    customers,
    orders,
    products,
    categories,
    inventoryItems,
    suppliers,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count(),
    prisma.customer.count(),
    prisma.order.count(),
    prisma.product.count(),
    prisma.category.count(),
    prisma.inventoryItem.count(),
    prisma.supplier.count(),
  ])

  return {
    tenants,
    users,
    customers,
    orders,
    products,
    categories,
    inventoryItems,
    suppliers,
  }
}

async function resetDatabase() {
  console.log('\n🔌 Conectando ao banco de dados...')
  console.log(`   URL: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@') || '(não definida)'}`)

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL não está definida.\nExemplo:\n  DATABASE_URL="postgres://..." npx tsx scripts/reset-db-railway.ts')
  }

  const before = await countRows()
  console.log('\n📊 Dados encontrados:')
  console.log(`   Lojas (tenants):   ${before.tenants}`)
  console.log(`   Usuários:          ${before.users}`)
  console.log(`   Clientes:          ${before.customers}`)
  console.log(`   Pedidos:           ${before.orders}`)
  console.log(`   Produtos:          ${before.products}`)
  console.log(`   Categorias:        ${before.categories}`)
  console.log(`   Itens de estoque:  ${before.inventoryItems}`)
  console.log(`   Fornecedores:      ${before.suppliers}`)

  const confirm1 = await ask('\n⚠️  Tem certeza que deseja APAGAR TODOS OS DADOS? (digite APAGAR): ')
  if (confirm1 !== 'APAGAR') {
    console.log('❌ Operação cancelada.')
    return
  }

  const confirm2 = await ask('⚠️  Esta ação é irreversível. Confirme novamente (digite SIM): ')
  if (confirm2 !== 'SIM') {
    console.log('❌ Operação cancelada.')
    return
  }

  console.log('\n🧹 Iniciando limpeza do banco...')

  // Delete child records first, respecting foreign keys
  await prisma.order_item_complements.deleteMany()
  await prisma.product_complements.deleteMany()
  await prisma.stockMovement.deleteMany()
  await prisma.inventoryBatch.deleteMany()
  await prisma.purchaseOrderItem.deleteMany()
  await prisma.purchaseOrder.deleteMany()
  await prisma.productRecipe.deleteMany()
  await prisma.productChoiceOption.deleteMany()
  await prisma.productChoiceGroup.deleteMany()
  await prisma.productComponent.deleteMany()
  await prisma.orderItemComponent.deleteMany()
  await prisma.orderItemChoice.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.printJob.deleteMany()
  await prisma.printerConfig.deleteMany()
  await prisma.pushSubscription.deleteMany()
  await prisma.ticketAttachment.deleteMany()
  await prisma.ticketMessage.deleteMany()
  await prisma.supportTicket.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.planChangeLog.deleteMany()
  await prisma.discount.deleteMany()
  await prisma.deliveryZone.deleteMany()
  await prisma.order.deleteMany()
  await prisma.product.deleteMany()
  await prisma.category.deleteMany()
  await prisma.inventoryItem.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.invite.deleteMany()
  await prisma.whatsAppConfig.deleteMany()
  await prisma.paymentConfig.deleteMany()
  await prisma.user.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.globalAnnouncement.deleteMany()

  console.log('✅ Dados removidos.')

  console.log('\n👤 Criando administrador padrão...')
  const passwordHash = await hashPassword(ADMIN_PASSWORD)
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: ADMIN_EMAIL,
      passwordHash,
      role: 'admin',
    },
  })

  const after = await countRows()
  console.log('\n📊 Banco após reset:')
  console.log(`   Lojas (tenants):   ${after.tenants}`)
  console.log(`   Usuários:          ${after.users}`)

  console.log('\n✅ Reset concluído com sucesso!')
  console.log(`   E-mail: ${ADMIN_EMAIL}`)
  console.log(`   Senha:  ${ADMIN_PASSWORD}`)
}

resetDatabase()
  .catch((err) => {
    console.error('\n❌ Erro ao resetar banco:', err.message)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    rl.close()
  })
