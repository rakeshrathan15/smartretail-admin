import type { Coupon, CouponInput } from '../api/types'
import { formatRupees } from '../lib/format'

/** The coupon form keeps inputs as text; dates are yyyy-mm-dd days in India time. */
export interface CouponFormValues {
  code: string
  description: string
  discountType: 'PERCENTAGE' | 'FIXED'
  discountValue: string
  minOrderValue: string
  maxDiscount: string
  usageLimit: string
  validFrom: string
  validUntil: string
  active: boolean
}

export const emptyCouponForm: CouponFormValues = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  minOrderValue: '',
  maxDiscount: '',
  usageLimit: '',
  validFrom: '',
  validUntil: '',
  active: true,
}

const indiaDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(iso)) : ''

export function formFromCoupon(c: Coupon): CouponFormValues {
  return {
    code: c.code,
    description: c.description ?? '',
    discountType: c.discountType,
    discountValue: String(c.discountValue),
    minOrderValue: c.minOrderValue ? String(c.minOrderValue) : '',
    maxDiscount: c.maxDiscount === null ? '' : String(c.maxDiscount),
    usageLimit: c.usageLimit === null ? '' : String(c.usageLimit),
    validFrom: indiaDate(c.validFrom),
    validUntil: indiaDate(c.validUntil),
    active: c.active,
  }
}

const numberOrNull = (value: string) => (value.trim() === '' ? null : Number(value))

export function inputFromCouponForm(f: CouponFormValues): CouponInput {
  return {
    code: f.code.trim().toUpperCase(),
    description: f.description.trim() || null,
    discountType: f.discountType,
    discountValue: Number(f.discountValue),
    minOrderValue: Number(f.minOrderValue || 0),
    // A cap only makes sense for percentages.
    maxDiscount: f.discountType === 'PERCENTAGE' ? numberOrNull(f.maxDiscount) : null,
    usageLimit: numberOrNull(f.usageLimit),
    // The whole day counts: from the start of the first day to the end of the last, India time.
    validFrom: f.validFrom ? `${f.validFrom}T00:00:00+05:30` : null,
    validUntil: f.validUntil ? `${f.validUntil}T23:59:59+05:30` : null,
    active: f.active,
  }
}

/** Same rules as the backend; returns errors by field. */
export function couponFormErrors(f: CouponFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(f.code.trim())) errors.code = 'Use 3-20 letters, digits, - or _'
  const value = Number(f.discountValue)
  if (!(value > 0)) errors.discountValue = 'Enter a discount above 0'
  else if (f.discountType === 'PERCENTAGE' && value > 100) errors.discountValue = 'A percentage cannot be above 100'
  if (f.minOrderValue && !(Number(f.minOrderValue) >= 0)) errors.minOrderValue = 'Enter 0 or more'
  if (f.maxDiscount && !(Number(f.maxDiscount) > 0)) errors.maxDiscount = 'Enter an amount above 0, or leave empty'
  if (f.usageLimit && !(Number.isInteger(Number(f.usageLimit)) && Number(f.usageLimit) > 0)) {
    errors.usageLimit = 'Enter a whole number, or leave empty for no limit'
  }
  if (f.validFrom && f.validUntil && f.validUntil < f.validFrom) errors.validUntil = 'The end date is before the start date'
  return errors
}

/** "5% off, up to ₹500" or "₹100 off". */
export function describeDiscount(c: Pick<Coupon, 'discountType' | 'discountValue' | 'maxDiscount'>): string {
  if (c.discountType === 'FIXED') return `${formatRupees(c.discountValue)} off`
  return `${c.discountValue}% off${c.maxDiscount ? `, up to ${formatRupees(c.maxDiscount)}` : ''}`
}
