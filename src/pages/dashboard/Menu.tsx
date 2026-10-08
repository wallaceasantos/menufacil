import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, GripVertical, Image as ImageIcon, UtensilsCrossed, X, Upload, Crown, ArrowRight, Eye, Package, Layers, CheckSquare, ListTree, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { LockedFeatureModal } from '../../components/LockedFeatureModal';
import { CurrencyInput } from '../../components/CurrencyInput';
import { getTenantSlug } from '../../data/tenantStorage';
import { getInventoryState } from '../../data/inventoryStorage';
import type { RecipeIngredient, InventoryItem } from '../../data/inventory';
import { calculateRecipeCost, suggestSalePrice } from '../../data/inventory';
import { apiWithTenant, uploadImage } from '../../lib/api';
import type { ProductType } from '../../types';

interface MenuComponent {
  id: string;
  name: string;
  inventoryItemId?: string | null;
  quantity: number;
  price: number;
  includedInPrice: boolean;
  deductStock: boolean;
  isDefault: boolean;
}

interface MenuChoiceOption {
  id: string;
  name: string;
  inventoryItemId?: string | null;
  quantity: number;
  price: number;
  includedInPrice: boolean;
  deductStock: boolean;
  isDefault: boolean;
}

interface MenuChoiceGroup {
  id: string;
  name: string;
  minChoices: number;
  maxChoices: number;
  required: boolean;
  options: MenuChoiceOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  active: boolean;
  image?: string;
  productType: ProductType;
  recipe?: RecipeIngredient[];
  components?: MenuComponent[];
  choiceGroups?: MenuChoiceGroup[];
  autoDeductStock?: boolean;
}

const BASIC_PLAN_LIMITS = {
  maxCategories: 5,
  maxItems: 30,
};

const DEFAULT_CATEGORIES = ['Lanches', 'Bebidas'];

const DEFAULT_ITEMS: MenuItem[] = [
  {
    id: '1',
    name: 'Hambúrguer Artesanal',
    description: 'Blend de 160g, queijo prato, alface, tomate e maionese da casa.',
    price: 35.50,
    category: 'Lanches',
    active: true,
    productType: 'simple',
  },
  {
    id: '2',
    name: 'X-Bacon',
    description: 'Hambúrguer de 160g, queijo cheddar, muito bacon e molho especial.',
    price: 28.90,
    category: 'Lanches',
    active: true,
    productType: 'simple',
  },
  {
    id: '3',
    name: 'Coca-Cola Lata 350ml',
    description: 'Refrigerante em lata.',
    price: 8.00,
    category: 'Bebidas',
    active: true,
    productType: 'simple',
  },
  {
    id: '4',
    name: 'Suco de Laranja Natural',
    description: 'Suco natural feito na hora (500ml).',
    price: 12.00,
    category: 'Bebidas',
    active: false,
    productType: 'simple',
  }
];

