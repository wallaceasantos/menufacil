export type { PlanType } from '../data/plans';

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'tenant';
  plan?: 'basico' | 'completo';
  paymentStatus?: 'paid' | 'overdue';
  overdueDays?: number;
  tenantId?: string | null;
  tenantSlug?: string;
  subscriptionStatus?: string;
  cardLastFour?: string | null;
  nextBillingDate?: string | null;
  tenantRole?: string;
  ownerCpfCnpj?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingPostalCode?: string | null;
  billingAddressNumber?: string | null;
}

export interface PaymentMethods {
  pix: boolean;
  pixKey?: string;
  pixKeyType?: string;
  pixBeneficiary?: string;
  pixBank?: string;
  pixOnDelivery?: boolean;
  pixQrCodeImage?: string | null;
  pixInstructions?: string;
  cash: boolean;
  card: boolean;
}

export interface ApiTenant {
  id: string;
  slug: string;
  name: string;
  type: string;
  email: string;
  plan: 'basico' | 'completo';
  status: string;
  paymentStatus?: string;
  overdueDays?: number;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  ownerCpfCnpj?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  billingEmail?: string | null;
  billingPhone?: string | null;
  billingPostalCode?: string | null;
  billingAddressNumber?: string | null;
  deliveryFee?: number | string | null;
  minOrder?: number | string | null;
  openingHours?: string | null;
  closingHours?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  customDomain?: string | null;
  paymentMethods?: PaymentMethods;
  createdAt?: string;
  updatedAt?: string;
  ratingAvg?: number | null;
  ratingCount?: number;
}

export interface ApiCategory {
  id: string;
  tenantId: string;
  name: string;
  sortOrder: number;
  products?: ApiProduct[];
}

export type ProductType = 'simple' | 'combo' | 'buildable';

export interface ApiProductRecipe {
  inventoryItemId: string;
  quantity: number;
}

export interface ApiProductComponent {
  id: string;
  name: string;
  inventoryItemId?: string | null;
  quantity: number;
  price: number;
  includedInPrice: boolean;
  deductStock: boolean;
  isDefault: boolean;
  sortOrder?: number;
}

export interface ApiProductChoiceOption {
  id: string;
  name: string;
  inventoryItemId?: string | null;
  quantity: number;
  price: number;
  includedInPrice: boolean;
  deductStock: boolean;
  isDefault: boolean;
  sortOrder?: number;
}

export interface ApiProductChoiceGroup {
  id: string;
  name: string;
  minChoices: number;
  maxChoices: number;
  required: boolean;
  sortOrder?: number;
  options: ApiProductChoiceOption[];
}

export interface ApiProduct {
  id: string;
  tenantId?: string;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  imageUrl?: string | null;
  productType?: ProductType;
  isActive?: boolean;
  autoDeductStock?: boolean;
  recipe?: ApiProductRecipe[];
  components?: ApiProductComponent[];
  choiceGroups?: ApiProductChoiceGroup[];
}

export interface ApiOrderItemComponent {
  componentId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId?: string | null;
  deductStock: boolean;
}

export interface ApiOrderItemChoice {
  choiceGroupId: string;
  choiceGroupName: string;
  optionId: string;
  optionName: string;
  quantity: number;
  unitPrice: number;
  inventoryItemId?: string | null;
  deductStock: boolean;
}

export interface ApiOrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  components?: ApiOrderItemComponent[];
  choices?: ApiOrderItemChoice[];
}

export interface ApiCreateOrderRequest {
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  paymentMethod?: string;
  items: ApiOrderItem[];
  totalAmount: number;
}
