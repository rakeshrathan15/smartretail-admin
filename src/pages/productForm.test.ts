import { describe, expect, it } from 'vitest'
import { emptyProductForm, inputFromForm, parseSlabs, productFormErrors } from './productForm'

const row = (minQty: string, maxQty: string, pricePerCase: string) => ({ minQty, maxQty, pricePerCase })

describe('parseSlabs', () => {
  it('accepts valid slabs and sorts them by min cases', () => {
    const result = parseSlabs([row('25', '', '357'), row('10', '24', '378')], 420)
    expect(result).toEqual({
      slabs: [
        { minQty: 10, maxQty: 24, pricePerCase: 378 },
        { minQty: 25, maxQty: null, pricePerCase: 357 },
      ],
    })
  })

  it('rejects the same problems the backend rejects', () => {
    expect(parseSlabs([row('10', '', '400'), row('10', '', '390')], 420)).toEqual({ error: 'Two slabs start at 10 cases' })
    expect(parseSlabs([row('10', '30', '400'), row('25', '', '390')], 420)).toEqual({
      error: 'Slabs 10-30 and 25+ overlap',
    })
    expect(parseSlabs([row('10', '5', '400')], 420)).toEqual({ error: 'Max cases must be at least min cases (10)' })
    expect(parseSlabs([row('10', '', '450')], 420)).toEqual({ error: 'Price for 10+ cases is above the base price' })
    expect(parseSlabs([row('0', '', '400')], 420)).toEqual({ error: 'Min cases must be a whole number of at least 1' })
    expect(parseSlabs([row('10', '', '')], 420)).toEqual({ error: 'Enter a price for 10+ cases' })
  })

  it('allows clearing all slabs', () => {
    expect(parseSlabs([], 420)).toEqual({ slabs: [] })
  })
})

describe('product form', () => {
  it('flags missing name, bad units and missing price', () => {
    const errors = productFormErrors({ ...emptyProductForm, unitsPerCase: '0' })
    expect(Object.keys(errors).sort()).toEqual(['name', 'price', 'unitsPerCase'])
  })

  it('warns when the original price is below the price', () => {
    const errors = productFormErrors({ ...emptyProductForm, name: 'Cola', price: '420', originalPrice: '400' })
    expect(errors.originalPrice).toBeDefined()
  })

  it('turns text inputs into the API body, with blanks as null', () => {
    const body = inputFromForm({
      ...emptyProductForm,
      name: '  Thums Up 750ml  ',
      brand: ' ',
      price: '420',
      originalPrice: '',
      costPrice: '370.50',
      unitVolumeMl: '750',
    })
    expect(body).toMatchObject({
      name: 'Thums Up 750ml',
      brand: null,
      price: 420,
      originalPrice: null,
      costPrice: 370.5,
      unitVolumeMl: 750,
      unitsPerCase: 12,
      categoryId: null,
      active: true,
    })
  })
})
