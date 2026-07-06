// @ts-nocheck
import { prisma } from '../src/lib/prisma'
import { hashPassword } from '../src/utils/password'

async function main() {
  let tenant = await prisma.tenant.findUnique({ where: { slug: 'burger-house' } })

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        slug: 'burger-house',
        name: 'Burger House',
        type: 'hamburgueria',
        email: 'contato@burgerhouse.com',
        plan: 'completo',
        description: 'Os melhores hambúrgueres artesanais da cidade.',
        address: 'Rua das Flores, 123 - Centro',
        phone: '5511987654321',
        deliveryFee: 5,
        minOrder: 10,
        openingHours: new Date('1970-01-01T18:00:00Z'),
        closingHours: new Date('1970-01-01T23:59:00Z'),
      },
    })
  } else {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        description: 'Os melhores hambúrgueres artesanais da cidade.',
        address: 'Rua das Flores, 123 - Centro',
        phone: '5511987654321',
        deliveryFee: 5,
        minOrder: 10,
        openingHours: new Date('1970-01-01T18:00:00Z'),
        closingHours: new Date('1970-01-01T23:59:00Z'),
      },
    })
  }

  // Criar usuário tenant vinculado ao Burger House
  let tenantUser = await prisma.user.findFirst({ where: { email: 'lojista@burgerhouse.com' } })
  if (!tenantUser) {
    const passwordHash = await hashPassword('123456')
    tenantUser = await prisma.user.create({
      data: {
        name: 'Lojista Burger House',
        email: 'lojista@burgerhouse.com',
        passwordHash,
        role: 'tenant',
        tenantId: tenant.id,
      },
    })
  }

  const lanches = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      name: 'Lanches',
      sortOrder: 0,
    },
  })

  const bebidas = await prisma.category.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      name: 'Bebidas',
      sortOrder: 1,
    },
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

  const extrasGroup = await prisma.productChoiceGroup.create({
    data: {
      productId: xburger.id,
      name: 'Adicionais',
      minChoices: 0,
      maxChoices: 99,
      required: false,
    },
  })

  await prisma.productChoiceOption.createMany({
    data: [
      { choiceGroupId: extrasGroup.id, name: 'Bacon Extra', price: 4.50, includedInPrice: false },
      { choiceGroupId: extrasGroup.id, name: 'Hambúrguer Extra', price: 9.90, includedInPrice: false },
      { choiceGroupId: extrasGroup.id, name: 'Cebola Caramelizada', price: 3.50, includedInPrice: false },
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

  console.log('Dados de teste criados com sucesso!')
  console.log('Usuário tenant: lojista@burgerhouse.com / 123456')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
