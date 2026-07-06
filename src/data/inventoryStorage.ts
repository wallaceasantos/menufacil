import type {
  InventoryState,
  InventoryItem,
  InventoryBatch,
  ProductRecipe,
  StockMovement,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
} from './inventory';
import { calculateAverageCost, calculateRecipeCost } from './inventory';

const STORAGE_KEY = 'menufacil_inventory';

function getKey(slug: string): string {
  return `${STORAGE_KEY}_${slug}`;
}

export function getInventoryState(slug: string): InventoryState {
  if (typeof window === 'undefined') return { items: [], batches: [], movements: [], recipes: [], suppliers: [], purchaseOrders: [] };
  const stored = localStorage.getItem(getKey(slug));
  if (!stored) return { items: [], batches: [], movements: [], recipes: [], suppliers: [], purchaseOrders: [] };
  try {
    const parsed = JSON.parse(stored);
    return {
      items: parsed.items || [],
      batches: parsed.batches || [],
      movements: parsed.movements || [],
      recipes: parsed.recipes || [],
      suppliers: parsed.suppliers || [],
      purchaseOrders: parsed.purchaseOrders || [],
    };
  } catch {
    return { items: [], batches: [], movements: [], recipes: [], suppliers: [], purchaseOrders: [] };
  }
}

export function saveInventoryState(slug: string, state: InventoryState): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getKey(slug), JSON.stringify(state));
}

export function saveInventoryItem(slug: string, item: InventoryItem): void {
  const state = getInventoryState(slug);
  const existingIndex = state.items.findIndex((i) => i.id === item.id);
  if (existingIndex >= 0) {
    state.items[existingIndex] = item;
  } else {
    state.items.push(item);
  }
  saveInventoryState(slug, state);
}

export function deleteInventoryItem(slug: string, itemId: string): void {
  const state = getInventoryState(slug);
  state.items = state.items.filter((i) => i.id !== itemId);
  state.batches = state.batches.filter((b) => b.inventoryItemId !== itemId);
  // Remove recipes using this item
  state.recipes = state.recipes.map((recipe) => ({
    ...recipe,
    ingredients: recipe.ingredients.filter((ing) => ing.inventoryItemId !== itemId),
  }));
  saveInventoryState(slug, state);
}

/**
 * Reabastece o estoque a partir de uma compra recebida, criando lotes.
 */
export function receivePurchaseOrder(slug: string, purchaseOrderId: string): PurchaseOrder | null {
  const state = getInventoryState(slug);
  const orderIndex = state.purchaseOrders.findIndex((po) => po.id === purchaseOrderId);
  if (orderIndex < 0) return null;
  const order = state.purchaseOrders[orderIndex];
  if (order.status !== 'pendente') return order;

  order.items.forEach((poItem) => {
    const item = state.items.find((i) => i.id === poItem.inventoryItemId);
    if (!item) return;

    const batchId = Math.random().toString(36).substr(2, 9);
    const batch: InventoryBatch = {
      id: batchId,
      inventoryItemId: poItem.inventoryItemId,
      quantity: poItem.quantity,
      remainingQuantity: poItem.quantity,
      unitCost: poItem.unitCost,
      expirationDate: poItem.expirationDate,
      manufacturingDate: poItem.manufacturingDate,
      supplierId: order.supplierId,
      purchaseOrderId: order.id,
      createdAt: new Date().toISOString(),
    };
    state.batches.push(batch);

    // Atualiza custo médio do insumo
    item.currentStock += poItem.quantity;
    item.averageCost = calculateAverageCost(item, state.batches);

    const movement: StockMovement = {
      id: Math.random().toString(36).substr(2, 9),
      inventoryItemId: item.id,
      type: 'entrada',
      quantity: poItem.quantity,
      reason: `Recebimento da compra ${order.id}`,
      createdAt: new Date().toISOString(),
      batchId,
    };
    state.movements.unshift(movement);
  });

  order.status = 'recebido';
  order.receivedAt = new Date().toISOString();
  state.purchaseOrders[orderIndex] = order;

  saveInventoryState(slug, state);
  return order;
}

export function addStockMovement(slug: string, movement: StockMovement): void {
  const state = getInventoryState(slug);
  const item = state.items.find((i) => i.id === movement.inventoryItemId);
  if (!item) return;

  switch (movement.type) {
    case 'entrada':
      item.currentStock += movement.quantity;
      break;
    case 'saida':
      deductFromBatches(state, item, movement.quantity, movement.id);
      item.currentStock -= movement.quantity;
      break;
    case 'perda':
      deductFromBatches(state, item, movement.quantity, movement.id);
      item.currentStock -= movement.quantity;
      break;
    case 'ajuste':
      item.currentStock = movement.quantity;
      break;
  }

  item.averageCost = calculateAverageCost(item, state.batches);
  state.movements.unshift(movement);
  saveInventoryState(slug, state);
}

