import { describe, expect, it } from 'vitest'
import { couponFormErrors, describeDiscount, emptyCouponForm, inputFromCouponForm } from './couponForm'

describe('coupon form', () => {
  it('checks the same rules as the backend', () => {
    expect(Object.keys(couponFormErrors({ ...emptyCouponForm, code: 'x' })).sort()).toEqual(['code', 'discountValue'])
    expect(couponFormErrors({ ...emptyCouponForm, code: 'HALF', discountValue: '150' }).discountValue).toBe(
      'A percentage cannot be above 100',
    )
    expect(couponFormErrors({ ...emptyCouponForm, code: 'BIG', discountType: 'FIXED', discountValue: '150' })).toEqual({})
    expect(
      couponFormErrors({ ...emptyCouponForm, code: 'DATES', discountValue: '5', validFrom: '2026-11-10', validUntil: '2026-11-01' })
        .validUntil,
    ).toBe('The end date is before the start date')
  })

  it('builds the API body with whole days in India time', () => {
    expect(
      inputFromCouponForm({
        ...emptyCouponForm,
        code: ' diwali10 ',
        discountValue: '10',
        maxDiscount: '1000',
        minOrderValue: '',
        usageLimit: '200',
        validFrom: '2026-11-01',
        validUntil: '2026-11-05',
      }),
    ).toEqual({
      code: 'DIWALI10',
      description: null,
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderValue: 0,
      maxDiscount: 1000,
      usageLimit: 200,
      validFrom: '2026-11-01T00:00:00+05:30',
      validUntil: '2026-11-05T23:59:59+05:30',
      active: true,
    })
  })

  it('drops the cap for fixed discounts and describes discounts in words', () => {
    expect(inputFromCouponForm({ ...emptyCouponForm, code: 'FLAT', discountType: 'FIXED', discountValue: '100', maxDiscount: '50' }).maxDiscount).toBeNull()
    expect(describeDiscount({ discountType: 'PERCENTAGE', discountValue: 5, maxDiscount: 500 })).toBe('5% off, up to ₹500')
    expect(describeDiscount({ discountType: 'FIXED', discountValue: 100, maxDiscount: null })).toBe('₹100 off')
  })
})
