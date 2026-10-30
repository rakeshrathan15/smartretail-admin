import type { Store, StoreInput } from '../api/delivery'

export interface StoreFormValues {
  name: string
  gstin: string
  phone: string
  email: string
  address: string
  city: string
  pincode: string
}

export const emptyStoreForm: StoreFormValues = { name: '', gstin: '', phone: '', email: '', address: '', city: '', pincode: '' }

export function formFromStore(store: Store): StoreFormValues {
  return {
    name: store.name,
    gstin: store.gstin ?? '',
    phone: store.phone ?? '',
    email: store.email ?? '',
    address: store.address ?? '',
    city: store.city ?? '',
    pincode: store.pincode ?? '',
  }
}

const orNull = (value: string) => value.trim() || null

export function inputFromStoreForm(form: StoreFormValues): StoreInput {
  return {
    name: form.name.trim(),
    gstin: orNull(form.gstin)?.toUpperCase() ?? null,
    phone: orNull(form.phone),
    email: orNull(form.email),
    address: orNull(form.address),
    city: orNull(form.city),
    pincode: orNull(form.pincode),
  }
}

/** The same rules as the backend's StoreRequest, so mistakes show before saving. */
export function storeFormErrors(form: StoreFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  const gstin = form.gstin.trim().toUpperCase()
  if (!form.name.trim()) errors.name = 'Enter the store name'
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) {
    errors.gstin = 'A GSTIN has 15 characters, e.g. 36ABCDE1234F1Z5'
  }
  if (form.phone.trim() && !/^[0-9+ -]{6,20}$/.test(form.phone.trim())) errors.phone = 'Enter a phone number'
  if (form.email.trim() && !/^[^\s@]+@[^\s@]+$/.test(form.email.trim())) errors.email = 'Enter a valid email'
  if (form.pincode.trim() && !/^\d{6}$/.test(form.pincode.trim())) errors.pincode = 'A PIN code has 6 digits'
  return errors
}
