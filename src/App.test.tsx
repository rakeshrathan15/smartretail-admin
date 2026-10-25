import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearTokens } from './api/client'
import { authBody, fakeBackend } from './test/fakeBackend'
import { renderApp, signIn } from './test/renderApp'

const product = {
  product: {
    id: 'p1',
    slug: 'thums-up-750ml-pet',
    name: 'Thums Up 750ml PET',
    brand: 'Thums Up',
    flavor: 'Cola',
    category: { id: 'c1', name: 'Colas', slug: 'colas', imageUrl: null, active: true, sortOrder: 1 },
    unitVolumeMl: 750,
    unitsPerCase: 12,
    weight: null,
    price: 420,
    originalPrice: 480,
    lowestPrice: 378,
    inStock: true,
    badge: null,
    description: null,
    ingredients: null,
    images: [],
    slabs: [{ minQty: 10, maxQty: null, pricePerCase: 378 }],
  },
  costPrice: 370,
  stockQuantity: 3,
  lowStockThreshold: 5,
  barcode: null,
  active: true,
}

const row = {
  id: 'p1',
  slug: 'thums-up-750ml-pet',
  name: 'Thums Up 750ml PET',
  brand: 'Thums Up',
  categoryName: 'Colas',
  unitsPerCase: 12,
  price: 420,
  lowestPrice: 378,
  imageUrl: null,
  stockQuantity: 3,
  lowStockThreshold: 5,
  active: true,
}

describe('admin app', () => {
  afterEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('refuses accounts that are not admins', async () => {
    const calls = fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody(['CUSTOMER']) }),
      'POST /api/auth/logout': () => ({ status: 204 }),
    })
    const user = userEvent.setup()
    renderApp()

    await signIn(user)

    expect(await screen.findByRole('alert')).toHaveTextContent('This account is not an admin.')
    expect(calls.some((c) => c.path === '/api/auth/logout')).toBe(true)
  })

  it('signs in and lists products with stock warnings', async () => {
    fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/categories': () => ({ status: 200, body: [product.product.category] }),
      'GET /api/admin/products': () => ({
        status: 200,
        body: { items: [row], page: 0, size: 20, totalItems: 1, totalPages: 1 },
      }),
    })
    const user = userEvent.setup()
    renderApp('/products')

    await signIn(user)

    expect(await screen.findByRole('link', { name: /Thums Up 750ml PET/ })).toBeInTheDocument()
    expect(screen.getByText('1 products')).toBeInTheDocument()
    expect(screen.getByText('3 low')).toBeInTheDocument()
    expect(screen.getByText('bulk from ₹378')).toBeInTheDocument()
  })

  it('edits bulk prices and blocks invalid slabs before sending', async () => {
    let saved: unknown = null
    fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/categories': () => ({ status: 200, body: [product.product.category] }),
      'GET /api/admin/products/p1': () => ({ status: 200, body: product }),
      'PUT /api/admin/products/p1/slabs': ({ body }) => {
        saved = body
        const slabs = (body as { slabs: unknown[] }).slabs
        return { status: 200, body: { ...product, product: { ...product.product, slabs } } }
      },
    })
    const user = userEvent.setup()
    renderApp('/products/p1')
    await signIn(user)

    const slabsSection = (await screen.findByRole('heading', { name: 'Bulk prices' })).closest('section')!
    const slabs = within(slabsSection)

    // A slab priced above the ₹420 base is rejected without calling the server.
    await user.clear(slabs.getByLabelText('Price per case, slab 1'))
    await user.type(slabs.getByLabelText('Price per case, slab 1'), '450')
    await user.click(slabs.getByRole('button', { name: 'Save bulk prices' }))
    expect(slabs.getByRole('alert')).toHaveTextContent('Price for 10+ cases is above the base price')
    expect(saved).toBeNull()

    await user.clear(slabs.getByLabelText('Price per case, slab 1'))
    await user.type(slabs.getByLabelText('Price per case, slab 1'), '380')
    await user.click(slabs.getByRole('button', { name: '+ Add slab' }))
    // "+ Add slab" suggests 11 cases; change it to 25.
    expect(slabs.getByLabelText('Min cases, slab 2')).toHaveValue(11)
    await user.clear(slabs.getByLabelText('Min cases, slab 2'))
    await user.type(slabs.getByLabelText('Min cases, slab 2'), '25')
    await user.type(slabs.getByLabelText('Price per case, slab 2'), '357')
    await user.click(slabs.getByRole('button', { name: 'Save bulk prices' }))

    await waitFor(() =>
      expect(saved).toEqual({
        slabs: [
          { minQty: 10, maxQty: null, pricePerCase: 380 },
          { minQty: 25, maxQty: null, pricePerCase: 357 },
        ],
      }),
    )
    expect(await slabs.findByText('Saved')).toBeInTheDocument()
  })

  it('shows server validation next to the field that failed', async () => {
    fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/categories': () => ({ status: 200, body: [] }),
      'POST /api/admin/products': () => ({
        status: 400,
        body: { detail: 'Validation failed', errors: { barcode: 'size must be between 0 and 64' } },
      }),
    })
    const user = userEvent.setup()
    renderApp('/products/new')
    await signIn(user)

    await user.type(await screen.findByLabelText('Product name *'), 'Cola')
    await user.type(screen.getByLabelText('Price per case (₹) *'), '420')
    await user.click(screen.getByRole('button', { name: 'Create product' }))

    expect(await screen.findByText('size must be between 0 and 64')).toBeInTheDocument()
  })
})
