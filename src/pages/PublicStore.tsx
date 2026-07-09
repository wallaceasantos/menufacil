import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { ShoppingCart, Plus, Minus, X, Info, MapPin, Bike, CheckCircle2, Store, Clock, Wallet, Copy, QrCode, Banknote, CreditCard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';
import { useApi } from '../hooks/useApi';
import { isStoreOpen } from '../data/tenantStorage';
import { extractTime } from '../lib/time';
import type { ApiCategory, ApiProduct, ApiTenant, ApiCreateOrderRequest, ApiProductComponent, ApiProductChoiceGroup, ApiProductChoiceOption, PaymentMethods } from '../types';

interface CartComponent {
  componentId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId?: string | null;
  deductStock: boolean;
}

interface CartChoice {
  choiceGroupId: string;
  choiceGroupName: string;
  optionId: string;
  optionName: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId?: string | null;
  deductStock: boolean;
}

interface CartItem {
  cartId: string;
  id: string;
  name: string;
  basePrice: number;
  price: number;
  quantity: number;
  components: CartComponent[];
  choices: CartChoice[];
  notes: string;
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function PublicStore() {
  const { storeName } = useParams();

  const {
    data: tenant,
    loading: tenantLoading,
    error: tenantError,
  } = useApi<ApiTenant>(storeName ? `/loja/${storeName}` : null);

  const localTime = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false })

  const {
    data: categoriesData,
    loading: categoriesLoading,
    error: categoriesError,
  } = useApi<ApiCategory[]>(storeName ? `/loja/${storeName}/produtos?now=${encodeURIComponent(localTime)}` : null);

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'delivery' | 'payment' | 'success'>('cart');
  const [trackingLink, setTrackingLink] = useState('');

  const [selectedProduct, setSelectedProduct] = useState<ApiProduct | null>(null);
  const [selectedComponents, setSelectedComponents] = useState<Record<string, number>>({});
  const [selectedChoices, setSelectedChoices] = useState<Record<string, string[]>>({});
  const [productNotes, setProductNotes] = useState('');
  const [productQuantity, setProductQuantity] = useState(1);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'card' | 'money'>('pix');
  const [changeFor, setChangeFor] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  const storeInfo = useMemo(() => {
    if (!tenant) {
      return null;
    }

    const openingHours = extractTime(tenant.openingHours) || '00:00';
    const closingHours = extractTime(tenant.closingHours) || '23:59';

    return {
      name: tenant.name,
      description: tenant.description || '',
      address: tenant.address || '',
      phone: tenant.phone?.replace(/\D/g, '') || '5511999999999',
      open: isStoreOpen(openingHours, closingHours),
      openingHours,
      closingHours,
      deliveryFee: Number(tenant.deliveryFee ?? 0),
      minOrder: Number(tenant.minOrder ?? 0),
      banner: tenant.bannerUrl || undefined,
      logo: tenant.logoUrl || undefined,
      paymentMethods: tenant.paymentMethods || {
        pix: false,
        cash: true,
        card: true,
      },
      ratingAvg: (tenant as any).ratingAvg || null,
      ratingCount: (tenant as any).ratingCount || 0,
    };
  }, [tenant]);

  const categories = useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.map((c) => c.name);
  }, [categoriesData]);

  const products = useMemo(() => {
    if (!categoriesData) return [];
    return categoriesData.flatMap((category) =>
      (category.products || []).map((product) => ({
        ...product,
        category: category.name,
        active: product.isActive !== false,
      }))
    );
  }, [categoriesData]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  useEffect(() => {
    if (!storeInfo) return;
    const methods = storeInfo.paymentMethods;
    const current = paymentMethod;
    if (current === 'pix' && !methods.pix) {
      if (methods.card) setPaymentMethod('card');
      else if (methods.cash) setPaymentMethod('money');
    } else if (current === 'card' && !methods.card) {
      if (methods.pix) setPaymentMethod('pix');
      else if (methods.cash) setPaymentMethod('money');
    } else if (current === 'money' && !methods.cash) {
      if (methods.pix) setPaymentMethod('pix');
      else if (methods.card) setPaymentMethod('card');
    }
  }, [storeInfo, paymentMethod]);

  const openProductModal = (product: ApiProduct) => {
    setSelectedProduct(product);
    const defaultComponents: Record<string, number> = {};
    (product.components || []).forEach((c) => {
      if (c.isDefault) defaultComponents[c.id] = 1;
    });
    const defaultChoices: Record<string, string[]> = {};
    (product.choiceGroups || []).forEach((g) => {
      const defaults = g.options.filter((o) => o.isDefault).map((o) => o.id);
      if (defaults.length > 0) defaultChoices[g.id] = defaults;
    });
    setSelectedComponents(defaultComponents);
    setSelectedChoices(defaultChoices);
    setProductNotes('');
    setProductQuantity(1);
  };

  const closeProductModal = () => {
    setSelectedProduct(null);
  };

  const setComponentQuantity = (componentId: string, quantity: number) => {
    setSelectedComponents((prev) => {
      if (quantity <= 0) {
        const { [componentId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [componentId]: quantity };
    });
  };

  const toggleChoice = (groupId: string, optionId: string, maxChoices: number) => {
    setSelectedChoices((prev) => {
      const current = prev[groupId] || [];
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= maxChoices) {
        return { ...prev, [groupId]: [...current.slice(1), optionId] };
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
  };

  const calculateModalTotal = () => {
    if (!selectedProduct) return 0;
    let total = Number(selectedProduct.price);

    (selectedProduct.components || []).forEach((component) => {
      const qty = selectedComponents[component.id] || 0;
      if (qty > 0 && !component.includedInPrice) {
        total += Number(component.price) * qty;
      }
    });

    (selectedProduct.choiceGroups || []).forEach((group) => {
      const selected = selectedChoices[group.id] || [];
      selected.forEach((optionId) => {
        const option = group.options.find((o) => o.id === optionId);
        if (option && !option.includedInPrice) {
          total += Number(option.price);
        }
      });
    });

    return total * productQuantity;
  };

  const handleAddToCart = () => {
    if (!selectedProduct) return;

    const cartComponents: CartComponent[] = [];
    (selectedProduct.components || []).forEach((component) => {
      const qty = selectedComponents[component.id] || 0;
      if (qty > 0) {
        cartComponents.push({
          componentId: component.id,
          name: component.name,
          quantity: qty,
          unitPrice: component.includedInPrice ? 0 : Number(component.price),
          inventoryItemId: component.inventoryItemId,
          deductStock: component.deductStock,
        });
      }
    });

    const cartChoices: CartChoice[] = [];
    (selectedProduct.choiceGroups || []).forEach((group) => {
      const selected = selectedChoices[group.id] || [];
      selected.forEach((optionId) => {
        const option = group.options.find((o) => o.id === optionId);
        if (option) {
          cartChoices.push({
            choiceGroupId: group.id,
            choiceGroupName: group.name,
            optionId: option.id,
            optionName: option.name,
            quantity: 1,
            unitPrice: option.includedInPrice ? 0 : Number(option.price),
            inventoryItemId: option.inventoryItemId,
            deductStock: option.deductStock,
          });
        }
      });
    });

    const itemPrice = calculateModalTotal() / productQuantity;

    const cartItem: CartItem = {
      cartId: Math.random().toString(36).substr(2, 9),
      id: selectedProduct.id,
      name: selectedProduct.name,
      basePrice: Number(selectedProduct.price),
      price: itemPrice,
      quantity: productQuantity,
      components: cartComponents,
      choices: cartChoices,
      notes: productNotes,
    };

    setCart([...cart, cartItem]);
    toast.success('Adicionado ao carrinho!');
    closeProductModal();
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.cartId === cartId) {
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : item;
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const deliveryFee = deliveryType === 'delivery' && storeInfo ? storeInfo.deliveryFee : 0;
  const finalTotal = cartTotal + deliveryFee;

  const handleFinishOrder = async () => {
    if (!customerName || !customerPhone) {
      toast.error('Preencha seu nome e telefone!');
      return;
    }

    if (!storeName || !storeInfo) return;

    setIsSubmittingOrder(true);

    const items: ApiCreateOrderRequest['items'] = cart.map((item) => ({
      productId: item.id,
      quantity: item.quantity,
      unitPrice: item.price,
      notes: item.notes || undefined,
      components: item.components.map((comp) => ({
        componentId: comp.componentId,
        name: comp.name,
        quantity: comp.quantity,
        unitPrice: comp.unitPrice,
        inventoryItemId: comp.inventoryItemId,
        deductStock: comp.deductStock,
      })),
      choices: item.choices.map((choice) => ({
        choiceGroupId: choice.choiceGroupId,
        choiceGroupName: choice.choiceGroupName,
        optionId: choice.optionId,
        optionName: choice.optionName,
        quantity: choice.quantity,
        unitPrice: choice.unitPrice,
        inventoryItemId: choice.inventoryItemId,
        deductStock: choice.deductStock,
      })),
    }));

    try {
      const orderResponse = await api<{ id: string; trackingUrl: string }>(`/loja/${storeName}/orders`, {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          customerPhone,
          deliveryAddress: deliveryType === 'delivery' ? address : 'Retirada no Local',
          paymentMethod,
          totalAmount: finalTotal,
          items,
        }),
      });

      const trackingUrl = orderResponse.trackingUrl || `${window.location.origin}/rastrear/${storeName}?orderId=${orderResponse.id}`

      const itemsText = cart
        .map((item) => {
          let text = `${item.quantity}x ${item.name} - R$ ${(item.price * item.quantity).toFixed(2)}`;
          const extras = [
            ...item.components.map((c) => `${c.quantity}x ${c.name}`),
            ...item.choices.map((ch) => ch.optionName),
          ];
          if (extras.length > 0) {
            text += `%0A  + ${extras.join(', ')}`;
          }
          if (item.notes) {
            text += `%0A  *Obs:* ${item.notes}`;
          }
          return text;
        })
        .join('%0A%0A');

      let msg = `*Novo Pedido - ${storeInfo.name}*%0A%0A*Cliente:* ${customerName} (${customerPhone})%0A%0A*Itens:*%0A${itemsText}%0A%0A*Subtotal:* R$ ${cartTotal.toFixed(2)}%0A`;

      if (deliveryType === 'delivery') {
        msg += `*Taxa de Entrega:* R$ ${deliveryFee.toFixed(2)}%0A`;
        msg += `*Total:* R$ ${finalTotal.toFixed(2)}%0A%0A`;
        msg += `*Entrega para:*%0A${address}%0A%0A`;
      } else {
        msg += `*Total:* R$ ${finalTotal.toFixed(2)}%0A%0A`;
        msg += `*Pedido para Retirada no Local*%0A%0A`;
      }

      msg += `*Forma de Pagamento:* ${paymentMethod === 'pix' ? 'PIX' : paymentMethod === 'card' ? 'Cartão' : 'Dinheiro'}`;
      if (paymentMethod === 'money' && changeFor) {
        msg += ` (Troco para R$ ${changeFor})`;
      }
      msg += `%0A%0A*Rastrear pedido:* ${trackingUrl}`

      const whatsappUrl = `https://wa.me/${storeInfo.phone}?text=${msg}`;
      window.open(whatsappUrl, '_blank');

      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setAddress('');
      setCheckoutStep('success')
      setTrackingLink(trackingUrl)
      toast.success('Pedido enviado com sucesso!');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao enviar pedido';
      toast.error(message);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  if (tenantLoading || categoriesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">Carregando loja...</p>
        </div>
      </div>
    );
  }

  if (tenantError || categoriesError || !storeInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#09090b] px-4">
        <div className="text-center max-w-md">
          <Store className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Loja não encontrada</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Não conseguimos carregar essa loja. Verifique o link ou tente novamente mais tarde.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-slate-100 font-sans pb-24">
      {/* Store Header */}
      <header className="bg-white dark:bg-[#121214] border-b border-slate-200 dark:border-[#262626] sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {storeInfo.logo ? (
                <img src={storeInfo.logo} alt={storeInfo.name} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 bg-orange-100 dark:bg-orange-500/20 rounded-full flex items-center justify-center">
                  <Store className="w-6 h-6 text-orange-600 dark:text-orange-500" />
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{storeInfo.name}</h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{storeInfo.description}</p>
                {storeInfo.ratingAvg && storeInfo.ratingCount > 0 ? (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <svg key={n} className={`w-3.5 h-3.5 ${n <= Math.round(storeInfo.ratingAvg!) ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`} viewBox="0 0 20 20" fill="currentColor">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <span className="text-xs font-medium text-slate-500">
                      {storeInfo.ratingAvg.toFixed(1)} ({storeInfo.ratingCount} avaliações)
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <div
              className={`flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full border ${
                storeInfo.open
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full animate-pulse ${storeInfo.open ? 'bg-green-500' : 'bg-red-500'}`} />
              {storeInfo.open ? 'Aberto' : 'Fechado'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {storeInfo.address}</span>
            <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {storeInfo.openingHours} às {storeInfo.closingHours}</span>
            <span className="flex items-center gap-1.5"><Bike className="w-4 h-4" /> Entrega R$ {storeInfo.deliveryFee.toFixed(2).replace('.', ',')}</span>
            {storeInfo.minOrder > 0 && (
              <span className="flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Pedido mínimo R$ {storeInfo.minOrder.toFixed(2).replace('.', ',')}</span>
            )}
          </div>
        </div>

        {/* Categories Navbar */}
        <div className="overflow-x-auto no-scrollbar border-t border-slate-100 dark:border-[#262626]/50">
          <div className="max-w-4xl mx-auto flex gap-6 px-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeCategory === cat
                    ? 'border-orange-500 text-orange-600 dark:text-orange-500'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Menu List */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">{activeCategory}</h2>
        {products.filter((p) => p.category === activeCategory).length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#121214] rounded-2xl border border-slate-200 dark:border-[#262626]">
            <p className="text-slate-500 dark:text-slate-400">Nenhum produto nesta categoria.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {products
              .filter((p) => p.category === activeCategory)
              .map((product) => (
                <div
                  key={product.id}
                  className="bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-2xl p-4 flex gap-4 hover:border-orange-500/50 transition-colors cursor-pointer group"
                  onClick={() => openProductModal(product)}
                >
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white truncate">{product.name}</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{product.description}</p>
                    </div>
                    <div className="mt-4 font-bold text-slate-900 dark:text-white">
                      R$ {Number(product.price).toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                  <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 relative bg-slate-100 dark:bg-[#262626]">
                    <img
                      src={product.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=500&fit=crop'}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Plus className="text-white w-6 h-6" />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>

      {/* Product Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={closeProductModal}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[90vh] bg-white dark:bg-[#121214] rounded-t-3xl z-50 flex flex-col md:max-w-xl md:left-1/2 md:-translate-x-1/2 md:h-auto md:max-h-[90vh] md:rounded-3xl md:bottom-auto md:top-1/2 md:-translate-y-1/2 border border-slate-200 dark:border-[#262626] overflow-hidden"
            >
              <div className="relative h-48 sm:h-64 shrink-0 bg-slate-100 dark:bg-[#262626]">
                <img
                  src={selectedProduct.image || selectedProduct.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&h=500&fit=crop'}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
                <button onClick={closeProductModal} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-sm transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedProduct.name}</h2>
                <p className="text-slate-500 dark:text-slate-400 mt-2">{selectedProduct.description}</p>
                <div className="mt-4 font-bold text-xl text-slate-900 dark:text-white">
                  R$ {Number(selectedProduct.price).toFixed(2).replace('.', ',')}
                </div>

                {selectedProduct.productType !== 'simple' && (selectedProduct.components || []).length > 0 && (
                  <div className="mt-8">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Componentes</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Itens que compõem este produto</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {(selectedProduct.components || []).map((comp) => {
                        const qty = selectedComponents[comp.id] || 0;
                        return (
                          <div
                            key={comp.id}
                            className="flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-[#262626] hover:border-orange-500/50 transition-colors"
                          >
                            <div className="flex-1">
                              <span className="font-medium text-slate-900 dark:text-white block">{comp.name}</span>
                              {!comp.includedInPrice && (
                                <span className="text-sm text-slate-500 dark:text-slate-400">
                                  + R$ {Number(comp.price).toFixed(2).replace('.', ',')} un
                                </span>
                              )}
                              {comp.includedInPrice && (
                                <span className="text-sm text-green-600 dark:text-green-400">Incluso no preço</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 bg-white dark:bg-[#262626] border border-slate-200 dark:border-[#3f3f46] rounded-lg px-1.5 py-1">
                              <button
                                onClick={() => setComponentQuantity(comp.id, qty - 1)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="font-semibold text-sm w-5 text-center">{qty}</span>
                              <button
                                onClick={() => setComponentQuantity(comp.id, qty + 1)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(selectedProduct.choiceGroups || []).map((group) => {
                  const selected = selectedChoices[group.id] || [];
                  return (
                    <div key={group.id} className="mt-8">
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white">{group.name || 'Escolha uma opção'}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {group.required ? 'Obrigatório' : 'Opcional'}
                            {group.minChoices > 0 && ` · mín. ${group.minChoices}`}
                            {group.maxChoices > 1 && ` · máx. ${group.maxChoices}`}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {group.options.map((option) => {
                          const checked = selected.includes(option.id);
                          return (
                            <label
                              key={option.id}
                              className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors ${
                                checked
                                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                                  : 'border-slate-200 dark:border-[#262626] hover:border-orange-500/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type={group.maxChoices === 1 ? 'radio' : 'checkbox'}
                                  name={`choice-${group.id}`}
                                  checked={checked}
                                  onChange={() => toggleChoice(group.id, option.id, group.maxChoices)}
                                  className="w-5 h-5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                />
                                <span className="font-medium text-slate-900 dark:text-white">{option.name}</span>
                              </div>
                              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                                {option.includedInPrice ? 'Incluso' : `+ R$ ${Number(option.price).toFixed(2).replace('.', ',')}`}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div className="mt-8">
                  <h3 className="font-bold text-slate-900 dark:text-white mb-2">Alguma observação?</h3>
                  <textarea
                    value={productNotes}
                    onChange={(e) => setProductNotes(e.target.value)}
                    placeholder="Ex: Tirar cebola, ponto da carne..."
                    className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-xl p-4 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500 transition-colors"
                    rows={3}
                  />
                </div>
              </div>

              <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#09090b] flex items-center gap-4 shrink-0">
                <div className="flex items-center gap-3 bg-white dark:bg-[#262626] border border-slate-200 dark:border-[#3f3f46] rounded-xl px-2 py-1 h-12">
                  <button onClick={() => setProductQuantity(Math.max(1, productQuantity - 1))} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="font-bold text-lg w-6 text-center">{productQuantity}</span>
                  <button onClick={() => setProductQuantity(productQuantity + 1)} className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 bg-orange-600 hover:bg-orange-500 text-white h-12 rounded-xl font-bold transition-all shadow-lg shadow-orange-900/20 flex items-center justify-between px-4"
                >
                  <span>Adicionar</span>
                  <span>
                    R$ {calculateModalTotal().toFixed(2).replace('.', ',')}
                  </span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Cart Button */}
      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent dark:from-[#09090b] dark:via-[#09090b] z-40">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-orange-600 hover:bg-orange-500 text-white p-4 rounded-2xl shadow-xl shadow-orange-900/20 flex items-center justify-between font-bold transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 px-3 py-1 rounded-full text-sm">{cart.reduce((acc, item) => acc + item.quantity, 0)}</div>
                <span>Ver Carrinho</span>
              </div>
              <span>R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Cart/Checkout Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setIsCartOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 h-[85vh] bg-white dark:bg-[#121214] rounded-t-3xl z-50 flex flex-col md:max-w-md md:left-auto md:h-screen md:rounded-none border-l border-slate-200 dark:border-[#262626]"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between shrink-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {checkoutStep === 'cart' ? 'Seu Carrinho' : checkoutStep === 'delivery' ? 'Entrega' : checkoutStep === 'success' ? 'Pedido Enviado!' : 'Pagamento'}
                </h2>
                <button
                  onClick={() => {
                    setIsCartOpen(false);
                    setCheckoutStep('cart');
                  }}
                  className="p-2 bg-slate-100 dark:bg-[#262626] rounded-full text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {checkoutStep === 'cart' && (
                  <div className="space-y-6">
                    {cart.length === 0 ? (
                      <div className="text-center text-slate-500 dark:text-slate-400 py-12">
                        <ShoppingCart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Seu carrinho está vazio</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {cart.map((item) => (
                          <div key={item.cartId} className="flex gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium text-slate-900 dark:text-white truncate">{item.name}</h4>
                              {(item.components.length + item.choices.length) > 0 && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                  + {[
                                    ...item.components.map((c) => `${c.quantity}x ${c.name}`),
                                    ...item.choices.map((ch) => ch.optionName),
                                  ].join(', ')}
                                </p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Obs: {item.notes}</p>
                              )}
                              <p className="text-sm font-bold text-slate-900 dark:text-white mt-1">
                                R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-100 dark:bg-[#262626] rounded-lg px-2 py-1 h-9 shrink-0">
                              <button onClick={() => updateQuantity(item.cartId, -1)} className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="font-semibold text-sm w-4 text-center">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.cartId, 1)} className="p-1 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {checkoutStep === 'delivery' && (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seu Nome</label>
                        <input
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                          placeholder="Como podemos te chamar?"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seu WhatsApp</label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
                          className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                          placeholder="(00) 0 0000-0000"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 bg-slate-100 dark:bg-[#262626] p-1 rounded-xl">
                      <button
                        onClick={() => setDeliveryType('delivery')}
                        className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                          deliveryType === 'delivery'
                            ? 'bg-white dark:bg-[#3f3f46] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Entrega
                      </button>
                      <button
                        onClick={() => setDeliveryType('pickup')}
                        className={`py-2 text-sm font-semibold rounded-lg transition-all ${
                          deliveryType === 'pickup'
                            ? 'bg-white dark:bg-[#3f3f46] text-slate-900 dark:text-white shadow-sm'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Retirada
                      </button>
                    </div>

                    {deliveryType === 'delivery' ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Endereço completo (Rua, número, bairro)</label>
                          <textarea
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                            rows={3}
                            placeholder="Ex: Rua João da Silva, 123, Centro - Apto 42"
                          />
                        </div>
                        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm">
                          <Info className="w-5 h-5 shrink-0" />
                          <p>Taxa de entrega de R$ {storeInfo.deliveryFee.toFixed(2).replace('.', ',')} será adicionada ao total.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center p-6 bg-slate-50 dark:bg-[#18181B] rounded-xl border border-slate-200 dark:border-[#262626]">
                        <MapPin className="w-8 h-8 mx-auto text-orange-500 mb-3" />
                        <h4 className="font-bold text-slate-900 dark:text-white mb-2">Retirar no local</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{storeInfo.address}</p>
                      </div>
                    )}
                  </div>
                )}

                {checkoutStep === 'payment' && (
                  <div className="space-y-6">
                    <h4 className="font-bold text-slate-900 dark:text-white mb-4">Como você prefere pagar?</h4>
                    <div className="space-y-3">
                      {[
                        storeInfo.paymentMethods.pix && { id: 'pix', name: 'PIX', icon: QrCode },
                        storeInfo.paymentMethods.card && { id: 'card', name: 'Cartão na entrega/retirada', icon: CreditCard },
                        storeInfo.paymentMethods.cash && { id: 'money', name: 'Dinheiro', icon: Banknote },
                      ].filter(Boolean).map((method) => (
                        <label
                          key={method.id}
                          className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                            paymentMethod === method.id
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-500/10'
                              : 'border-slate-200 dark:border-[#262626] hover:border-orange-300 dark:hover:border-orange-500/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="payment"
                            value={method.id}
                            checked={paymentMethod === method.id}
                            onChange={(e) => setPaymentMethod(e.target.value as 'pix' | 'card' | 'money')}
                            className="text-orange-500 focus:ring-orange-500"
                          />
                          <method.icon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                          <span className="font-medium text-slate-900 dark:text-white">{method.name}</span>
                        </label>
                      ))}
                    </div>

                    {paymentMethod === 'pix' && storeInfo.paymentMethods.pix && (
                      <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800/30 rounded-xl">
                          <h5 className="font-bold text-purple-900 dark:text-purple-400 mb-2 flex items-center gap-2">
                            <QrCode className="w-4 h-4" /> Pagamento via PIX
                          </h5>
                          <p className="text-sm text-purple-700 dark:text-purple-400 mb-3">
                            {storeInfo.paymentMethods.pixInstructions || 'Envie o comprovante pelo WhatsApp após o pagamento.'}
                          </p>

                          {storeInfo.paymentMethods.pixBeneficiary && (
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-1">
                              <strong>Beneficiário:</strong> {storeInfo.paymentMethods.pixBeneficiary}
                            </p>
                          )}
                          {storeInfo.paymentMethods.pixBank && (
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">
                              <strong>Banco:</strong> {storeInfo.paymentMethods.pixBank}
                            </p>
                          )}

                          {storeInfo.paymentMethods.pixQrCodeImage ? (
                            <div className="flex justify-center">
                              <img src={storeInfo.paymentMethods.pixQrCodeImage} alt="QR Code PIX"
                                className="w-48 h-48 rounded-xl border border-purple-200 dark:border-purple-800/30" />
                            </div>
                          ) : storeInfo.paymentMethods.pixKey ? (
                            <div>
                              <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                                Chave PIX ({storeInfo.paymentMethods.pixKeyType?.toUpperCase()})
                              </label>
                              <div className="flex gap-2">
                                <input type="text" readOnly value={storeInfo.paymentMethods.pixKey}
                                  className="flex-1 px-3 py-2 bg-white dark:bg-[#18181B] border border-purple-200 dark:border-purple-800/30 rounded-lg text-sm text-slate-900 dark:text-white" />
                                <button type="button"
                                  onClick={() => { navigator.clipboard.writeText(storeInfo.paymentMethods.pixKey || ''); toast.success('Chave PIX copiada!') }}
                                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors">
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}

                    {paymentMethod === 'money' && (
                      <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Troco para quanto?</label>
                        <input
                          type="text"
                          value={changeFor}
                          onChange={(e) => setChangeFor(e.target.value)}
                          className="w-full bg-slate-50 dark:bg-[#18181B] border border-slate-200 dark:border-[#262626] rounded-lg p-3 text-slate-900 dark:text-white focus:outline-none focus:border-orange-500"
                          placeholder="Ex: 50, 100 (Opcional)"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              {cart.length > 0 && (
                <div className="p-4 border-t border-slate-200 dark:border-[#262626] bg-slate-50 dark:bg-[#121214] shrink-0">
                  <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-2">
                    <span>Subtotal</span>
                    <span>R$ {cartTotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                  {(checkoutStep === 'delivery' || checkoutStep === 'payment') && deliveryType === 'delivery' && (
                    <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 mb-2">
                      <span>Taxa de Entrega</span>
                      <span>R$ {deliveryFee.toFixed(2).replace('.', ',')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold text-slate-900 dark:text-white mb-4">
                    <span>Total</span>
                    <span>R$ {((checkoutStep === 'delivery' || checkoutStep === 'payment') ? finalTotal : cartTotal).toFixed(2).replace('.', ',')}</span>
                  </div>

                  {checkoutStep === 'cart' && (
                    <button
                      onClick={() => setCheckoutStep('delivery')}
                      className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-900/20"
                    >
                      Continuar
                    </button>
                  )}
                  {checkoutStep === 'delivery' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCheckoutStep('cart')}
                        className="px-4 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-[#262626] dark:hover:bg-[#3f3f46] text-slate-900 dark:text-white rounded-xl font-bold transition-colors"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={() => {
                          if (deliveryType === 'delivery' && address.length < 5) {
                            toast.error('Preencha o endereço de entrega');
                            return;
                          }
                          setCheckoutStep('payment');
                        }}
                        className="flex-1 bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-orange-900/20"
                      >
                        Ir para Pagamento
                      </button>
                    </div>
                  )}
                  {checkoutStep === 'payment' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setCheckoutStep('delivery')}
                        className="px-4 py-3 bg-slate-200 hover:bg-slate-300 dark:bg-[#262626] dark:hover:bg-[#3f3f46] text-slate-900 dark:text-white rounded-xl font-bold transition-colors"
                      >
                        Voltar
                      </button>
                      <button
                        onClick={handleFinishOrder}
                        disabled={isSubmittingOrder}
                        className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:hover:bg-green-600 text-white py-3.5 rounded-xl font-bold transition-all shadow-lg shadow-green-900/20"
                      >
                        {isSubmittingOrder ? 'Enviando...' : 'Enviar Pedido WhatsApp'}
                      </button>
                    </div>
                  )}
                  {checkoutStep === 'success' && trackingLink && (
                    <div className="space-y-4 text-center">
                      <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-500" />
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Pedido enviado com sucesso!</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        O restaurante já recebeu seu pedido e em breve começará a preparar.
                      </p>
                      <div className="bg-slate-50 dark:bg-[#09090b] border border-slate-200 dark:border-[#262626] rounded-xl p-4 space-y-3">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Acompanhe o status do seu pedido:</p>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={trackingLink}
                            className="flex-1 bg-white dark:bg-[#121214] border border-slate-200 dark:border-[#262626] rounded-lg p-2 text-xs text-slate-700 dark:text-slate-300 font-mono truncate"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(trackingLink)
                              toast.success('Link copiado!')
                            }}
                            className="p-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        <a
                          href={trackingLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm transition-colors"
                        >
                          Acompanhar Pedido
                        </a>
                      </div>
                      <button
                        onClick={() => {
                          setCheckoutStep('cart')
                          setTrackingLink('')
                          setIsCartOpen(false)
                        }}
                        className="w-full py-3 bg-slate-100 dark:bg-[#262626] text-slate-700 dark:text-slate-300 rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-[#3f3f46] transition-colors"
                      >
                        Fechar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 20px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #3f3f46;
        }
      `}</style>
    </div>
  );
}
