// Stores, delivery routes, customers and pick-lists. Mirrors the backend's StoreDtos, RouteDtos,
// CustomerDirectory and PickListService.
import { api } from './client'
import type { Page } from './types'

export interface Store {
  id: string
  name: string
  gstin: string | null
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  pincode: string | null
  active: boolean
  routeCount: number
}

export type StoreInput = Pick<Store, 'name' | 'gstin' | 'phone' | 'email' | 'address' | 'city' | 'pincode'>

export interface MapPoint {
  lat: number
  lng: number
}

export type Zone =
  | { shape: 'POLYGON'; points: MapPoint[]; center?: null; radiusKm?: null }
  | { shape: 'CIRCLE'; center: MapPoint; radiusKm: number; points?: null }

export type DayCode = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN'

export interface DeliveryRoute {
  id: string
  name: string
  area: string | null
  days: DayCode[]
  storeId: string | null
  storeName: string | null
  color: string | null
  zone: Zone | null
  active: boolean
  sortOrder: number
  shopCount: number
  nextDeliveryDate: string | null
}

export interface RouteInput {
  name: string
  area: string | null
  days: DayCode[]
  storeId: string | null
  color: string | null
  zone: Zone | null
  sortOrder: number
  active: boolean
}

export interface ShopPin {
  userId: string
  shopName: string
  lat: number
  lng: number
  routeId: string | null
}

export interface ReassignResult {
  assigned: number
  unassigned: number
}

export interface CustomerRow {
  userId: string
  shopName: string | null
  fullName: string | null
  phone: string | null
  email: string | null
  city: string | null
  pincode: string | null
  hasLocation: boolean
  profileComplete: boolean
  routeId: string | null
  routeName: string | null
  routeColor: string | null
  joinedAt: string
}

export interface PickOrder {
  id: string
  orderNumber: string
  shopName: string | null
  customerPhone: string | null
  status: string
  paymentMethod: string
  totalCases: number
  total: number
}

export interface PickItem {
  productId: string | null
  productName: string
  brand: string | null
  unitsPerCase: number
  cases: number
  units: number
  value: number
}

export interface PickList {
  routeId: string | null
  routeName: string
  date: string
  orders: PickOrder[]
  items: PickItem[]
  totals: { orders: number; uniqueSkus: number; cases: number; units: number; itemsValue: number; revenue: number }
}

/** `all`, `unassigned` or a route id. */
export type RouteChoice = string

export const storesApi = {
  list: () => api<Store[]>('/api/admin/stores'),
  create: (body: StoreInput) => api<Store>('/api/admin/stores', { method: 'POST', json: body }),
  update: (id: string, body: StoreInput) => api<Store>(`/api/admin/stores/${id}`, { method: 'PUT', json: body }),
  setActive: (id: string, active: boolean) =>
    api<Store>(`/api/admin/stores/${id}/active`, { method: 'PATCH', json: { active } }),
  remove: (id: string) => api<void>(`/api/admin/stores/${id}`, { method: 'DELETE' }),
}

export const routesApi = {
  list: () => api<DeliveryRoute[]>('/api/admin/routes'),
  shopPins: () => api<ShopPin[]>('/api/admin/routes/shop-pins'),
  create: (body: RouteInput) => api<DeliveryRoute>('/api/admin/routes', { method: 'POST', json: body }),
  update: (id: string, body: RouteInput) => api<DeliveryRoute>(`/api/admin/routes/${id}`, { method: 'PUT', json: body }),
  setActive: (id: string, active: boolean) =>
    api<DeliveryRoute>(`/api/admin/routes/${id}/active`, { method: 'PATCH', json: { active } }),
  remove: (id: string) => api<void>(`/api/admin/routes/${id}`, { method: 'DELETE' }),
  reassign: () => api<ReassignResult>('/api/admin/routes/reassign', { method: 'POST' }),
}

export const customersApi = {
  list: (filters: { q?: string; route?: RouteChoice; page?: number }) =>
    api<Page<CustomerRow>>('/api/admin/customers', { query: { ...filters, size: 25 } }),
}

export const pickListApi = {
  get: (route: RouteChoice, date: string) => api<PickList>('/api/admin/pick-list', { query: { route, date } }),
}
