import type {
  AdjustmentInput,
  AdjustmentReason,
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ReceiptInput,
  Supplier,
  SupplierInput,
} from '../api/purchasing'

const orNull = (value: string) => value.trim() || null
const MONEY = /^\d+(\.\d{1,2})?$/
const GSTIN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

// ---- Suppliers: the same rules as the backend's SupplierRequest.

export interface SupplierFormValues {
  name: string
  phone: string
  gstin: string
  address: string
  notes: string
}

export const emptySupplierForm: SupplierFormValues = { name: '', phone: '', gstin: '', address: '', notes: '' }

export function formFromSupplier(s: Supplier): SupplierFormValues {
  return { name: s.name, phone: s.phone ?? '', gstin: s.gstin ?? '', address: s.address ?? '', notes: s.notes ?? '' }
}

export function inputFromSupplierForm(f: SupplierFormValues): SupplierInput {
  return {
    name: f.name.trim(),
    phone: orNull(f.phone),
    gstin: orNull(f.gstin)?.toUpperCase() ?? null,
    address: orNull(f.address),
    notes: orNull(f.notes),
  }
}

export function supplierFormErrors(f: SupplierFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!f.name.trim()) errors.name = 'Enter the supplier name'
  if (f.phone.trim() && !/^[0-9+ -]{6,20}$/.test(f.phone.trim())) errors.phone = 'Enter a phone number'
  if (f.gstin.trim() && !GSTIN.test(f.gstin.trim().toUpperCase())) errors.gstin = 'A GSTIN has 15 characters, e.g. 36ABCDE1234F1Z5'
  return errors
}

// ---- Stock receipts

export interface ReceiptLine {
  productId: string
  name: string
  quantity: string
  cost: string
}

export interface ReceiptFormValues {
  supplierId: string
  storeId: string
  receiptDate: string
  invoiceNumber: string
  notes: string
  lines: ReceiptLine[]
}

/** Worked out in paise, so a long bill does not pick up rounding errors. */
export function receiptTotal(lines: ReceiptLine[]): number {
  const paise = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * Math.round((Number(l.cost) || 0) * 100), 0)
  return paise / 100
}

export function inputFromReceiptForm(f: ReceiptFormValues): ReceiptInput {
  return {
    supplierId: orNull(f.supplierId),
    storeId: orNull(f.storeId),
    receiptDate: f.receiptDate,
    invoiceNumber: orNull(f.invoiceNumber),
    notes: orNull(f.notes),
    items: f.lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), costPrice: Number(l.cost) })),
  }
}

export function receiptFormErrors(f: ReceiptFormValues, today: string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!f.receiptDate) errors.receiptDate = 'Choose the date'
  else if (f.receiptDate > today) errors.receiptDate = 'The date cannot be in the future'
  if (f.lines.length === 0) errors.lines = 'Add at least one product'
  f.lines.forEach((l) => {
    if (!/^\d+$/.test(l.quantity.trim()) || Number(l.quantity) < 1 || Number(l.quantity) > 100000) {
      errors[`quantity-${l.productId}`] = 'Cases, 1 or more'
    }
    if (!MONEY.test(l.cost.trim())) errors[`cost-${l.productId}`] = 'Enter the cost'
  })
  return errors
}

// ---- Stock adjustments

export const ADJUSTMENT_REASONS: { value: AdjustmentReason; label: string }[] = [
  { value: 'DAMAGE', label: 'Damaged' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CORRECTION', label: 'Count correction' },
  { value: 'OTHER', label: 'Other' },
]

export const reasonLabel = (reason: AdjustmentReason) => ADJUSTMENT_REASONS.find((r) => r.value === reason)?.label ?? reason

export interface AdjustmentFormValues {
  delta: string
  reason: AdjustmentReason
  notes: string
}

export const emptyAdjustmentForm: AdjustmentFormValues = { delta: '', reason: 'DAMAGE', notes: '' }

export function inputFromAdjustmentForm(productId: string, f: AdjustmentFormValues): AdjustmentInput {
  return { productId, delta: Number(f.delta), reason: f.reason, notes: orNull(f.notes) }
}

export function adjustmentFormErrors(f: AdjustmentFormValues, stock: number): Record<string, string> {
  const errors: Record<string, string> = {}
  const delta = f.delta.trim()
  if (!/^[+-]?\d+$/.test(delta) || Number(delta) === 0) errors.delta = 'Enter a change such as -2 or +5'
  else if (Math.abs(Number(delta)) > 100000) errors.delta = 'That change is too large'
  else if (stock + Number(delta) < 0) errors.delta = `Only ${stock} cases are in stock`
  if (f.reason === 'OTHER' && !f.notes.trim()) errors.notes = 'Say why'
  return errors
}

// ---- Expenses

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'GENERAL', label: 'General' },
  { value: 'RENT', label: 'Rent' },
  { value: 'SALARIES', label: 'Salaries' },
  { value: 'FUEL', label: 'Fuel' },
  { value: 'UTILITIES', label: 'Utilities' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'OTHER', label: 'Other' },
]

export const categoryLabel = (category: ExpenseCategory) => EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category

export interface ExpenseFormValues {
  title: string
  category: ExpenseCategory
  amount: string
  description: string
  expenseDate: string
}

export function formFromExpense(e: Expense): ExpenseFormValues {
  return { title: e.title, category: e.category, amount: String(e.amount), description: e.description ?? '', expenseDate: e.expenseDate }
}

export function inputFromExpenseForm(f: ExpenseFormValues): ExpenseInput {
  return {
    title: f.title.trim(),
    category: f.category,
    amount: Number(f.amount),
    description: orNull(f.description),
    expenseDate: f.expenseDate,
  }
}

export function expenseFormErrors(f: ExpenseFormValues, today: string): Record<string, string> {
  const errors: Record<string, string> = {}
  const amount = f.amount.trim()
  if (!f.title.trim()) errors.title = 'Enter a title'
  if (!MONEY.test(amount) || Number(amount) <= 0) errors.amount = 'Enter an amount in rupees and paise'
  if (!f.expenseDate) errors.expenseDate = 'Choose the date'
  else if (f.expenseDate > today) errors.expenseDate = 'The date cannot be in the future'
  return errors
}