/**
 * Desconta quantidade dos lotes mais antigos (FIFO).
 */
function deductFromBatches(state: InventoryState, item: InventoryItem, quantity: number, movementId: string): void {
  let remaining = quantity;
  const itemBatches = state.batches
    .filter((b) => b.inventoryItemId === item.id && b.remainingQuantity > 0)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  for (const batch of itemBatches) {
    if (remaining <= 0) break;
    const deduct = Math.min(batch.remainingQuantity, remaining);
    batch.remainingQuantity -= deduct;
    remaining -= deduct;
  }
}

export function saveProductRecipe(slug: string, recipe: ProductRecipe): void {
  const state = getInventoryState(slug);
  const existingIndex = state.recipes.findIndex((r) => r.productId === recipe.productId);
  if (existingIndex >= 0) {
    state.recipes[existingIndex] = recipe;
  } else {
    state.recipes.push(recipe);
  }
  saveInventoryState(slug, state);
}

export function getProductRecipe(slug: string, productId: string): ProductRecipe | undefined {
  const state = getInventoryState(slug);
  return state.recipes.find((r) => r.productId === productId);
}

export function getLowStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => item.currentStock > 0 && item.currentStock <= item.minStock);
}

export function getOutOfStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => item.currentStock <= 0);
}

/**
 * Desconta o estoque de acordo com a receita de cada produto vendido.
 * Utiliza FIFO nos lotes.
 * Retorna os itens que ficaram negativos (se houver).
 */
export function deductStockForOrder(
  slug: string,
  productQuantities: Record<string, number>
): { item: InventoryItem; missing: number }[] {
  const state = getInventoryState(slug);
  const negativeItems: { item: InventoryItem; missing: number }[] = [];

  // Calcula o total necessário por insumo
  const neededByItem: Record<string, number> = {};

  Object.entries(productQuantities).forEach(([productId, qty]) => {
    const recipe = state.recipes.find((r) => r.productId === productId);
    if (!recipe || recipe.autoDeduct === false) return;
    recipe.ingredients.forEach((ing) => {
      neededByItem[ing.inventoryItemId] = (neededByItem[ing.inventoryItemId] || 0) + ing.quantity * qty;
    });
  });

  Object.entries(neededByItem).forEach(([itemId, needed]) => {
    const item = state.items.find((i) => i.id === itemId);
    if (!item) return;
    const beforeStock = item.currentStock;
    item.currentStock -= needed;
    deductFromBatches(state, item, needed, `order-${Date.now()}`);
    item.averageCost = calculateAverageCost(item, state.batches);
    if (item.currentStock < 0) {
      negativeItems.push({ item: { ...item, currentStock: beforeStock }, missing: Math.abs(item.currentStock) });
    }
  });

  saveInventoryState(slug, state);
  return negativeItems;
}

export function saveSupplier(slug: string, supplier: Supplier): void {
  const state = getInventoryState(slug);
  const existingIndex = state.suppliers.findIndex((s) => s.id === supplier.id);
  if (existingIndex >= 0) {
    state.suppliers[existingIndex] = supplier;
  } else {
    state.suppliers.push(supplier);
  }
  saveInventoryState(slug, state);
}

export function deleteSupplier(slug: string, supplierId: string): void {
  const state = getInventoryState(slug);
  state.suppliers = state.suppliers.filter((s) => s.id !== supplierId);
  saveInventoryState(slug, state);
}

export function savePurchaseOrder(slug: string, order: PurchaseOrder): void {
  const state = getInventoryState(slug);
  const existingIndex = state.purchaseOrders.findIndex((po) => po.id === order.id);
  if (existingIndex >= 0) {
    state.purchaseOrders[existingIndex] = order;
  } else {
    state.purchaseOrders.push(order);
  }
  saveInventoryState(slug, state);
}

export function deletePurchaseOrder(slug: string, orderId: string): void {
  const state = getInventoryState(slug);
  state.purchaseOrders = state.purchaseOrders.filter((po) => po.id !== orderId);
  saveInventoryState(slug, state);
}

export function calculatePurchaseTotal(items: PurchaseOrderItem[]): number {
  return items.reduce((acc, item) => acc + item.quantity * item.unitCost, 0);
}

/**
 * Calcula o custo total de insumos para um pedido com base nas receitas.
 */
export function calculateOrderCost(
  slug: string,
  productQuantities: Record<string, number>
): number {
  const state = getInventoryState(slug);
  let totalCost = 0;

  Object.entries(productQuantities).forEach(([productId, qty]) => {
    const recipe = state.recipes.find((r) => r.productId === productId);
    if (!recipe || recipe.autoDeduct === false) return;
    totalCost += calculateRecipeCost(recipe.ingredients, state.items, state.batches) * qty;
  });

  return totalCost;
}
