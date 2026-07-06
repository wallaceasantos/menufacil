/**
 * Modelos e helpers para controle de estoque (plano Completo).
 */

export type InventoryUnit = 'un' | 'kg' | 'g' | 'l' | 'ml';

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface InventoryBatch {
  id: string;
  inventoryItemId: string;
  quantity: number;
  remainingQuantity: number;
  unitCost: number;
  expirationDate?: string;
  manufacturingDate?: string;
  supplierId?: string;
  purchaseOrderId?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: InventoryUnit;
  currentStock: number;
  minStock: number;
  cost?: number;
  averageCost?: number;
  markup?: number;
}

export interface PurchaseOrderItem {
  inventoryItemId: string;
  quantity: number;
  unitCost: number;
  expirationDate?: string;
  manufacturingDate?: string;
}

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  items: PurchaseOrderItem[];
  status: 'pendente' | 'recebido' | 'cancelado';
  totalCost: number;
  notes?: string;
  createdAt: string;
  receivedAt?: string;
}

export interface RecipeIngredient {
  inventoryItemId: string;
  quantity: number;
}

export interface ProductRecipe {
  productId: string;
  ingredients: RecipeIngredient[];
  // Se false, o desconto automático não será aplicado a este produto
  autoDeduct?: boolean;
}

export type StockMovementType = 'entrada' | 'saida' | 'ajuste' | 'perda';

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  createdAt: string;
  orderId?: string;
  batchId?: string;
}

export interface InventoryState {
  items: InventoryItem[];
  batches: InventoryBatch[];
  movements: StockMovement[];
  recipes: ProductRecipe[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
}

export function formatUnit(quantity: number, unit: InventoryUnit): string {
  const formatted = quantity.toLocaleString('pt-BR', {
    minimumFractionDigits: unit === 'un' ? 0 : 2,
    maximumFractionDigits: unit === 'un' ? 0 : 3,
  });
  return `${formatted} ${unit}`;
}

export function getItemStatus(item: InventoryItem): 'ok' | 'low' | 'out' {
  if (item.currentStock <= 0) return 'out';
  if (item.currentStock <= item.minStock) return 'low';
  return 'ok';
}

export function getInventoryValue(items: InventoryItem[]): number {
  return items.reduce((acc, item) => acc + (item.currentStock * (item.averageCost || item.cost || 0)), 0);
}

/**
 * Calcula o custo médio ponderado de um insumo considerando lotes em estoque.
 */
export function calculateAverageCost(item: InventoryItem, batches: InventoryBatch[]): number {
  const inStockBatches = batches.filter(
    (b) => b.inventoryItemId === item.id && b.remainingQuantity > 0
  );
  if (inStockBatches.length === 0) return item.averageCost || item.cost || 0;
  const totalValue = inStockBatches.reduce((acc, b) => acc + b.remainingQuantity * b.unitCost, 0);
  const totalQuantity = inStockBatches.reduce((acc, b) => acc + b.remainingQuantity, 0);
  return totalQuantity > 0 ? totalValue / totalQuantity : 0;
}

/**
 * Calcula o custo de uma receita com base no custo médio dos insumos.
 */
export function calculateRecipeCost(
  ingredients: RecipeIngredient[],
  items: InventoryItem[],
  batches: InventoryBatch[]
): number {
  return ingredients.reduce((acc, ingredient) => {
    const item = items.find((i) => i.id === ingredient.inventoryItemId);
    if (!item) return acc;
    const avgCost = calculateAverageCost(item, batches);
    return acc + ingredient.quantity * avgCost;
  }, 0);
}

/**
 * Sugere preço de venda com base no custo e markup desejado.
 */
export function suggestSalePrice(cost: number, markup: number = 2.5): number {
  return cost * markup;
}

export function getLowStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => item.currentStock > 0 && item.currentStock <= item.minStock);
}

export function getOutOfStockItems(items: InventoryItem[]): InventoryItem[] {
  return items.filter((item) => item.currentStock <= 0);
}

/**
 * Retorna lotes próximos do vencimento (próximos 7 dias) ou já vencidos.
 */
export function getExpiringBatches(batches: InventoryBatch[]): InventoryBatch[] {
  const now = new Date();
  const warningDate = new Date();
  warningDate.setDate(now.getDate() + 7);
  return batches.filter(
    (b) =>
      b.remainingQuantity > 0 &&
      b.expirationDate &&
      new Date(b.expirationDate) <= warningDate
  );
}

export function isBatchExpired(batch: InventoryBatch): boolean {
  if (!batch.expirationDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(batch.expirationDate) < today;
}
