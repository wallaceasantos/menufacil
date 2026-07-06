import { prisma } from '../src/lib/prisma'

async function main() {
  // Set default productType for existing products
  await prisma.$executeRawUnsafe(`UPDATE products SET product_type = 'simple' WHERE product_type IS NULL OR product_type = ''`)

  // Migrate product_complements to a default "Adicionais" choice group per product
  const complements = await prisma.$queryRawUnsafe<Array<{ id: string; product_id: string; name: string; price: string }>>(
    `SELECT id, product_id, name, price FROM product_complements ORDER BY product_id, created_at`
  )

  const groupsByProduct = new Map<string, string>()

  for (const comp of complements) {
    let groupId = groupsByProduct.get(comp.product_id)
    if (!groupId) {
      const groupResult = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
        `INSERT INTO product_choice_groups (id, product_id, name, min_choices, max_choices, required, sort_order, created_at)
         VALUES (gen_random_uuid(), $1::uuid, 'Adicionais', 0, 99, false, 0, NOW())
         RETURNING id`,
        comp.product_id
      )
      groupId = groupResult[0].id
      groupsByProduct.set(comp.product_id, groupId)
    }

    await prisma.$executeRawUnsafe(
      `INSERT INTO product_choice_options (id, choice_group_id, name, inventory_item_id, quantity, price, included_in_price, deduct_stock, is_default, sort_order, created_at)
       VALUES (gen_random_uuid(), $1::uuid, $2, NULL, 1, $3::numeric, false, false, false, 0, NOW())`,
      groupId,
      comp.name,
      comp.price
    )
  }

  console.log(`Migrated ${complements.length} complements into choice groups`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
