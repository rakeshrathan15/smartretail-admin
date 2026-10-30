// Mirrors the backend's AuthDtos and CatalogDtos. Money is rupees per case.

export interface UserSummary {
  id: string
  email: string | null
  phone: string | null
  fullName: string | null
  roles: string[]
  shopProfileComplete: boolean
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number
  user: UserSummary
}

export interface Page<T> {
  items: T[]
  page: number
  size: number
  totalItems: number
  totalPages: number
}

export interface Category {
  id: string
  name: string
  slug: string
  imageUrl: string | null
  active: boolean
  sortOrder: number
}

export interface ProductRow {
  id: string
  slug: string
  name: string
  brand: string | null
  categoryName: string | null
  unitsPerCase: number
  price: number
  lowestPrice: number
  imageUrl: string | null
  stockQuantity: number
  lowStockThreshold: number
  active: boolean
}

export interface ProductImage {
  id: string
  url: string
  primary: boolean
}

export interface Slab {
  minQty: number
  maxQty: number | null
  pricePerCase: number
}

export interface ProductDetail {
  id: string
  slug: string
  name: string
  brand: string | null
  flavor: string | null
  category: Category | null
  unitVolumeMl: number | null
  unitsPerCase: number
  weight: string | null
  price: number
  originalPrice: number | null
  lowestPrice: number
  inStock: boolean
  badge: string | null
  description: string | null
  ingredients: string | null
  images: ProductImage[]
  slabs: Slab[]
}

export interface AdminProduct {
  product: ProductDetail
  costPrice: number | null
  stockQuantity: number
  lowStockThreshold: number
  barcode: string | null
  active: boolean
}

/** Body for creating or updating a product. */
export interface ProductInput {
  name: string
  categoryId: string | null
  brand: string | null
  flavor: string | null
  unitVolumeMl: number | null
  unitsPerCase: number
  weight: string | null
  price: number
  originalPrice: number | null
  costPrice: number | null
  stockQuantity: number
  lowStockThreshold: number
  barcode: string | null
  badge: string | null
  description: string | null
  ingredients: string | null
  active: boolean
}

export interface Banner {
  id: string
  title: string
  subtitle: string | null
  ctaText: string | null
  link: string | null
  imageUrl: string | null
  active: boolean
  sortOrder: number
}

export interface BannerInput {
  title: string
  subtitle: string | null
  ctaText: string | null
  link: string | null
  active: boolean
}

// ---- Orders ------------------------------------------------------------

export type OrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURNED'

export type PaymentMethod = 'COD' | 'UPI' | 'CREDIT' | 'CASH'
export type PaymentStatus = 'PENDING' | 'PENDING_VERIFICATION' | 'PAID' | 'FAILED' | 'REFUNDED'

export interface OrderRow {
  id: string
  orderNumber: string
  createdAt: string
  shopName: string | null
  customerName: string | null
  customerPhone: string | null
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentTerms: 'PREPAID' | 'CREDIT'
  total: number
  totalCases: number
}

export interface OrderStats {
  todayOrders: number
  todayRevenue: number
  awaitingConfirmation: number
  upiToVerify: number
  codToCollect: number
}

export interface OrderAddress {
  label: string
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  pincode: string
}

export interface OrderDetail {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  paymentTerms: 'PREPAID' | 'CREDIT'
  subtotal: number
  couponCode: string | null
  discount: number
  deliveryCharge: number
  total: number
  totalCases: number
  address: OrderAddress | null
  notes: string | null
  createdAt: string
  items: { productId: string | null; productName: string; quantity: number; price: number; total: number }[]
}

export interface AdminOrder {
  order: OrderDetail
  userId: string | null
  shopId: string | null
  shopName: string | null
  customerName: string | null
  customerPhone: string | null
  hasPaymentScreenshot: boolean
  nextStatuses: OrderStatus[]
  paymentNeedsReview: boolean
}

// ---- Coupons and credit -----------------------------------------------

export interface Coupon {
  id: string
  code: string
  description: string | null
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: number
  minOrderValue: number
  maxDiscount: number | null
  usageLimit: number | null
  usedCount: number
  validFrom: string | null
  validUntil: string | null
  active: boolean
}

export type CouponInput = Omit<Coupon, 'id' | 'usedCount'>

export interface CustomerOption {
  userId: string
  fullName: string | null
  shopName: string | null
  phone: string | null
  email: string | null
  creditLimit: number | null
}

// ---- Store settings ---------------------------------------------------

export interface StoreSettings {
  storeName: string
  storePhone: string
  storeEmail: string
  storeAddress: string
  whatsappNumber: string
  storeOpen: boolean
  deliveryCharge: number
  freeDeliveryAbove: number
  minOrderValue: number
  upiId: string
  gstNumber: string
  fssaiNumber: string
  showCertifications: boolean
}
