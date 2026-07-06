// @ts-nocheck
import { prisma } from '../src/lib/prisma'

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-house' } })
  if (!tenant) return

  await prisma.orderItemComponent.deleteMany({})
  await prisma.orderItemChoice.deleteMany({})
  await prisma.orderItem.deleteMany({})
  await prisma.order.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.productComplement.deleteMany({ where: { product: { tenantId: tenant.id } } })
  await prisma.productRecipe.deleteMany({ where: { product: { tenantId: tenant.id } } })
  await prisma.productComponent.deleteMany({ where: { product: { tenantId: tenant.id } } })
  await prisma.productChoiceOption.deleteMany({ where: { choiceGroup: { product: { tenantId: tenant.id } } } })
  await prisma.productChoiceGroup.deleteMany({ where: { product: { tenantId: tenant.id } } })
  await prisma.product.deleteMany({ where: { tenantId: tenant.id } })
  await prisma.category.deleteMany({ where: { tenantId: tenant.id } })

  const lanches = await prisma.category.create({
    data: { tenantId: tenant.id, name: 'Lanches', sortOrder: 0 },
  })

  const bebidas = await prisma.category.create({
    data: { tenantId: tenant.id, name: 'Bebidas', sortOrder: 1 },
  })

  const xburger = await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: lanches.id,
      name: 'X-Burger Artesanal',
      description: 'Pão brioche, blend 180g, queijo cheddar, maionese da casa.',
      price: 32.90,
      isActive: true,
    },
  })

  await prisma.productComplement.createMany({
    data: [
      { productId: xburger.id, name: 'Bacon Extra', price: 4.50 },
      { productId: xburger.id, name: 'Hambúrguer Extra', price: 9.90 },
      { productId: xburger.id, name: 'Cebola Caramelizada', price: 3.50 },
    ],
  })

  await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: lanches.id,
      name: 'X-Bacon',
      description: 'Pão brioche, blend 180g, muito bacon, queijo prato.',
      price: 38.90,
      isActive: true,
    },
  })

  await prisma.product.create({
    data: {
      tenantId: tenant.id,
      categoryId: bebidas.id,
      name: 'Refrigerante Cola 350ml',
      description: 'Lata 350ml gelada.',
      price: 6.00,
      isActive: true,
    },
  })

  console.log('Dados de teste limpos e recriados!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
