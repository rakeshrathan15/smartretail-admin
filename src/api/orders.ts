import { api, apiBlob } from './client'
import type {
  AdminOrder,
  Coupon,
  CouponInput,
  OrderRow,
  OrderStats,
  OrderStatus,
  Page,
  PaymentMethod,
  PaymentStatus,
  StoreSettings,
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

export const settingsApi = {
  get: () => api<StoreSettings>('/api/admin/settings'),
  save: (body: StoreSettings) => api<StoreSettings>('/api/admin/settings', { method: 'PUT', json: body }),
}
