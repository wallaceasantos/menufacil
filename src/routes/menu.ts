import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth'
import { extractTenant } from '../middleware/tenant'

const router = Router()

router.use(authenticate)
router.use(extractTenant)

function toNumber(value: any): number {
  return value === null || value === undefined ? 0 : Number(value)
}

function mapRecipe(r: any) {
  return {
    inventoryItemId: r.inventoryItemId,
    quantity: toNumber(r.quantity),
  }
}

function mapComponent(c: any) {
  return {
    id: c.id,
    name: c.name,
    inventoryItemId: c.inventoryItemId || undefined,
    quantity: toNumber(c.quantity),
    price: toNumber(c.price),
    includedInPrice: c.includedInPrice ?? true,
    deductStock: c.deductStock ?? true,
    isDefault: c.isDefault ?? true,
    sortOrder: c.sortOrder ?? 0,
  }
}

function mapOption(o: any) {
  return {
    id: o.id,
    name: o.name,
    inventoryItemId: o.inventoryItemId || undefined,
    quantity: toNumber(o.quantity),
    price: toNumber(o.price),
    includedInPrice: o.includedInPrice ?? false,
    deductStock: o.deductStock ?? true,
    isDefault: o.isDefault ?? false,
    sortOrder: o.sortOrder ?? 0,
  }
}

function mapGroup(g: any) {
  return {
    id: g.id,
    name: g.name,
    minChoices: g.minChoices ?? 0,
    maxChoices: g.maxChoices ?? 1,
    required: g.required ?? false,
    sortOrder: g.sortOrder ?? 0,
    options: (g.options || []).map(mapOption),
  }
}

function mapProduct(product: any, categoryName: string) {
  return {
    id: product.id,
    name: product.name,
    description: product.description || '',
    price: toNumber(product.price),
    category: categoryName,
    active: product.isActive ?? true,
    image: product.imageUrl || undefined,
    productType: product.productType || 'simple',
    autoDeductStock: product.autoDeductStock ?? true,
    recipe: (product.recipes || []).map(mapRecipe),
    components: (product.productComponents || []).map(mapComponent),
    choiceGroups: (product.productChoiceGroups || []).map(mapGroup),
  }
}

router.get('/', async (req, res, next) => {
  try {
    const tenant = req.tenant!

    const categories = await prisma.category.findMany({
      where: { tenantId: tenant.id },
      orderBy: { sortOrder: 'asc' },
      include: {
        products: {
          orderBy: { name: 'asc' },
          include: {
            productComponents: { orderBy: { sortOrder: 'asc' } },
            productChoiceGroups: {
              orderBy: { sortOrder: 'asc' },
              include: { options: { orderBy: { sortOrder: 'asc' } } },
            },
            recipes: { include: { inventoryItem: true } },
          },
        },
      },
    })

    const categoryNames = categories.map((c) => c.name)
    const categoryTimes: Record<string, { startTime: string | null; endTime: string | null }> = {}
    const categoryIds: Record<string, string> = {}
    categories.forEach((c) => {
      categoryIds[c.name] = c.id
      categoryTimes[c.name] = { startTime: c.startTime, endTime: c.endTime }
    })

    const items = categories.flatMap((category) =>
      category.products.map((product) => mapProduct(product, category.name))
    )

    res.json({ categories: categoryNames, categoryTimes, categoryIds, items })
  } catch (err) {
    next(err)
  }
})

router.post('/categories', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { name, sortOrder = 0, startTime, endTime } = req.body

    if (!name) {
      res.status(400).json({ error: 'Nome da categoria é obrigatório' })
      return
    }

    const existing = await prisma.category.findFirst({
      where: { tenantId: tenant.id, name },
    })

    if (existing) {
      res.status(409).json({ error: 'Categoria já existe' })
      return
    }

    const category = await prisma.category.create({
      data: { tenantId: tenant.id, name, sortOrder, startTime: startTime || null, endTime: endTime || null },
    })

    res.status(201).json(category)
  } catch (err) {
    next(err)
  }
})

router.patch('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    const { name, sortOrder, startTime, endTime } = req.body

    if (!name) {
      res.status(400).json({ error: 'Nome da categoria é obrigatório' })
      return
    }

    const data: any = { name }
    if (sortOrder !== undefined) data.sortOrder = sortOrder
    if (startTime !== undefined) data.startTime = startTime || null
    if (endTime !== undefined) data.endTime = endTime || null

    const category = await prisma.category.update({ where: { id }, data })
    res.json(category)
  } catch (err) {
    next(err)
  }
})

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.category.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

