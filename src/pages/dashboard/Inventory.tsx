import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  Package,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  X,
  TrendingDown,
  Archive,
  DollarSign,
  ChefHat,
  ArrowRight,
  Crown,
  Truck,
  ShoppingCart,
  Calendar,
  Tag,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { FeatureGate } from '../../components/FeatureGate';
import { LockedFeatureModal } from '../../components/LockedFeatureModal';
import { getTenantSlug } from '../../data/tenantStorage';
import { apiWithTenant } from '../../lib/api';
import { calculatePurchaseTotal } from '../../data/inventoryStorage';
import {
  getInventoryValue,
  calculateAverageCost,
  calculateRecipeCost,
  suggestSalePrice,
  getExpiringBatches,
  isBatchExpired,
  getLowStockItems,
  getOutOfStockItems,
} from '../../data/inventory';
import type {
  InventoryItem,
  InventoryUnit,
  InventoryBatch,
  StockMovement,
  StockMovementType,
  Supplier,
  PurchaseOrder,
  PurchaseOrderItem,
  ProductRecipe,
} from '../../data/inventory';
import { formatUnit, getItemStatus } from '../../data/inventory';

const UNITS: { value: InventoryUnit; label: string }[] = [
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilograma' },
  { value: 'g', label: 'Grama' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
];

const MOVEMENT_TYPES: { value: StockMovementType; label: string; sign: number }[] = [
  { value: 'entrada', label: 'Entrada', sign: 1 },
  { value: 'saida', label: 'Saída', sign: -1 },
  { value: 'ajuste', label: 'Ajuste', sign: 0 },
  { value: 'perda', label: 'Perda', sign: -1 },
];

export function Inventory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const slug = getTenantSlug(user);
  const [activeTab, setActiveTab] = useState<'stock' | 'movements' | 'suppliers' | 'purchases' | 'reports'>('stock');
  const [searchTerm, setSearchTerm] = useState('');
  const [state, setState] = useState<{
    items: InventoryItem[];
    batches: InventoryBatch[];
    movements: StockMovement[];
    recipes: ProductRecipe[];
    suppliers: Supplier[];
    purchaseOrders: PurchaseOrder[];
  }>({ items: [], batches: [], movements: [], recipes: [], suppliers: [], purchaseOrders: [] });
  const [loading, setLoading] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [productInfo, setProductInfo] = useState<Record<string, { name: string; price: number }>>({});

  // Item Modal
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState<Omit<InventoryItem, 'id'>>({
    name: '',
    unit: 'un',
    currentStock: 0,
    minStock: 0,
    cost: 0,
    averageCost: 0,
    markup: 2.5,
  });

  // Movement Modal
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movementForm, setMovementForm] = useState<{
    type: StockMovementType;
    quantity: number;
    reason: string;
  }>({ type: 'entrada', quantity: 0, reason: '' });

  // Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState<Omit<Supplier, 'id'>>({ name: '' });

  // Purchase Order Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<PurchaseOrder | null>(null);
  const [purchaseForm, setPurchaseForm] = useState<{
    supplierId: string;
    notes: string;
    items: PurchaseOrderItem[];
  }>({ supplierId: '', notes: '', items: [] });

  const loadState = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const [data, menuData] = await Promise.all([
        apiWithTenant('/inventory', slug) as Promise<any>,
        apiWithTenant('/menu', slug).catch(() => null) as Promise<any>,
      ]);
      setState({
        items: data.items || [],
        batches: data.batches || [],
        movements: data.movements || [],
        recipes: data.recipes || [],
        suppliers: data.suppliers || [],
        purchaseOrders: data.purchaseOrders || [],
      });
      if (menuData?.items) {
        const info: Record<string, { name: string; price: number }> = {};
        menuData.items.forEach((item: any) => {
          info[item.id] = { name: item.name, price: item.price };
        });
        setProductInfo(info);
      }
    } catch {
      toast.error('Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadState();
  }, [slug]);

  const refresh = () => loadState();

  const filteredItems = useMemo(() => {
    return state.items.filter((item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [state.items, searchTerm]);

  const lowStockItems = useMemo(() => getLowStockItems(state.items), [state.items]);
  const outOfStockItems = useMemo(() => getOutOfStockItems(state.items), [state.items]);
  const inventoryValue = useMemo(() => getInventoryValue(state.items), [state.items]);
  const expiringBatches = useMemo(() => getExpiringBatches(state.batches), [state.batches]);

  // Item handlers
  const openItemModal = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        name: item.name,
        unit: item.unit,
        currentStock: item.currentStock,
        minStock: item.minStock,
        cost: item.cost || 0,
        averageCost: item.averageCost || 0,
        markup: item.markup || 2.5,
      });
    } else {
      setEditingItem(null);
      setItemForm({ name: '', unit: 'un', currentStock: 0, minStock: 0, cost: 0, averageCost: 0, markup: 2.5 });
    }
    setIsItemModalOpen(true);
  };

  const closeItemModal = () => {
    setIsItemModalOpen(false);
    setEditingItem(null);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name.trim() || !slug) return;

    try {
      if (editingItem) {
        await apiWithTenant(`/inventory/items/${editingItem.id}`, slug, {
          method: 'PATCH',
          body: JSON.stringify(itemForm),
        });
        toast.success('Insumo atualizado!');
      } else {
        await apiWithTenant('/inventory/items', slug, {
          method: 'POST',
          body: JSON.stringify(itemForm),
        });
        toast.success('Insumo cadastrado!');
      }
      await refresh();
      closeItemModal();
    } catch {
      toast.error('Erro ao salvar insumo');
    }
  };

  const handleDeleteItem = async (item: InventoryItem) => {
    if (!confirm(`Excluir o insumo "${item.name}"? Isso também remove ele das receitas.`)) return;
    try {
      await apiWithTenant(`/inventory/items/${item.id}`, slug, { method: 'DELETE' });
      await refresh();
      toast.success('Insumo removido.');
    } catch {
      toast.error('Erro ao remover insumo');
    }
  };

  // Movement handlers
  const openMovementModal = (item: InventoryItem, type: StockMovementType = 'entrada') => {
    setMovementItem(item);
    setMovementForm({ type, quantity: 0, reason: '' });
    setIsMovementModalOpen(true);
  };

  const closeMovementModal = () => {
    setIsMovementModalOpen(false);
    setMovementItem(null);
  };

  const handleSaveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementItem || !slug) return;

    try {
      await apiWithTenant('/inventory/movements', slug, {
        method: 'POST',
        body: JSON.stringify({
          inventoryItemId: movementItem.id,
          type: movementForm.type,
          quantity: movementForm.quantity,
          reason: movementForm.reason,
        }),
      });
      await refresh();
      closeMovementModal();
      toast.success('Movimentação registrada!');
    } catch {
      toast.error('Erro ao registrar movimentação');
    }
  };

  // Supplier handlers
  const openSupplierModal = (supplier?: Supplier) => {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupplierForm({ name: supplier.name, phone: supplier.phone, email: supplier.email, address: supplier.address });
    } else {
      setEditingSupplier(null);
      setSupplierForm({ name: '' });
    }
    setIsSupplierModalOpen(true);
  };

  const closeSupplierModal = () => {
    setIsSupplierModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.name.trim() || !slug) return;
    try {
      await apiWithTenant('/inventory/suppliers', slug, {
        method: 'POST',
        body: JSON.stringify({
          ...supplierForm,
          id: editingSupplier?.id,
        }),
      });
      await refresh();
      closeSupplierModal();
      toast.success(editingSupplier ? 'Fornecedor atualizado!' : 'Fornecedor cadastrado!');
    } catch {
      toast.error('Erro ao salvar fornecedor');
    }
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`Excluir o fornecedor "${supplier.name}"?`)) return;
    try {
      await apiWithTenant(`/inventory/suppliers/${supplier.id}`, slug, { method: 'DELETE' });
      await refresh();
      toast.success('Fornecedor removido.');
    } catch {
      toast.error('Erro ao remover fornecedor');
    }
  };

  // Purchase handlers
  const openPurchaseModal = (purchase?: PurchaseOrder) => {
    if (purchase) {
      setEditingPurchase(purchase);
      setPurchaseForm({ supplierId: purchase.supplierId, notes: purchase.notes || '', items: purchase.items });
    } else {
      setEditingPurchase(null);
      setPurchaseForm({ supplierId: state.suppliers[0]?.id || '', notes: '', items: [] });
    }
    setIsPurchaseModalOpen(true);
  };

  const closePurchaseModal = () => {
    setIsPurchaseModalOpen(false);
    setEditingPurchase(null);
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchaseForm.supplierId || purchaseForm.items.length === 0 || !slug) return;

    try {
      await apiWithTenant('/inventory/purchase-orders', slug, {
        method: 'POST',
        body: JSON.stringify({
          ...purchaseForm,
          id: editingPurchase?.id,
          status: editingPurchase?.status || 'pendente',
          totalCost: calculatePurchaseTotal(purchaseForm.items),
          createdAt: editingPurchase?.createdAt || new Date().toISOString(),
          receivedAt: editingPurchase?.receivedAt,
        }),
      });
      await refresh();
      closePurchaseModal();
      toast.success(editingPurchase ? 'Compra atualizada!' : 'Compra cadastrada!');
    } catch {
      toast.error('Erro ao salvar compra');
    }
  };

  const handleReceivePurchase = async (order: PurchaseOrder) => {
    if (order.status !== 'pendente') return;
    try {
      await apiWithTenant(`/inventory/purchase-orders/${order.id}/receive`, slug, { method: 'POST' });
      await refresh();
      toast.success('Compra recebida e estoque atualizado!');
    } catch {
      toast.error('Erro ao receber compra');
    }
  };

  const handleDeletePurchase = async (order: PurchaseOrder) => {
    if (!confirm(`Excluir a compra "${order.id}"?`)) return;
    try {
      await apiWithTenant(`/inventory/purchase-orders/${order.id}`, slug, { method: 'DELETE' });
      await refresh();
      toast.success('Compra removida.');
    } catch {
      toast.error('Erro ao remover compra');
    }
  };

  const addPurchaseItem = () => {
    setPurchaseForm({
      ...purchaseForm,
      items: [...purchaseForm.items, { inventoryItemId: state.items[0]?.id || '', quantity: 0, unitCost: 0 }],
    });
  };

  const removePurchaseItem = (index: number) => {
    setPurchaseForm({ ...purchaseForm, items: purchaseForm.items.filter((_, i) => i !== index) });
  };

  const updatePurchaseItem = (index: number, data: Partial<PurchaseOrderItem>) => {
    const newItems = [...purchaseForm.items];
    newItems[index] = { ...newItems[index], ...data };
    setPurchaseForm({ ...purchaseForm, items: newItems });
  };

  const getMovementIcon = (type: StockMovementType) => {
    switch (type) {
      case 'entrada':
        return <ArrowDown className="w-4 h-4 text-green-500" />;
      case 'saida':
        return <ArrowUp className="w-4 h-4 text-blue-500" />;
      case 'perda':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      case 'ajuste':
        return <RotateCcw className="w-4 h-4 text-orange-500" />;
    }
  };

  const getSupplierName = (id?: string) => state.suppliers.find((s) => s.id === id)?.name || 'N/A';
  const getItemName = (id?: string) => state.items.find((i) => i.id === id)?.name || 'Insumo removido';

  return (
    <FeatureGate
      featureId="stock-control"
      plan={user?.plan}
      fallback={
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Controle de Estoque</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Gerencie insumos, receitas, fornecedores e compras do seu negócio.
            </p>
          </div>
          <div className="bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-[#18181B] border border-orange-200 dark:border-orange-500/30 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-orange-600 dark:text-orange-500" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">Recurso exclusivo do plano Completo</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Controle insumos, vincule receitas aos produtos, gerencie fornecedores e acompanhe custos e lucros.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/dashboard/upgrade')}
              className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
            >
              <Crown className="w-4 h-4" /> Fazer Upgrade <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Controle de Estoque</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Gerencie insumos, receitas, fornecedores e compras do seu negócio.
            </p>
          </div>
          <button
            onClick={() => openItemModal()}
            className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Novo Insumo
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
              <Archive className="w-4 h-4" /> Total de Itens
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">{state.items.length}</div>
          </div>
          <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
              <AlertTriangle className="w-4 h-4" /> Abaixo do Mín.
            </div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-500">{lowStockItems.length}</div>
          </div>
          <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
              <X className="w-4 h-4" /> Em Falta
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-500">{outOfStockItems.length}</div>
          </div>
          <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl p-4">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mb-1">
              <DollarSign className="w-4 h-4" /> Valor em Estoque
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              R$ {inventoryValue.toFixed(2).replace('.', ',')}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {(lowStockItems.length > 0 || outOfStockItems.length > 0 || expiringBatches.length > 0) && (
          <div className="space-y-3">
            {outOfStockItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl text-red-800 dark:text-red-300"
              >
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="font-medium">
                  <strong>{item.name}</strong> está em falta. Reposição urgente necessária.
                </span>
              </div>
            ))}
            {lowStockItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-500/30 rounded-xl text-orange-800 dark:text-orange-300"
              >
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="font-medium">
                  <strong>{item.name}</strong> está abaixo do mínimo ({formatUnit(item.currentStock, item.unit)} / {formatUnit(item.minStock, item.unit)}).
                </span>
              </div>
            ))}
            {expiringBatches.length > 0 && (
              <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-500/30 rounded-xl text-yellow-800 dark:text-yellow-300">
                <Calendar className="w-5 h-5 shrink-0" />
                <span className="font-medium">
                  {expiringBatches.length} lote(s) próximo(s) do vencimento ou vencido(s).
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-xl overflow-hidden">
          <div className="flex border-b border-slate-200 dark:border-[#262626] overflow-x-auto no-scrollbar">
            {[
              { id: 'stock', label: 'Estoque', icon: Archive },
              { id: 'movements', label: 'Movimentações', icon: RotateCcw },
              { id: 'suppliers', label: 'Fornecedores', icon: Truck },
              { id: 'purchases', label: 'Compras', icon: ShoppingCart },
              { id: 'reports', label: 'Relatórios', icon: TrendingDown },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-orange-600 dark:text-orange-500 border-b-2 border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#18181B]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'stock' && (
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar insumo..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  />
                </div>

                {filteredItems.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum insumo cadastrado.</p>
                    <button
                      onClick={() => openItemModal()}
                      className="mt-4 text-orange-600 dark:text-orange-500 font-medium hover:underline"
                    >
                      Cadastrar primeiro insumo
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-[#262626] text-xs uppercase text-slate-500 dark:text-slate-400">
                          <th className="pb-3 font-medium">Insumo</th>
                          <th className="pb-3 font-medium">Estoque</th>
                          <th className="pb-3 font-medium">Custo Médio</th>
                          <th className="pb-3 font-medium">Status</th>
                          <th className="pb-3 font-medium text-right">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {filteredItems.map((item) => {
                          const status = getItemStatus(item);
                          const avgCost = calculateAverageCost(item, state.batches);
                          return (
                            <tr
                              key={item.id}
                              className="border-b border-slate-100 dark:border-[#262626]/50 last:border-0 hover:bg-slate-50 dark:hover:bg-[#18181B] transition-colors"
                            >
                              <td className="py-3 pr-4">
                                <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  Mín: {formatUnit(item.minStock, item.unit)}
                                </div>
                              </td>
                              <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                {formatUnit(item.currentStock, item.unit)}
                              </td>
                              <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                R$ {avgCost.toFixed(2).replace('.', ',')} / {item.unit}
                              </td>
                              <td className="py-3 pr-4">
                                {status === 'ok' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-medium">
                                    <CheckCircle2 className="w-3 h-3" /> OK
                                  </span>
                                )}
                                {status === 'low' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs font-medium">
                                    <AlertTriangle className="w-3 h-3" /> Baixo
                                  </span>
                                )}
                                {status === 'out' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs font-medium">
                                    <X className="w-3 h-3" /> Em Falta
                                  </span>
                                )}
                              </td>
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => openMovementModal(item, 'entrada')}
                                    className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                                    title="Entrada"
                                  >
                                    <ArrowDown className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openMovementModal(item, 'saida')}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="Saída"
                                  >
                                    <ArrowUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => openItemModal(item)}
                                    className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteItem(item)}
                                    className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'movements' && (
              <div className="space-y-4">
                {state.movements.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <RotateCcw className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma movimentação registrada.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar">
                    {state.movements.map((movement) => {
                      const item = state.items.find((i) => i.id === movement.inventoryItemId);
                      return (
                        <div
                          key={movement.id}
                          className="flex items-start sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#18181B] flex items-center justify-center">
                              {getMovementIcon(movement.type)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-900 dark:text-white">
                                {movement.type === 'entrada' ? 'Entrada' : movement.type === 'saida' ? 'Saída' : movement.type === 'perda' ? 'Perda' : 'Ajuste'} de{' '}
                                <span className="text-orange-600 dark:text-orange-500">{formatUnit(movement.quantity, item?.unit || 'un')}</span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {item?.name || 'Insumo removido'} • {movement.reason || 'Sem motivo'} •{' '}
                                {new Date(movement.createdAt).toLocaleString('pt-BR')}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'suppliers' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => openSupplierModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Novo Fornecedor
                  </button>
                </div>
                {state.suppliers.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <Truck className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum fornecedor cadastrado.</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {state.suppliers.map((supplier) => (
                      <div
                        key={supplier.id}
                        className="p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl"
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-bold text-slate-900 dark:text-white">{supplier.name}</h3>
                          <div className="flex gap-1">
                            <button onClick={() => openSupplierModal(supplier)} className="p-1.5 text-slate-500 hover:text-orange-600 rounded-lg transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeleteSupplier(supplier)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {supplier.phone && <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {supplier.phone}</div>}
                        {supplier.email && <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Mail className="w-3 h-3" /> {supplier.email}</div>}
                        {supplier.address && <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {supplier.address}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'purchases' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    onClick={() => openPurchaseModal()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold rounded-lg transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Nova Compra
                  </button>
                </div>
                {state.purchaseOrders.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma compra cadastrada.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {state.purchaseOrders.map((order) => (
                      <div
                        key={order.id}
                        className="p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white">{order.id}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                order.status === 'recebido'
                                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                  : order.status === 'cancelado'
                                  ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                                  : 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400'
                              }`}>
                                {order.status === 'recebido' ? 'Recebido' : order.status === 'cancelado' ? 'Cancelado' : 'Pendente'}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {getSupplierName(order.supplierId)} • {new Date(order.createdAt).toLocaleDateString('pt-BR')}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {order.status === 'pendente' && (
                              <button
                                onClick={() => handleReceivePurchase(order)}
                                className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg transition-colors"
                              >
                                Receber
                              </button>
                            )}
                            <button onClick={() => openPurchaseModal(order)} className="p-1.5 text-slate-500 hover:text-orange-600 rounded-lg transition-colors">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDeletePurchase(order)} className="p-1.5 text-slate-500 hover:text-red-600 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <div className="text-sm text-slate-700 dark:text-slate-300 space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between">
                              <span>{getItemName(item.inventoryItemId)} — {formatUnit(item.quantity, state.items.find(i => i.id === item.inventoryItemId)?.unit || 'un')}</span>
                              <span className="text-slate-500 dark:text-slate-400">R$ {(item.quantity * item.unitCost).toFixed(2).replace('.', ',')}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-[#262626] flex justify-between items-center">
                          <span className="text-sm font-bold text-slate-900 dark:text-white">Total</span>
                          <span className="text-lg font-bold text-orange-600 dark:text-orange-500">R$ {order.totalCost.toFixed(2).replace('.', ',')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-xl">
                    <h3 className="font-bold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                      <X className="w-4 h-4" /> Itens em Falta
                    </h3>
                    {outOfStockItems.length === 0 ? (
                      <p className="text-sm text-red-700 dark:text-red-400">Nenhum item em falta.</p>
                    ) : (
                      <ul className="space-y-1 text-sm text-red-700 dark:text-red-400">
                        {outOfStockItems.map((item) => (
                          <li key={item.id}>• {item.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-500/30 rounded-xl">
                    <h3 className="font-bold text-orange-800 dark:text-orange-300 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Itens Abaixo do Mínimo
                    </h3>
                    {lowStockItems.length === 0 ? (
                      <p className="text-sm text-orange-700 dark:text-orange-400">Nenhum item abaixo do mínimo.</p>
                    ) : (
                      <ul className="space-y-1 text-sm text-orange-700 dark:text-orange-400">
                        {lowStockItems.map((item) => (
                          <li key={item.id}>• {item.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-500/30 rounded-xl">
                    <h3 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Vencimentos Próximos
                    </h3>
                    {expiringBatches.length === 0 ? (
                      <p className="text-sm text-yellow-700 dark:text-yellow-400">Nenhum lote próximo do vencimento.</p>
                    ) : (
                      <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-400">
                        {expiringBatches.map((batch) => (
                          <li key={batch.id}>
                            • {getItemName(batch.inventoryItemId)} — {batch.expirationDate ? new Date(batch.expirationDate).toLocaleDateString('pt-BR') : 'N/A'}
                            {isBatchExpired(batch) && <span className="ml-1 text-red-600 font-bold">(Vencido)</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <ChefHat className="w-4 h-4" /> Custo e Preço Sugerido dos Produtos
                  </h3>
                  {state.recipes.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma receita vinculada. Cadastre insumos e associe-os aos produtos no Cardápio.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-[#262626] text-xs uppercase text-slate-500 dark:text-slate-400">
                            <th className="pb-3 font-medium">Produto</th>
                            <th className="pb-3 font-medium">Custo da Receita</th>
                            <th className="pb-3 font-medium">Preço Sugerido</th>
                            <th className="pb-3 font-medium">Margem</th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.recipes.map((recipe) => {
                            const cost = calculateRecipeCost(recipe.ingredients, state.items, state.batches);
                            const markup = state.items.find(i => i.id === recipe.ingredients[0]?.inventoryItemId)?.markup || 2.5;
                            const suggestedPrice = suggestSalePrice(cost, markup);
                            const actualPrice = productInfo[recipe.productId]?.price || 0;
                            const margin = actualPrice ? ((actualPrice - cost) / actualPrice) * 100 : 0;
                            return (
                              <tr key={recipe.productId} className="border-b border-slate-100 dark:border-[#262626]/50 last:border-0">
                                <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                                  {productInfo[recipe.productId]?.name || 'Produto'}
                                </td>
                                <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                  R$ {cost.toFixed(2).replace('.', ',')}
                                </td>
                                <td className="py-3 pr-4 text-orange-600 dark:text-orange-500 font-bold">
                                  R$ {suggestedPrice.toFixed(2).replace('.', ',')}
                                </td>
                                <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">
                                  {margin > 0 ? `${margin.toFixed(0)}%` : margin < 0 ? <span className="text-red-600">{margin.toFixed(0)}%</span> : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Item Modal */}
      <AnimatePresence>
        {isItemModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeItemModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none"
            >
              <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto pointer-events-auto">
                <div className="p-6 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingItem ? 'Editar Insumo' : 'Novo Insumo'}
                  </h2>
                  <button onClick={closeItemModal} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveItem} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Insumo</label>
                    <input
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      placeholder="Ex: Pão de hambúrguer"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Unidade</label>
                      <select
                        value={itemForm.unit}
                        onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value as InventoryUnit })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {UNITS.map((u) => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Markup padrão</label>
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={itemForm.markup}
                        onChange={(e) => setItemForm({ ...itemForm, markup: parseFloat(e.target.value) || 2.5 })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estoque Atual</label>
                      <input
                        type="number"
                        step="0.01"
                        value={itemForm.currentStock}
                        onChange={(e) => setItemForm({ ...itemForm, currentStock: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Estoque Mínimo</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemForm.minStock}
                        onChange={(e) => setItemForm({ ...itemForm, minStock: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custo Médio (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemForm.averageCost}
                        onChange={(e) => setItemForm({ ...itemForm, averageCost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Custo Referencial (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={itemForm.cost}
                        onChange={(e) => setItemForm({ ...itemForm, cost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-lg font-bold transition-colors"
                    >
                      {editingItem ? 'Salvar Alterações' : 'Cadastrar Insumo'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Movement Modal */}
      <AnimatePresence>
        {isMovementModalOpen && movementItem && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMovementModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none"
            >
              <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto">
                <div className="p-6 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    Movimentar: {movementItem.name}
                  </h2>
                  <button onClick={closeMovementModal} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveMovement} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                    <select
                      value={movementForm.type}
                      onChange={(e) => setMovementForm({ ...movementForm, type: e.target.value as StockMovementType })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      {MOVEMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Quantidade ({movementItem.unit})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                    {movementForm.type === 'ajuste' && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        No ajuste, informe o valor final que o estoque deve ficar.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo</label>
                    <input
                      type="text"
                      value={movementForm.reason}
                      onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      placeholder="Ex: Compra do fornecedor"
                    />
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-lg font-bold transition-colors"
                    >
                      Registrar Movimentação
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Supplier Modal */}
      <AnimatePresence>
        {isSupplierModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeSupplierModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none"
            >
              <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-md pointer-events-auto">
                <div className="p-6 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
                  </h2>
                  <button onClick={closeSupplierModal} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                    <input
                      type="text"
                      required
                      value={supplierForm.name}
                      onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      placeholder="Ex: Atacadão dos Pães"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefone</label>
                    <input
                      type="text"
                      value={supplierForm.phone || ''}
                      onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-mail</label>
                    <input
                      type="email"
                      value={supplierForm.email || ''}
                      onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço</label>
                    <input
                      type="text"
                      value={supplierForm.address || ''}
                      onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    />
                  </div>
                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white py-2.5 rounded-lg font-bold transition-colors"
                    >
                      {editingSupplier ? 'Salvar Alterações' : 'Cadastrar Fornecedor'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      <AnimatePresence>
        {isPurchaseModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePurchaseModal}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none"
            >
              <div className="bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
                <div className="p-6 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editingPurchase ? 'Editar Compra' : 'Nova Compra'}
                  </h2>
                  <button onClick={closePurchaseModal} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#262626]">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <form onSubmit={handleSavePurchase} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Fornecedor</label>
                    <select
                      required
                      value={purchaseForm.supplierId}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    >
                      <option value="">Selecione um fornecedor</option>
                      {state.suppliers.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Itens da Compra</label>
                      <button
                        type="button"
                        onClick={addPurchaseItem}
                        className="text-xs text-orange-600 dark:text-orange-500 font-bold hover:underline"
                      >
                        + Adicionar Item
                      </button>
                    </div>
                    {purchaseForm.items.map((item, index) => (
                      <div key={index} className="p-3 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <select
                            value={item.inventoryItemId}
                            onChange={(e) => updatePurchaseItem(index, { inventoryItemId: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          >
                            {state.items.map((i) => (
                              <option key={i.id} value={i.id}>{i.name}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Quantidade"
                            value={item.quantity || ''}
                            onChange={(e) => updatePurchaseItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                            className="px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Custo unitário"
                            value={item.unitCost || ''}
                            onChange={(e) => updatePurchaseItem(index, { unitCost: parseFloat(e.target.value) || 0 })}
                            className="px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <input
                            type="date"
                            value={item.manufacturingDate || ''}
                            onChange={(e) => updatePurchaseItem(index, { manufacturingDate: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                          <input
                            type="date"
                            value={item.expirationDate || ''}
                            onChange={(e) => updatePurchaseItem(index, { expirationDate: e.target.value })}
                            className="px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => removePurchaseItem(index)}
                            className="text-xs text-red-600 font-medium hover:underline"
                          >
                            Remover item
                          </button>
                        </div>
                      </div>
                    ))}
                    {purchaseForm.items.length === 0 && (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum item adicionado.</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Observações</label>
                    <textarea
                      rows={2}
                      value={purchaseForm.notes}
                      onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-[#262626]">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      Total: R$ {calculatePurchaseTotal(purchaseForm.items).toFixed(2).replace('.', ',')}
                    </div>
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold transition-colors"
                    >
                      {editingPurchase ? 'Salvar' : 'Cadastrar Compra'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <LockedFeatureModal
        featureId={lockedFeature || ''}
        isOpen={!!lockedFeature}
        onClose={() => setLockedFeature(null)}
      />
    </FeatureGate>
  );
}
