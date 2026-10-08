import { describe, it, expect } from 'vitest'
import {
  calculateItemPrice,
  validateChoices,
  validateComponents,
  type ProductConfig,
  type ChoiceSelection,
  type ComponentSelection,
} from '../menuValidation'

function makeProduct(overrides: Partial<ProductConfig> = {}): ProductConfig {
  return {
    id: 'prod-1',
    price: 25.5,
    productType: 'simple',
    components: [],
    choiceGroups: [],
    ...overrides,
  }
}

function makeChoice(overrides: Partial<ChoiceSelection> = {}): ChoiceSelection {
  return {
    choiceGroupId: 'grp-1',
    choiceGroupName: 'Adicionais',
    optionId: 'opt-1',
    optionName: 'Bacon',
    quantity: 1,
    unitPrice: 3,
    inventoryItemId: null,
    deductStock: true,
    ...overrides,
  }
}

function makeComponent(overrides: Partial<ComponentSelection> = {}): ComponentSelection {
  return {
    componentId: 'comp-1',
    name: 'Pão',
    quantity: 1,
    unitPrice: 0,
    inventoryItemId: null,
    deductStock: true,
    ...overrides,
  }
}

describe('calculateItemPrice', () => {
  it('retorna o preço base do produto sem adicionais', () => {
    expect(calculateItemPrice(makeProduct(), [], [])).toBe(25.5)
  })

  it('soma componentes com preço por quantidade', () => {
    const components = [makeComponent({ unitPrice: 2, quantity: 3 })]
    expect(calculateItemPrice(makeProduct(), components, [])).toBe(25.5 + 6)
  })

  it('ignora componentes com preço zero', () => {
    const components = [makeComponent({ unitPrice: 0, quantity: 10 })]
    expect(calculateItemPrice(makeProduct(), components, [])).toBe(25.5)
  })

  it('soma choices com preço por quantidade', () => {
    const choices = [makeChoice({ unitPrice: 4, quantity: 2 })]
    expect(calculateItemPrice(makeProduct(), [], choices)).toBe(25.5 + 8)
  })

  it('soma componentes e choices juntos', () => {
    const components = [makeComponent({ unitPrice: 1.5, quantity: 2 })]
    const choices = [makeChoice({ unitPrice: 3, quantity: 1 })]
    expect(calculateItemPrice(makeProduct(), components, choices)).toBe(25.5 + 3 + 3)
  })
})

describe('validateChoices', () => {
  const group = {
    id: 'grp-1',
    name: 'Ponto da carne',
    minChoices: 1,
    maxChoices: 1,
    required: true,
    options: [
      { id: 'opt-1', name: 'Ao ponto', inventoryItemId: null, quantity: 1, price: 0, includedInPrice: true, deductStock: false, isDefault: false },
      { id: 'opt-2', name: 'Bem passado', inventoryItemId: null, quantity: 1, price: 0, includedInPrice: true, deductStock: false, isDefault: false },
    ],
  }

  it('aceita seleção válida', () => {
    const product = makeProduct({ choiceGroups: [group] })
    const choices = [makeChoice({ choiceGroupId: 'grp-1', optionId: 'opt-1' })]
    expect(validateChoices(product, choices)).toBeNull()
  })

  it('rejeita grupo obrigatório sem seleção', () => {
    const product = makeProduct({ choiceGroups: [group] })
    expect(validateChoices(product, [])).toContain('obrigatório')
  })

  it('rejeita acima do máximo de opções', () => {
    const product = makeProduct({ choiceGroups: [group] })
    const choices = [
      makeChoice({ choiceGroupId: 'grp-1', optionId: 'opt-1' }),
      makeChoice({ choiceGroupId: 'grp-1', optionId: 'opt-2' }),
    ]
    expect(validateChoices(product, choices)).toContain('no máximo')
  })

  it('rejeita opção inexistente no grupo', () => {
    const product = makeProduct({ choiceGroups: [group] })
    const choices = [makeChoice({ choiceGroupId: 'grp-1', optionId: 'opt-fake' })]
    expect(validateChoices(product, choices)).toContain('Opção inválida')
  })

  it('rejeita abaixo do mínimo', () => {
    const optionalGroup = { ...group, required: false, minChoices: 2, maxChoices: 2 }
    const product = makeProduct({ choiceGroups: [optionalGroup] })
    const choices = [makeChoice({ choiceGroupId: 'grp-1', optionId: 'opt-1' })]
    expect(validateChoices(product, choices)).toContain('no mínimo')
  })
})

describe('validateComponents', () => {
  it('aceita componente válido', () => {
    const product = makeProduct({
      components: [
        { id: 'comp-1', name: 'Pão', inventoryItemId: null, quantity: 1, price: 0, includedInPrice: true, deductStock: true, isDefault: true },
      ],
    })
    expect(validateComponents(product, [makeComponent({ componentId: 'comp-1' })])).toBeNull()
  })

  it('rejeita componente inexistente', () => {
    const product = makeProduct()
    expect(validateComponents(product, [makeComponent({ componentId: 'comp-fake' })])).toContain('inválido')
  })
})