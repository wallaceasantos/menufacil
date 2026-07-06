export interface ChoiceSelection {
  choiceGroupId: string
  choiceGroupName: string
  optionId: string
  optionName: string
  quantity: number
  unitPrice: number
  inventoryItemId?: string | null
  deductStock: boolean
}

export interface ComponentSelection {
  componentId: string
  name: string
  quantity: number
  unitPrice: number
  inventoryItemId?: string | null
  deductStock: boolean
}

export interface OrderItemInput {
  productId: string
  quantity: number
  unitPrice: number
  notes?: string
  components?: ComponentSelection[]
  choices?: ChoiceSelection[]
}

export interface ProductOption {
  id: string
  name: string
  inventoryItemId?: string | null
  quantity: number
  price: number
  includedInPrice: boolean
  deductStock: boolean
  isDefault: boolean
}

export interface ProductChoiceGroup {
  id: string
  name: string
  minChoices: number
  maxChoices: number
  required: boolean
  options: ProductOption[]
}

export interface ProductComponent {
  id: string
  name: string
  inventoryItemId?: string | null
  quantity: number
  price: number
  includedInPrice: boolean
  deductStock: boolean
  isDefault: boolean
}

export interface ProductConfig {
  id: string
  price: number
  productType: string
  components: ProductComponent[]
  choiceGroups: ProductChoiceGroup[]
}

export function calculateItemPrice(
  product: ProductConfig,
  selectedComponents: ComponentSelection[],
  selectedChoices: ChoiceSelection[]
): number {
  const componentTotal = selectedComponents.reduce((sum, c) => {
    if (c.unitPrice > 0) return sum + c.unitPrice * c.quantity
    return sum
  }, 0)

  const choicesTotal = selectedChoices.reduce((sum, ch) => {
    if (ch.unitPrice > 0) return sum + ch.unitPrice * ch.quantity
    return sum
  }, 0)

  return Number(product.price) + componentTotal + choicesTotal
}

export function validateChoices(
  product: ProductConfig,
  selectedChoices: ChoiceSelection[]
): string | null {
  const byGroup = new Map<string, ChoiceSelection[]>()
  selectedChoices.forEach((ch) => {
    const list = byGroup.get(ch.choiceGroupId) || []
    list.push(ch)
    byGroup.set(ch.choiceGroupId, list)
  })

  for (const group of product.choiceGroups) {
    const selected = byGroup.get(group.id) || []
    const count = selected.reduce((sum, ch) => sum + ch.quantity, 0)

    if (group.required && count === 0) {
      return `O grupo "${group.name}" é obrigatório`
    }

    if (count < group.minChoices) {
      return `Selecione no mínimo ${group.minChoices} opção(ões) em "${group.name}"`
    }

    if (group.maxChoices > 0 && count > group.maxChoices) {
      return `Selecione no máximo ${group.maxChoices} opção(ões) em "${group.name}"`
    }

    for (const ch of selected) {
      const option = group.options.find((o) => o.id === ch.optionId)
      if (!option) {
        return `Opção inválida em "${group.name}"`
      }
    }
  }

  return null
}

export function validateComponents(
  product: ProductConfig,
  selectedComponents: ComponentSelection[]
): string | null {
  for (const c of selectedComponents) {
    const comp = product.components.find((pc) => pc.id === c.componentId)
    if (!comp) {
      return `Componente inválido: ${c.name}`
    }
  }
  return null
}
