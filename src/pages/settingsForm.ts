import type { StoreSettings } from '../api/types'

/** The settings form keeps amounts as text while typing. */
export type SettingsFormValues = Omit<StoreSettings, 'deliveryCharge' | 'freeDeliveryAbove' | 'minOrderValue'> & {
  deliveryCharge: string
  freeDeliveryAbove: string
  minOrderValue: string
}

export function formFromSettings(s: StoreSettings): SettingsFormValues {
  return {
    ...s,
    deliveryCharge: String(s.deliveryCharge),
    freeDeliveryAbove: String(s.freeDeliveryAbove),
    minOrderValue: String(s.minOrderValue),
  }
}

export function settingsFromForm(f: SettingsFormValues): StoreSettings {
  return {
    ...f,
    storeName: f.storeName.trim(),
    upiId: f.upiId.trim(),
    gstNumber: f.gstNumber.trim().toUpperCase(),
    fssaiNumber: f.fssaiNumber.trim(),
    deliveryCharge: Number(f.deliveryCharge || 0),
    freeDeliveryAbove: Number(f.freeDeliveryAbove || 0),
    minOrderValue: Number(f.minOrderValue || 0),
  }
}

/** Same rules as the backend (StoreSettingsForm); returns errors by field. */
export function settingsErrors(f: SettingsFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!f.storeName.trim()) errors.storeName = 'Enter the store name'
  for (const key of ['deliveryCharge', 'freeDeliveryAbove', 'minOrderValue'] as const) {
    if (f[key].trim() !== '' && !(Number(f[key]) >= 0)) errors[key] = 'Enter 0 or more'
  }
  if (f.upiId.trim() && !/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(f.upiId.trim())) errors.upiId = 'Should look like name@bank, e.g. shop@okaxis'
  if (f.gstNumber.trim() && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i.test(f.gstNumber.trim())) {
    errors.gstNumber = 'A GSTIN has 15 characters, e.g. 36ABCDE1234F1Z5'
  }
  if (f.fssaiNumber.trim() && !/^[0-9]{14}$/.test(f.fssaiNumber.trim())) errors.fssaiNumber = 'The FSSAI number has 14 digits'
  if (f.storeEmail.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.storeEmail.trim())) errors.storeEmail = 'Enter a valid email'
  return errors
}
