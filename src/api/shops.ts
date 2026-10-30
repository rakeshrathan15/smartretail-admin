import { api } from './client'
import type { CustomerOption, Page } from './types'

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK' | 'CHEQUE'
export type ShopStanding = 'ALL' | 'OWING' | 'OVER_LIMIT'

export interface Shop {
  id: string
  ownerUserId: string | null
  name: string
  phone: string | null
  gstin: string | null
  address: string | null
  city: string | null
  pincode: string | null
  routeId: string | null
  routeName: string | null
  creditLimit: number
  /** Negative when the shop has paid in advance. */
  outstanding: number
  overLimit: boolean
  active: boolean
}

export interface ShopInput {
  name: string
  phone: string | null
  gstin: string | null
  address: string | null
  city: string | null
  pincode: string | null
  deliveryRouteId: string | null
  creditLimit: number
}

export interface ShopSummary {
  totalShops: number
  activeShops: number
  creditOutstanding: number
  overLimit: number
}

export interface ShopPayment {
  id: string
  amount: number
  method: PaymentMethod
  reference: string | null
  receivedBy: string | null
  createdAt: string
  voided: boolean
  voidedAt: string | null
  voidedBy: string | null
}

export interface OpenCreditOrder {
  id: string
  orderNumber: string
  createdAt: string
  status: string
  total: number
  due: number
}

export interface ShopLedger {
  shop: Shop
  creditOrdersTotal: number
  paidTotal: number
  openOrders: OpenCreditOrder[]
  payments: ShopPayment[]
}

export interface PaymentInput {
  amount: number
  method: PaymentMethod
  reference: string | null
}

const BASE = '/api/admin/shops'

export const shopsApi = {
  list: (params: { q: string; standing: ShopStanding; page: number }) =>
    api<Page<Shop>>(BASE, { query: { q: params.q, standing: params.standing, page: String(params.page) } }),
  summary: () => api<ShopSummary>(`${BASE}/summary`),
  create: (body: ShopInput) => api<Shop>(BASE, { method: 'POST', json: body }),
  update: (id: string, body: ShopInput) => api<Shop>(`${BASE}/${id}`, { method: 'PUT', json: body }),
  setActive: (id: string, active: boolean) => api<Shop>(`${BASE}/${id}/active`, { method: 'PATCH', json: { active } }),
  ledger: (id: string) => api<ShopLedger>(`${BASE}/${id}/ledger`),
  recordPayment: (id: string, body: PaymentInput) =>
    api<ShopLedger>(`${BASE}/${id}/payments`, { method: 'POST', json: body }),
  voidPayment: (id: string, paymentId: string) =>
    api<ShopLedger>(`${BASE}/${id}/payments/${paymentId}/void`, { method: 'POST', json: {} }),
  searchCustomers: (q: string) => api<CustomerOption[]>(`${BASE}/customers`, { query: { q } }),
  setCredit: (userId: string, creditLimit: number) =>
    api<Shop>(`${BASE}/credit`, { method: 'PUT', json: { userId, creditLimit } }),
}
