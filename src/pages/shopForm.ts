import type { PaymentInput, PaymentMethod, Shop, ShopInput } from '../api/shops'

export interface ShopFormValues {
  name: string
  phone: string
  gstin: string
  address: string
  city: string
  pincode: string
  routeId: string
  creditLimit: string
}

export const emptyShopForm: ShopFormValues = {
  name: '',
  phone: '',
  gstin: '',
  address: '',
  city: '',
  pincode: '',
  routeId: '',
  creditLimit: '0',
}

export function formFromShop(shop: Shop): ShopFormValues {
  return {
    name: shop.name,
    phone: shop.phone ?? '',
    gstin: shop.gstin ?? '',
    address: shop.address ?? '',
    city: shop.city ?? '',
    pincode: shop.pincode ?? '',
    routeId: shop.routeId ?? '',
    creditLimit: String(shop.creditLimit),
  }
}

const orNull = (value: string) => value.trim() || null

export function inputFromShopForm(form: ShopFormValues): ShopInput {
  return {
    name: form.name.trim(),
    phone: orNull(form.phone),
    gstin: orNull(form.gstin)?.toUpperCase() ?? null,
    address: orNull(form.address),
    city: orNull(form.city),
    pincode: orNull(form.pincode),
    deliveryRouteId: orNull(form.routeId),
    creditLimit: Number(form.creditLimit),
  }
}

/** The same rules as the backend's ShopRequest, so mistakes show before saving. */
export function shopFormErrors(form: ShopFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const gstin = form.gstin.trim().toUpperCase()
  const phone = form.phone.replace(/\D/g, '').replace(/^(91(?=\d{10}$)|0(?=\d{10}$))/, '')
  const limit = form.creditLimit.trim()
  if (!form.name.trim()) errors.name = 'Enter the shop name'
  if (form.phone.trim() && !/^[6-9]\d{9}$/.test(phone)) errors.phone = 'Enter a 10-digit mobile number'
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    errors.gstin = 'A GSTIN has 15 characters, e.g. 36ABCDE1234F1Z5'
  }
  if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) errors.pincode = 'A PIN code has 6 digits'
  if (limit === '' || !(Number(limit) >= 0)) errors.creditLimit = 'Enter 0 or more'
  return errors
}

export interface PaymentFormValues {
  amount: string
  method: PaymentMethod
  reference: string
}

export const emptyPaymentForm: PaymentFormValues = { amount: '', method: 'CASH', reference: '' }

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'Cash' },
  { value: 'UPI', label: 'UPI' },
  { value: 'BANK', label: 'Bank' },
  { value: 'CHEQUE', label: 'Cheque' },
]

export const paymentMethodLabel = (method: PaymentMethod) =>
  PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method

export function inputFromPaymentForm(form: PaymentFormValues): PaymentInput {
  return { amount: Number(form.amount), method: form.method, reference: orNull(form.reference) }
}

export function paymentFormErrors(form: PaymentFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const amount = form.amount.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) errors.amount = 'Enter an amount in rupees and paise'
  if (form.reference.trim().length > 100) errors.reference = 'Keep the reference under 100 characters'
  return errors
}
