import { api } from './client'
import type { Page } from './types'

export interface Supplier {
  id: string
  name: string
  phone: string | null
  gstin: string | null
  address: string | null
  notes: string | null
  active: boolean
}

export type SupplierInput = Omit<Supplier, 'id' | 'active'>

export const suppliersApi = {
  list: () => api<Supplier[]>('/api/admin/suppliers'),
  create: (body: SupplierInput) => api<Supplier>('/api/admin/suppliers', { method: 'POST', json: body }),
  update: (id: string, body: SupplierInput) => api<Supplier>(`/api/admin/suppliers/${id}`, { method: 'PUT', json: body }),
  setActive: (id: string, active: boolean) =>
    api<Supplier>(`/api/admin/suppliers/${id}/active`, { method: 'PATCH', json: { active } }),
}

export type StockLevel = 'OK' | 'LOW' | 'OUT'
export type LevelFilter = 'ALL' | 'LOW' | 'OUT'
export type AdjustmentReason = 'DAMAGE' | 'EXPIRED' | 'CORRECTION' | 'OTHER'

export interface InventoryRow {
  productId: string
  name: string
  brand: string | null
  stock: number
  lowStockThreshold: number
  costPrice: number | null
  sellPrice: number
  stockValue: number | null
  level: StockLevel
  active: boolean
}

export interface InventorySummary {
  products: number
  lowStock: number
  outOfStock: number
  stockValue: number
  potentialProfit: number
}

export interface Adjustment {
  id: string
  productId: string
  productName: string
  delta: number
  reason: AdjustmentReason
  notes: string | null
  createdBy: string | null
  createdAt: string
}

export interface AdjustmentInput {
  productId: string
  delta: number
  reason: AdjustmentReason
  notes: string | null
}

export interface Receipt {
  id: string
  receiptDate: string
  supplierName: string | null
  storeName: string | null
  invoiceNumber: string | null
  totalCost: number
  itemCount: number
  totalCases: number
  createdBy: string | null
  createdAt: string
}

export interface ReceiptItem {
  productId: string
  productName: string
  quantity: number
  costPrice: number
  total: number
}

export interface ReceiptDetail {
  receipt: Receipt
  notes: string | null
  items: ReceiptItem[]
}

export interface ReceiptInput {
  supplierId: string | null
  storeId: string | null
  receiptDate: string
  invoiceNumber: string | null
  notes: string | null
  items: { productId: string; quantity: number; costPrice: number }[]
}

const INVENTORY = '/api/admin/inventory'

export const inventoryApi = {
  stock: (params: { q: string; level: LevelFilter; page: number }) =>
    api<Page<InventoryRow>>(INVENTORY, { query: { q: params.q, level: params.level, page: String(params.page) } }),
  summary: () => api<InventorySummary>(`${INVENTORY}/summary`),
  adjustments: (page: number) => api<Page<Adjustment>>(`${INVENTORY}/adjustments`, { query: { page: String(page) } }),
  adjust: (body: AdjustmentInput) => api<{ id: string }>(`${INVENTORY}/adjustments`, { method: 'POST', json: body }),
  receipts: (page: number) => api<Page<Receipt>>(`${INVENTORY}/receipts`, { query: { page: String(page) } }),
  receipt: (id: string) => api<ReceiptDetail>(`${INVENTORY}/receipts/${id}`),
  receive: (body: ReceiptInput) => api<ReceiptDetail>(`${INVENTORY}/receipts`, { method: 'POST', json: body }),
}

export type ExpenseCategory = 'GENERAL' | 'RENT' | 'SALARIES' | 'FUEL' | 'UTILITIES' | 'MAINTENANCE' | 'TRANSPORT' | 'MARKETING' | 'OTHER'

export interface Expense {
  id: string
  title: string
  category: ExpenseCategory
  amount: number
  description: string | null
  expenseDate: string
}

export type ExpenseInput = Omit<Expense, 'id'>

export interface ExpenseFilters {
  from: string
  to: string
  category: string
}

export interface ExpenseSummary {
  total: number
  count: number
  byCategory: { category: ExpenseCategory; total: number }[]
}

const filterQuery = (f: ExpenseFilters) => ({
  ...(f.from && { from: f.from }),
  ...(f.to && { to: f.to }),
  ...(f.category && { category: f.category }),
})

export const expensesApi = {
  list: (filters: ExpenseFilters, page: number) =>
    api<Page<Expense>>('/api/admin/expenses', { query: { ...filterQuery(filters), page: String(page) } }),
  summary: (filters: ExpenseFilters) => api<ExpenseSummary>('/api/admin/expenses/summary', { query: filterQuery(filters) }),
  create: (body: ExpenseInput) => api<Expense>('/api/admin/expenses', { method: 'POST', json: body }),
  update: (id: string, body: ExpenseInput) => api<Expense>(`/api/admin/expenses/${id}`, { method: 'PUT', json: body }),
  remove: (id: string) => api<void>(`/api/admin/expenses/${id}`, { method: 'DELETE' }),
}
