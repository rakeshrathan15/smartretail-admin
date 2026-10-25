import type { AdminProduct, ProductInput, Slab } from '../api/types'

/** The product form keeps every input as text; this turns it into the API body. */
export interface ProductFormValues {
  name: string
  categoryId: string
  brand: string
  flavor: string
  unitVolumeMl: string
  unitsPerCase: string
  weight: string
  price: string
  originalPrice: string
  costPrice: string
  stockQuantity: string
  lowStockThreshold: string
  barcode: string
  badge: string
  description: string
  ingredients: string
  active: boolean
}

export const emptyProductForm: ProductFormValues = {
  name: '',
  categoryId: '',
  brand: '',
  flavor: '',
  unitVolumeMl: '',
  unitsPerCase: '12',
  weight: '',
  price: '',
  originalPrice: '',
  costPrice: '',
  stockQuantity: '0',
  lowStockThreshold: '5',
  barcode: '',
  badge: '',
  description: '',
  ingredients: '',
  active: true,
}

const text = (value: string | null | undefined) => value ?? ''
const num = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value))

export function formFromProduct(admin: AdminProduct): ProductFormValues {
  const p = admin.product
  return {
    name: p.name,
    categoryId: p.category?.id ?? '',
    brand: text(p.brand),
    flavor: text(p.flavor),
    unitVolumeMl: num(p.unitVolumeMl),
    unitsPerCase: String(p.unitsPerCase),
    weight: text(p.weight),
    price: String(p.price),
    originalPrice: num(p.originalPrice),
    costPrice: num(admin.costPrice),
    stockQuantity: String(admin.stockQuantity),
    lowStockThreshold: String(admin.lowStockThreshold),
    barcode: text(admin.barcode),
    badge: text(p.badge),
    description: text(p.description),
    ingredients: text(p.ingredients),
    active: admin.active,
  }
}

const orNull = (value: string) => (value.trim() === '' ? null : value.trim())
const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

export function inputFromForm(form: ProductFormValues): ProductInput {
  return {
    name: form.name.trim(),
    categoryId: orNull(form.categoryId),
    brand: orNull(form.brand),
    flavor: orNull(form.flavor),
    unitVolumeMl: numberOrNull(form.unitVolumeMl),
    unitsPerCase: Number(form.unitsPerCase),
    weight: orNull(form.weight),
    price: Number(form.price),
    originalPrice: numberOrNull(form.originalPrice),
    costPrice: numberOrNull(form.costPrice),
    stockQuantity: Number(form.stockQuantity || 0),
    lowStockThreshold: Number(form.lowStockThreshold || 0),
    barcode: orNull(form.barcode),
    badge: orNull(form.badge),
    description: orNull(form.description),
    ingredients: orNull(form.ingredients),
    active: form.active,
  }
}

/** Quick checks before saving; the backend checks the same and more. Returns errors by field. */
export function productFormErrors(form: ProductFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Enter a product name'
  if (!(Number(form.unitsPerCase) > 0) || !Number.isInteger(Number(form.unitsPerCase))) {
    errors.unitsPerCase = 'Units per case must be a whole number above 0'
  }
  if (form.price.trim() === '' || !(Number(form.price) >= 0)) errors.price = 'Enter the price per case'
  if (form.originalPrice.trim() !== '' && Number(form.originalPrice) < Number(form.price)) {
    errors.originalPrice = 'Original price should be at least the price, or leave it empty'
  }
  return errors
}

export interface SlabRow {
  minQty: string
  maxQty: string
  pricePerCase: string
}

export function rowsFromSlabs(slabs: Slab[]): SlabRow[] {
  return slabs.map((s) => ({
    minQty: String(s.minQty),
    maxQty: s.maxQty === null ? '' : String(s.maxQty),
    pricePerCase: String(s.pricePerCase),
  }))
}

/**
 * Checks slab rows the same way the backend does: whole numbers, no duplicate or
 * overlapping ranges, and no slab priced above the base price. Returns the slabs
 * sorted by min cases, or an error message.
 */
export function parseSlabs(rows: SlabRow[], basePrice: number): { slabs: Slab[] } | { error: string } {
  const slabs: Slab[] = []
  for (const row of rows) {
    const minQty = Number(row.minQty)
    const maxQty = row.maxQty.trim() === '' ? null : Number(row.maxQty)
    const pricePerCase = Number(row.pricePerCase)
    if (!Number.isInteger(minQty) || minQty < 1) return { error: 'Min cases must be a whole number of at least 1' }
    if (maxQty !== null && (!Number.isInteger(maxQty) || maxQty < minQty)) {
      return { error: `Max cases must be at least min cases (${minQty})` }
    }
    if (row.pricePerCase.trim() === '' || !(pricePerCase >= 0)) return { error: `Enter a price for ${minQty}+ cases` }
    if (pricePerCase > basePrice) return { error: `Price for ${minQty}+ cases is above the base price` }
    slabs.push({ minQty, maxQty, pricePerCase })
  }
  slabs.sort((a, b) => a.minQty - b.minQty)
  for (let i = 1; i < slabs.length; i++) {
    const previous = slabs[i - 1]
    if (previous.minQty === slabs[i].minQty) return { error: `Two slabs start at ${slabs[i].minQty} cases` }
    if (previous.maxQty !== null && slabs[i].minQty <= previous.maxQty) {
      return { error: `Slabs ${previous.minQty}-${previous.maxQty} and ${slabs[i].minQty}+ overlap` }
    }
  }
  return { slabs }
}
