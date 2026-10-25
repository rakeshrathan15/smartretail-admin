import { api, apiBlob } from './client'
import type {
  AdminOrder,
  Coupon,
  CouponInput,
  CustomerOption,
  OrderRow,
  OrderStats,
  OrderStatus,
  Page,
  PaymentMethod,
  PaymentStatus,
  ShopCredit,
} from './types'

export interface OrderFilters {
  status?: OrderStatus
  paymentMethod?: PaymentMethod
  paymentStatus?: PaymentStatus
  q?: string
  from?: string
  to?: string
  page?: number
}

export const ordersApi = {
  list: (filters: OrderFilters) => api<Page<OrderRow>>('/api/admin/orders', { query: { ...filters, size: 25 } }),
  stats: () => api<OrderStats>('/api/admin/orders/stats'),
  get: (id: string) => api<AdminOrder>(`/api/admin/orders/${id}`),
  changeStatus: (id: string, status: OrderStatus) =>
    api<AdminOrder>(`/api/admin/orders/${id}/status`, { method: 'POST', json: { status } }),
  reviewPayment: (id: string, decision: 'APPROVE' | 'REJECT') =>
    api<AdminOrder>(`/api/admin/orders/${id}/payment-review`, { method: 'POST', json: { decision } }),
  paymentScreenshot: (id: string) => apiBlob(`/api/admin/orders/${id}/payment-screenshot`),
}

export const couponsApi = {
  list: () => api<Coupon[]>('/api/admin/coupons'),
  create: (body: CouponInput) => api<Coupon>('/api/admin/coupons', { method: 'POST', json: body }),
  update: (id: string, body: CouponInput) => api<Coupon>(`/api/admin/coupons/${id}`, { method: 'PUT', json: body }),
  remove: (id: string) => api<void>(`/api/admin/coupons/${id}`, { method: 'DELETE' }),
}

export const shopsApi = {
  list: () => api<ShopCredit[]>('/api/admin/shops'),
  searchCustomers: (q: string) => api<CustomerOption[]>('/api/admin/shops/customers', { query: { q } }),
  setCredit: (userId: string, creditLimit: number, shopName?: string) =>
    api<ShopCredit>('/api/admin/shops/credit', { method: 'PUT', json: { userId, creditLimit, shopName } }),
}