function buildComponentCreate(components: any[]) {
  return (components || []).map((c: any) => ({
    name: c.name,
    inventoryItemId: c.inventoryItemId || null,
    quantity: c.quantity ?? 1,
    price: c.price ?? 0,
    includedInPrice: c.includedInPrice ?? true,
    deductStock: c.deductStock ?? true,
    isDefault: c.isDefault ?? true,
    sortOrder: c.sortOrder ?? 0,
  }))
}

function buildGroupCreate(groups: any[]) {
  return (groups || []).map((g: any) => ({
    name: g.name,
    minChoices: g.minChoices ?? 0,
    maxChoices: g.maxChoices ?? 1,
    required: g.required ?? false,
    sortOrder: g.sortOrder ?? 0,
    options: {
      create: (g.options || []).map((o: any) => ({
        name: o.name,
        inventoryItemId: o.inventoryItemId || null,
        quantity: o.quantity ?? 1,
        price: o.price ?? 0,
        includedInPrice: o.includedInPrice ?? false,
        deductStock: o.deductStock ?? true,
        isDefault: o.isDefault ?? false,
        sortOrder: o.sortOrder ?? 0,
      })),
    },
  }))
}

async function resolveCategory(tenantId: string, categoryName: string) {
  let category = await prisma.category.findFirst({
    where: { tenantId, name: categoryName },
  })

  if (!category) {
    const maxOrder = await prisma.category.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    })

    category = await prisma.category.create({
      data: {
        tenantId,
        name: categoryName,
        sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
      },
    })
  }

  return category
}

router.post('/products', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const {
      name,
      description,
      price,
      category: categoryName,
      active,
      image,
      productType = 'simple',
      autoDeductStock,
      recipe,
      components,
      choiceGroups,
    } = req.body

    if (!name || price === undefined || !categoryName) {
      res.status(400).json({ error: 'Nome, preço e categoria são obrigatórios' })
      return
    }

    const category = await resolveCategory(tenant.id, categoryName)

    const product = await prisma.product.create({
      data: {
        tenantId: tenant.id,
        categoryId: category.id,
        name,
        description,
        price,
        productType,
        isActive: active,
        imageUrl: image,
        autoDeductStock,
        recipes: {
          create: (recipe || []).map((ing: any) => ({
            inventoryItemId: ing.inventoryItemId,
            quantity: ing.quantity,
          })),
        },
        productComponents: { create: buildComponentCreate(components) },
        productChoiceGroups: { create: buildGroupCreate(choiceGroups) },
      },
      include: {
        productComponents: true,
        productChoiceGroups: { include: { options: true } },
        recipes: true,
        category: true,
      },
    })

    res.status(201).json(mapProduct(product, product.category?.name || categoryName))
  } catch (err) {
    next(err)
  }
})

router.patch('/products/:id', async (req, res, next) => {
  try {
    const tenant = req.tenant!
    const { id } = req.params
    const {
      name,
      description,
      price,
      category: categoryName,
      active,
      image,
      productType,
      autoDeductStock,
      recipe,
      components,
      choiceGroups,
    } = req.body

    let categoryId = undefined
    if (categoryName) {
      const category = await resolveCategory(tenant.id, categoryName)
      categoryId = category.id
    }

    await prisma.$transaction([
      prisma.orderItemComponent.deleteMany({ where: { orderItem: { productId: id } } }),
      prisma.orderItemChoice.deleteMany({ where: { orderItem: { productId: id } } }),
      prisma.productRecipe.deleteMany({ where: { productId: id } }),
      prisma.productComponent.deleteMany({ where: { productId: id } }),
      prisma.productChoiceOption.deleteMany({
        where: { choiceGroup: { productId: id } },
      }),
      prisma.productChoiceGroup.deleteMany({ where: { productId: id } }),
    ])

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price,
        categoryId,
        productType,
        isActive: active,
        imageUrl: image,
        autoDeductStock,
        recipes: {
          create: (recipe || []).map((ing: any) => ({
            inventoryItemId: ing.inventoryItemId,
            quantity: ing.quantity,
          })),
        },
        productComponents: { create: buildComponentCreate(components) },
        productChoiceGroups: { create: buildGroupCreate(choiceGroups) },
      },
      include: {
        productComponents: true,
        productChoiceGroups: { include: { options: true } },
        recipes: true,
        category: true,
      },
    })

    res.json(mapProduct(product, product.category?.name || categoryName || ''))
  } catch (err) {
    next(err)
  }
})

router.delete('/products/:id', async (req, res, next) => {
  try {
    const { id } = req.params
    await prisma.product.delete({ where: { id } })
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

export default router