export function Menu() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [categoryIds, setCategoryIds] = useState<Record<string, string>>({});
  const [items, setItems] = useState<MenuItem[]>(DEFAULT_ITEMS);
  const [loading, setLoading] = useState(false);

  const tenantSlug = getTenantSlug(user);

  // Carregar dados da API ao montar
  useEffect(() => {
    if (!user || !tenantSlug) return;

    async function loadMenu() {
      setLoading(true);
      try {
        const [data, inventoryData] = await Promise.all([
          apiWithTenant<{ categories: string[]; categoryTimes: Record<string, { startTime: string | null; endTime: string | null }>; categoryIds: Record<string, string>; items: MenuItem[] }>('/menu', tenantSlug),
          apiWithTenant<{ items: InventoryItem[] }>('/inventory', tenantSlug).catch(() => ({ items: [] })),
        ]);
        if (data.categories) setCategories(data.categories);
        if (data.categoryTimes) setCategoryTimes(data.categoryTimes);
        if (data.categoryIds) setCategoryIds(data.categoryIds);
        if (data.items) setItems(data.items);
        setInventoryItems(inventoryData.items ?? getInventoryState(tenantSlug).items);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao carregar cardápio';
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    loadMenu();
  }, [user, tenantSlug]);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryStartTime, setCategoryStartTime] = useState('');
  const [categoryEndTime, setCategoryEndTime] = useState('');
  const [categoryTimes, setCategoryTimes] = useState<Record<string, { startTime: string | null; endTime: string | null }>>({});

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [itemForm, setItemForm] = useState<Omit<MenuItem, 'id'>>({
    name: '',
    description: '',
    price: 0,
    category: categories[0] || '',
    active: true,
    image: '',
    productType: 'simple',
    recipe: [],
    components: [],
    choiceGroups: [],
    autoDeductStock: true,
  });

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>(getInventoryState(getTenantSlug(user)).items);
  const [recipeIngredients, setRecipeIngredients] = useState<RecipeIngredient[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [selectedIngredientQty, setSelectedIngredientQty] = useState(0);
  const [activeBuilderTab, setActiveBuilderTab] = useState<'components' | 'choices'>('components');

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryInput.trim()) return;

    if (editingCategory) {
      const categoryId = categoryIds[editingCategory];
      if (!categoryId) return;

      try {
        await apiWithTenant(`/menu/categories/${categoryId}`, tenantSlug, {
          method: 'PATCH',
          body: JSON.stringify({ name: categoryInput, startTime: categoryStartTime || null, endTime: categoryEndTime || null }),
        });
        setCategories(categories.map(c => c === editingCategory ? categoryInput : c));
        setCategoryIds((prev) => ({ ...prev, [categoryInput]: categoryId }));
        delete categoryIds[editingCategory];
        setItems(items.map(item => item.category === editingCategory ? { ...item, category: categoryInput } : item));
        toast.success('Categoria atualizada');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao atualizar categoria';
        toast.error(message);
      }
    } else {
      if (user?.plan === 'basico' && categories.length >= BASIC_PLAN_LIMITS.maxCategories) {
        setIsCategoryModalOpen(false);
        setLockedFeature('custom-domain');
        return;
      }
      if (categories.includes(categoryInput)) {
        toast.error('Categoria já existe');
        return;
      }

      try {
        const created = await apiWithTenant<{ id: string; name: string }>('/menu/categories', tenantSlug, {
          method: 'POST',
          body: JSON.stringify({ name: categoryInput, startTime: categoryStartTime || null, endTime: categoryEndTime || null }),
        });
        setCategories([...categories, categoryInput]);
        setCategoryIds((prev) => ({ ...prev, [categoryInput]: created.id }));
        toast.success('Categoria criada');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Erro ao criar categoria';
        toast.error(message);
      }
    }
    
    setIsCategoryModalOpen(false);
    setCategoryInput('');
    setCategoryStartTime('');
    setCategoryEndTime('');
    setEditingCategory(null);
  };

  const handleDeleteCategory = async (categoryToDelete: string) => {
    if (!confirm(`Tem certeza que deseja excluir a categoria "${categoryToDelete}" e todos os seus itens?`)) return;

    const categoryId = categoryIds[categoryToDelete];
    if (!categoryId) return;

    try {
      await apiWithTenant(`/menu/categories/${categoryId}`, tenantSlug, {
        method: 'DELETE',
      });
      setCategories(categories.filter(c => c !== categoryToDelete));
      setItems(items.filter(item => item.category !== categoryToDelete));
      setCategoryIds((prev) => {
        const updated = { ...prev };
        delete updated[categoryToDelete];
        return updated;
      });
      toast.success('Categoria excluída');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir categoria';
      toast.error(message);
    }
  };

  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenantSlug) return;

    setUploadingImage(true);
    try {
      const imageUrl = await uploadImage(file, tenantSlug);
      setItemForm({ ...itemForm, image: imageUrl });
      toast.success('Imagem enviada!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar imagem';
      toast.error(message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemForm.name || !itemForm.category) return;

    const payload = {
      name: itemForm.name,
      description: itemForm.description,
      price: itemForm.price,
      category: itemForm.category,
      active: itemForm.active,
      image: itemForm.image,
      productType: itemForm.productType,
      recipe: recipeIngredients,
      components: itemForm.components || [],
      choiceGroups: itemForm.choiceGroups || [],
      autoDeductStock: itemForm.autoDeductStock,
    };

    try {
      if (editingItem) {
        await apiWithTenant(`/menu/products/${editingItem.id}`, tenantSlug, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setItems(items.map(item => item.id === editingItem.id ? { ...payload, id: editingItem.id } : item));
        toast.success('Produto atualizado');
      } else {
        if (user?.plan === 'basico' && items.length >= BASIC_PLAN_LIMITS.maxItems) {
          setIsItemModalOpen(false);
          setLockedFeature('custom-domain');
          return;
        }
        const created = await apiWithTenant<{ id: string }>('/menu/products', tenantSlug, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const newItem: MenuItem = { ...payload, id: created.id };
        setItems([...items, newItem]);
        toast.success('Produto criado');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao salvar produto';
      toast.error(message);
    }

    setIsItemModalOpen(false);
    setEditingItem(null);
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;

    try {
      await apiWithTenant(`/menu/products/${id}`, tenantSlug, {
        method: 'DELETE',
      });
      setItems(items.filter(item => item.id !== id));
      toast.success('Produto excluído');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao excluir produto';
      toast.error(message);
    }
  };

  const openNewItemModal = () => {
    setItemForm({
      name: '',
      description: '',
      price: 0,
      category: categories[0] || '',
      active: true,
      image: '',
      productType: 'simple',
      recipe: [],
      components: [],
      choiceGroups: [],
      autoDeductStock: true,
    });
    setRecipeIngredients([]);
    setSelectedIngredientId('');
    setSelectedIngredientQty(0);
    setEditingItem(null);
    setActiveBuilderTab('components');
    setIsItemModalOpen(true);
  };

  const openEditItemModal = (item: MenuItem) => {
    setItemForm({
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      active: item.active,
      image: item.image,
      productType: item.productType || 'simple',
      recipe: item.recipe || [],
      components: item.components || [],
      choiceGroups: item.choiceGroups || [],
      autoDeductStock: item.autoDeductStock !== false,
    });
    setRecipeIngredients(item.recipe || []);
    setSelectedIngredientId('');
    setSelectedIngredientQty(0);
    setEditingItem(item);
    setActiveBuilderTab('components');
    setIsItemModalOpen(true);
  };

  const openNewCategoryModal = () => {
    setCategoryInput('');
    setCategoryStartTime('');
    setCategoryEndTime('');
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const openEditCategoryModal = (category: string) => {
    setCategoryInput(category);
    setEditingCategory(category);
    const times = categoryTimes[category] || { startTime: null, endTime: null };
    setCategoryStartTime(times.startTime || '');
    setCategoryEndTime(times.endTime || '');
    setIsCategoryModalOpen(true);
  };

  const addComponent = (component: Omit<MenuComponent, 'id'>) => {
    setItemForm((prev) => ({
      ...prev,
      components: [...(prev.components || []), { ...component, id: crypto.randomUUID() }],
    }));
  };

  const updateComponent = (id: string, updates: Partial<MenuComponent>) => {
    setItemForm((prev) => ({
      ...prev,
      components: (prev.components || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const removeComponent = (id: string) => {
    setItemForm((prev) => ({
      ...prev,
      components: (prev.components || []).filter((c) => c.id !== id),
    }));
  };

  const addChoiceGroup = () => {
    setItemForm((prev) => ({
      ...prev,
      choiceGroups: [
        ...(prev.choiceGroups || []),
        { id: crypto.randomUUID(), name: '', minChoices: 0, maxChoices: 1, required: false, options: [] },
      ],
    }));
  };

  const updateChoiceGroup = (id: string, updates: Partial<MenuChoiceGroup>) => {
    setItemForm((prev) => ({
      ...prev,
      choiceGroups: (prev.choiceGroups || []).map((g) => (g.id === id ? { ...g, ...updates } : g)),
    }));
  };

  const removeChoiceGroup = (id: string) => {
    setItemForm((prev) => ({
      ...prev,
      choiceGroups: (prev.choiceGroups || []).filter((g) => g.id !== id),
    }));
  };

  const addChoiceOption = (groupId: string, option: Omit<MenuChoiceOption, 'id'>) => {
    setItemForm((prev) => ({
      ...prev,
      choiceGroups: (prev.choiceGroups || []).map((g) =>
        g.id === groupId ? { ...g, options: [...g.options, { ...option, id: crypto.randomUUID() }] } : g
      ),
    }));
  };

  const updateChoiceOption = (groupId: string, optionId: string, updates: Partial<MenuChoiceOption>) => {
    setItemForm((prev) => ({
      ...prev,
      choiceGroups: (prev.choiceGroups || []).map((g) =>
        g.id === groupId
          ? { ...g, options: g.options.map((o) => (o.id === optionId ? { ...o, ...updates } : o)) }
          : g
      ),
    }));
  };

  const removeChoiceOption = (groupId: string, optionId: string) => {
    setItemForm((prev) => ({
      ...prev,
      choiceGroups: (prev.choiceGroups || []).map((g) =>
        g.id === groupId ? { ...g, options: g.options.filter((o) => o.id !== optionId) } : g
      ),
    }));
  };

  const inventorySelect = (value: string, onChange: (value: string) => void, placeholder = 'Vincular insumo (opcional)') => (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value || undefined as unknown as string)}
      className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
    >
      <option value="">{placeholder}</option>
      {inventoryItems.map((ing) => (
        <option key={ing.id} value={ing.id}>
          {ing.name} ({ing.unit})
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-6">
      {/* Upsell Banner (Básico) */}
      {user?.plan === 'basico' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-50 to-white dark:from-orange-900/20 dark:to-[#18181B] border border-orange-200 dark:border-orange-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0">
              <Crown className="w-5 h-5 text-orange-600 dark:text-orange-500" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">Aumente seu cardápio no plano Completo</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                No plano Básico você pode cadastrar até 30 produtos e 5 categorias. Faça upgrade para cadastrar produtos ilimitados.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/dashboard/upgrade')}
            className="shrink-0 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          >
            Fazer Upgrade <ArrowRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cardápio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gerencie os itens e categorias do seu menu.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <a
            href={`/loja/${getTenantSlug(user) || 'minha-loja'}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-lg text-sm font-semibold transition-colors border border-slate-200 dark:border-[#3f3f46] inline-flex items-center justify-center gap-2"
          >
            <Eye className="w-4 h-4" />
            Ver Loja
          </a>
          <button 
            onClick={openNewCategoryModal}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-lg text-sm font-semibold transition-colors border border-slate-200 dark:border-[#3f3f46]">
            Nova Categoria
          </button>
          <button 
            onClick={openNewItemModal}
            className="flex-1 sm:flex-none px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            Novo Item
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-[#121214] p-4 rounded-xl border border-slate-200 dark:border-[#262626] flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
          />
        </div>
        <div className="flex items-center gap-4 text-sm w-full sm:w-auto justify-end">
          {user?.plan === 'basico' ? (
            <>
              <span className={`${categories.length >= BASIC_PLAN_LIMITS.maxCategories ? 'text-orange-600 dark:text-orange-500 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                {categories.length}/{BASIC_PLAN_LIMITS.maxCategories} categorias
              </span>
              <span className="text-slate-300 dark:text-[#3f3f46]">|</span>
              <span className={`${items.length >= BASIC_PLAN_LIMITS.maxItems ? 'text-orange-600 dark:text-orange-500 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}>
                {items.length}/{BASIC_PLAN_LIMITS.maxItems} produtos
              </span>
            </>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              {categories.length} categorias · {items.length} produtos
            </span>
          )}
        </div>
      </div>

      {/* Menu List */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400">
          Carregando cardápio...
        </div>
      ) : (
      <div className="space-y-6">
        {categories.map((category, index) => (
          <motion.div 
            key={category}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626] overflow-hidden"
          >
            {/* Category Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#262626] bg-slate-50/50 dark:bg-[#09090b]/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GripVertical className="w-5 h-5 text-slate-400 cursor-grab active:cursor-grabbing" />
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{category}</h2>
                {categoryTimes[category]?.startTime && (
                  <span className="flex items-center gap-1 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-500 py-0.5 px-2 rounded-full text-[10px] font-bold">
                    <Clock className="w-3 h-3" />
                    {categoryTimes[category].startTime?.slice(0, 5)} às {categoryTimes[category].endTime?.slice(0, 5)}
                  </span>
                )}
                <span className="bg-slate-200 dark:bg-[#262626] text-slate-600 dark:text-slate-400 py-0.5 px-2 rounded-full text-xs font-medium">
                  {filteredItems.filter(item => item.category === category).length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => openEditCategoryModal(category)}
                  className="p-2 text-slate-400 hover:text-orange-600 dark:hover:text-orange-500 transition-colors rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDeleteCategory(category)}
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Items */}
            <div className="divide-y divide-slate-200 dark:divide-[#262626]">
              {filteredItems.filter(item => item.category === category).length === 0 ? (
                <div className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  Nenhum item encontrado nesta categoria.
                </div>
              ) : (
                filteredItems.filter(item => item.category === category).map((item) => (
                  <div key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-center hover:bg-slate-50 dark:hover:bg-[#09090b] transition-colors group">
                    <div className="flex items-center gap-4 flex-1">
                      <GripVertical className="w-5 h-5 text-slate-300 dark:text-[#262626] opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing transition-opacity hidden sm:block" />
                      
                      <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-[#262626] flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-[#3f3f46] overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</h3>
                          {!item.active && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#262626] text-slate-500 dark:text-slate-400">
                              Inativo
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 sm:line-clamp-1 mb-2 sm:mb-0">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-48 pl-14 sm:pl-0">
                      <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                        R$ {item.price.toFixed(2).replace('.', ',')}
                      </span>
                      
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => openEditItemModal(item)}
                          className="p-2 text-slate-400 hover:text-orange-600 dark:hover:text-orange-500 transition-colors rounded-lg hover:bg-orange-50 dark:hover:bg-orange-500/10">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ))}

        {categories.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626]">
            <UtensilsCrossed className="w-12 h-12 text-slate-300 dark:text-[#262626] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Seu cardápio está vazio</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              Comece adicionando categorias e produtos para seus clientes verem.
            </p>
            <button 
              onClick={openNewItemModal}
              className="px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-semibold shadow-lg shadow-orange-900/20 transition-all flex items-center justify-center gap-2 mx-auto">
              <Plus className="w-4 h-4" />
              Adicionar Primeiro Item
            </button>
          </div>
        )}
      </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121214] rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#262626]"
            >
              <div className="px-6 py-4 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                </h3>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-slate-400 hover:text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome da Categoria</label>
                  <input
                    type="text"
                    required
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                    placeholder="Ex: Sobremesas"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Horário de exibição (opcional)</label>
                  <p className="text-xs text-slate-400 mb-2">Defina um intervalo para esta categoria aparecer apenas neste horário</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Início</label>
                      <input
                        type="time"
                        value={categoryStartTime}
                        onChange={(e) => setCategoryStartTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Fim</label>
                      <input
                        type="time"
                        value={categoryEndTime}
                        onChange={(e) => setCategoryEndTime(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      />
                    </div>
                  </div>
                  {categoryStartTime && categoryEndTime && (
                    <p className="text-[11px] text-orange-600 dark:text-orange-500 mt-2">
                      Esta categoria só será exibida das {categoryStartTime.slice(0, 5)} às {categoryEndTime.slice(0, 5)}
                    </p>
                  )}
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-lg text-sm font-semibold transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-semibold transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}

        {isItemModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#121214] rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-[#262626] max-h-[90vh] flex flex-col"
            >
              <div className="px-6 py-4 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between shrink-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {editingItem ? 'Editar Item' : 'Novo Item'}
                </h3>
                <button onClick={() => setIsItemModalOpen(false)} className="text-slate-400 hover:text-slate-500">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="flex flex-col items-center mb-4">
                  <div className={`relative w-32 h-32 rounded-xl border-2 border-dashed border-slate-300 dark:border-[#3f3f46] bg-slate-50 dark:bg-[#09090b] flex items-center justify-center overflow-hidden mb-2 group ${uploadingImage ? 'opacity-75' : ''}`}>
                    {itemForm.image ? (
                      <img src={itemForm.image} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      {uploadingImage ? (
                        <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    />
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {uploadingImage ? 'Enviando...' : 'Clique para alterar a imagem'}
                  </span>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome do Item</label>
                    <input
                      type="text"
                      required
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      placeholder="Ex: X-Salada"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descrição</label>
                    <textarea
                      rows={3}
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50 resize-none"
                      placeholder="Descreva os ingredientes..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Preço (R$)</label>
                      <CurrencyInput
                        value={itemForm.price}
                        onChange={(val) => setItemForm({ ...itemForm, price: val })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Categoria</label>
                      <select
                        required
                        value={itemForm.category}
                        onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="item-active"
                      checked={itemForm.active}
                      onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })}
                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                    />
                    <label htmlFor="item-active" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Item ativo no cardápio
                    </label>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-[#262626]">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tipo de produto</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'simple', label: 'Simples', icon: UtensilsCrossed, desc: 'Item único' },
                        { id: 'combo', label: 'Combo', icon: Layers, desc: 'Itens fixos' },
                        { id: 'buildable', label: 'Montável', icon: CheckSquare, desc: 'Escolhas do cliente' },
                      ].map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setItemForm({ ...itemForm, productType: type.id as ProductType })}
                          className={`flex flex-col items-center gap-2 p-3 rounded-xl border text-sm transition-all ${
                            itemForm.productType === type.id
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400'
                              : 'border-slate-200 dark:border-[#262626] text-slate-600 dark:text-slate-400 hover:border-orange-300 dark:hover:border-orange-500/50'
                          }`}
                        >
                          <type.icon className="w-5 h-5" />
                          <div className="text-center">
                            <div className="font-semibold">{type.label}</div>
                            <div className="text-xs opacity-75">{type.desc}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {user?.plan === 'completo' && (
                    <div className="pt-4 border-t border-slate-200 dark:border-[#262626]">
                      <div className="flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">Receita / Insumos</h4>
                      </div>

                      {inventoryItems.length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Cadastre insumos na página de{' '}
                          <button
                            type="button"
                            onClick={() => { setIsItemModalOpen(false); navigate('/dashboard/inventory'); }}
                            className="text-orange-600 dark:text-orange-500 font-medium hover:underline"
                          >
                            Estoque
                          </button>{' '}
                          para vincular a este produto.
                        </p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <select
                              value={selectedIngredientId}
                              onChange={(e) => setSelectedIngredientId(e.target.value)}
                              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            >
                              <option value="">Selecione um insumo</option>
                              {inventoryItems.map((ing) => (
                                <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={selectedIngredientQty || ''}
                              onChange={(e) => setSelectedIngredientQty(parseFloat(e.target.value) || 0)}
                              placeholder="Qtd"
                              className="w-24 px-3 py-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (!selectedIngredientId || selectedIngredientQty <= 0) return;
                                setRecipeIngredients([
                                  ...recipeIngredients,
                                  { inventoryItemId: selectedIngredientId, quantity: selectedIngredientQty },
                                ]);
                                setSelectedIngredientId('');
                                setSelectedIngredientQty(0);
                              }}
                              className="px-3 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-semibold"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>

                          {recipeIngredients.length > 0 && (
                            <>
                              <ul className="space-y-2 mb-3">
                                {recipeIngredients.map((ing, index) => {
                                  const invItem = inventoryItems.find((i) => i.id === ing.inventoryItemId);
                                  return (
                                    <li key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm">
                                      <span className="text-slate-700 dark:text-slate-300">
                                        {invItem?.name || 'Insumo removido'} — {ing.quantity} {invItem?.unit || 'un'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setRecipeIngredients(recipeIngredients.filter((_, i) => i !== index))}
                                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                      >
                                        <X className="w-4 h-4" />
                                      </button>
                                    </li>
                                  );
                                })}
                              </ul>
                              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-500/30 rounded-lg mb-3">
                                {(() => {
                                  const recipeCost = calculateRecipeCost(recipeIngredients, inventoryItems, getInventoryState(getTenantSlug(user)).batches);
                                  const markup = inventoryItems.find(i => i.id === recipeIngredients[0]?.inventoryItemId)?.markup || 2.5;
                                  const suggested = suggestSalePrice(recipeCost, markup);
                                  const margin = itemForm.price ? ((itemForm.price - suggested) / itemForm.price) * 100 : 0;
                                  return (
                                    <div className="text-sm space-y-1">
                                      <div className="flex justify-between text-slate-700 dark:text-slate-300">
                                        <span>Custo estimado:</span>
                                        <span className="font-medium">R$ {recipeCost.toFixed(2).replace('.', ',')}</span>
                                      </div>
                                      <div className="flex justify-between text-orange-800 dark:text-orange-300 font-bold">
                                        <span>Preço sugerido:</span>
                                        <span>R$ {suggested.toFixed(2).replace('.', ',')}</span>
                                      </div>
                                      {itemForm.price > 0 && (
                                        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                          <span>Margem sobre sugerido:</span>
                                          <span className={margin >= 0 ? 'text-green-600' : 'text-red-600'}>
                                            {margin >= 0 ? '+' : ''}{margin.toFixed(0)}%
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </>
                          )}

                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              id="auto-deduct"
                              checked={itemForm.autoDeductStock}
                              onChange={(e) => setItemForm({ ...itemForm, autoDeductStock: e.target.checked })}
                              className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                            />
                            <label htmlFor="auto-deduct" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              Descontar estoque automaticamente ao confirmar pedido
                            </label>
                          </div>
                        </>
                      )}

                      {/* Componentes e Grupos de Escolha */}
                      <div className="pt-4 border-t border-slate-200 dark:border-[#262626]">
                        <div className="flex items-center gap-2 mb-3">
                          <ListTree className="w-4 h-4 text-orange-600 dark:text-orange-500" />
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">Montagem do produto</h4>
                        </div>

                        <div className="flex gap-2 mb-4">
                          <button
                            type="button"
                            onClick={() => setActiveBuilderTab('components')}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                              activeBuilderTab === 'components'
                                ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                                : 'bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Componentes ({itemForm.components?.length || 0})
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveBuilderTab('choices')}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                              activeBuilderTab === 'choices'
                                ? 'bg-orange-100 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400'
                                : 'bg-slate-100 dark:bg-[#262626] text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            Escolhas ({itemForm.choiceGroups?.length || 0})
                          </button>
                        </div>

                        {activeBuilderTab === 'components' && (
                          <div className="space-y-3">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Componentes fixos do produto (ex: batata + hambúrguer no combo). Marque "incluso no preço" para itens já contemplados no valor base.
                            </p>
                            {itemForm.components?.map((component) => (
                              <div key={component.id} className="p-3 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg space-y-2">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={component.name}
                                    onChange={(e) => updateComponent(component.id, { name: e.target.value })}
                                    placeholder="Nome do componente"
                                    className="flex-1 px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeComponent(component.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="flex items-center gap-2">
                                  {inventorySelect(component.inventoryItemId || '', (val) => updateComponent(component.id, { inventoryItemId: val || null }))}
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={component.quantity || ''}
                                    onChange={(e) => updateComponent(component.id, { quantity: parseFloat(e.target.value) || 0 })}
                                    placeholder="Qtd"
                                    className="w-24 px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                  />
                                  <CurrencyInput
                                    value={component.price}
                                    onChange={(val) => updateComponent(component.id, { price: val })}
                                    placeholder="Preço"
                                    className="w-28 px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-3 text-xs">
                                  <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={component.includedInPrice}
                                      onChange={(e) => updateComponent(component.id, { includedInPrice: e.target.checked })}
                                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                    />
                                    Incluso no preço
                                  </label>
                                  <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={component.deductStock}
                                      onChange={(e) => updateComponent(component.id, { deductStock: e.target.checked })}
                                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                    />
                                    Descontar estoque
                                  </label>
                                  <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                    <input
                                      type="checkbox"
                                      checked={component.isDefault}
                                      onChange={(e) => updateComponent(component.id, { isDefault: e.target.checked })}
                                      className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                    />
                                    Padrão
                                  </label>
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => addComponent({ name: '', inventoryItemId: null, quantity: 1, price: 0, includedInPrice: true, deductStock: true, isDefault: true })}
                              className="w-full py-2 border border-dashed border-slate-300 dark:border-[#3f3f46] rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" /> Adicionar componente
                            </button>
                          </div>
                        )}

                        {activeBuilderTab === 'choices' && (
                          <div className="space-y-4">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Crie grupos de escolha para produtos montáveis. Defina mínimo/máximo de opções e se o grupo é obrigatório.
                            </p>
                            {itemForm.choiceGroups?.map((group) => (
                              <div key={group.id} className="p-3 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg space-y-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={group.name}
                                    onChange={(e) => updateChoiceGroup(group.id, { name: e.target.value })}
                                    placeholder="Nome do grupo (ex: Tamanho, Ponto da carne)"
                                    className="flex-1 px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeChoiceGroup(group.id)}
                                    className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Mínimo</label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={group.minChoices}
                                      onChange={(e) => updateChoiceGroup(group.id, { minChoices: parseInt(e.target.value) || 0 })}
                                      className="w-full px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Máximo</label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={group.maxChoices}
                                      onChange={(e) => updateChoiceGroup(group.id, { maxChoices: parseInt(e.target.value) || 1 })}
                                      className="w-full px-3 py-2 bg-white dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                    />
                                  </div>
                                  <div className="flex items-end pb-2">
                                    <label className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                                      <input
                                        type="checkbox"
                                        checked={group.required}
                                        onChange={(e) => updateChoiceGroup(group.id, { required: e.target.checked })}
                                        className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                      />
                                      Obrigatório
                                    </label>
                                  </div>
                                </div>

                                <div className="space-y-2 pl-2 border-l-2 border-slate-200 dark:border-[#262626]">
                                  {group.options.map((option) => (
                                    <div key={option.id} className="p-2 bg-white dark:bg-[#18181B] rounded-lg border border-slate-200 dark:border-[#262626] space-y-2">
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          value={option.name}
                                          onChange={(e) => updateChoiceOption(group.id, option.id, { name: e.target.value })}
                                          placeholder="Nome da opção"
                                          className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeChoiceOption(group.id, option.id)}
                                          className="p-1.5 text-slate-400 hover:text-red-600 transition-colors"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {inventorySelect(option.inventoryItemId || '', (val) => updateChoiceOption(group.id, option.id, { inventoryItemId: val || null }))}
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={option.quantity || ''}
                                          onChange={(e) => updateChoiceOption(group.id, option.id, { quantity: parseFloat(e.target.value) || 0 })}
                                          placeholder="Qtd"
                                          className="w-20 px-3 py-1.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                        />
                                        <CurrencyInput
                                          value={option.price}
                                          onChange={(val) => updateChoiceOption(group.id, option.id, { price: val })}
                                          placeholder="Preço"
                                          className="w-24 px-3 py-1.5 bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                        />
                                      </div>
                                      <div className="flex flex-wrap items-center gap-3 text-xs">
                                        <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                          <input
                                            type="checkbox"
                                            checked={option.includedInPrice}
                                            onChange={(e) => updateChoiceOption(group.id, option.id, { includedInPrice: e.target.checked })}
                                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                          />
                                          Incluso no preço
                                        </label>
                                        <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                          <input
                                            type="checkbox"
                                            checked={option.deductStock}
                                            onChange={(e) => updateChoiceOption(group.id, option.id, { deductStock: e.target.checked })}
                                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                          />
                                          Descontar estoque
                                        </label>
                                        <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                          <input
                                            type="checkbox"
                                            checked={option.isDefault}
                                            onChange={(e) => updateChoiceOption(group.id, option.id, { isDefault: e.target.checked })}
                                            className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                          />
                                          Padrão
                                        </label>
                                      </div>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => addChoiceOption(group.id, { name: '', inventoryItemId: null, quantity: 1, price: 0, includedInPrice: false, deductStock: true, isDefault: false })}
                                    className="w-full py-1.5 border border-dashed border-slate-300 dark:border-[#3f3f46] rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-500 transition-colors flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" /> Adicionar opção
                                  </button>
                                </div>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={addChoiceGroup}
                              className="w-full py-2 border border-dashed border-slate-300 dark:border-[#3f3f46] rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:border-orange-500 hover:text-orange-600 dark:hover:text-orange-500 transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus className="w-4 h-4" /> Adicionar grupo de escolha
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-200 dark:border-[#262626] flex gap-3 shrink-0 bg-slate-50 dark:bg-[#121214]">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#3f3f46] rounded-lg text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveItem}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white hover:bg-orange-700 rounded-lg text-sm font-semibold transition-colors"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <LockedFeatureModal
        isOpen={!!lockedFeature}
        onClose={() => setLockedFeature(null)}
        featureId={lockedFeature || 'custom-domain'}
      />
    </div>
  );
}
