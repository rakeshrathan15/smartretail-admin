import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearTokens } from '../api/client'
import type { StoreSettings } from '../api/types'
import { authBody, fakeBackend } from '../test/fakeBackend'
import { renderApp, signIn } from '../test/renderApp'
import { settingsErrors, formFromSettings } from './settingsForm'

const seed: StoreSettings = {
  storeName: "S'Mart Retail",
  storePhone: '',
  storeEmail: '',
  storeAddress: 'Telangana, India',
  whatsappNumber: '',
  storeOpen: true,
  deliveryCharge: 500,
  freeDeliveryAbove: 5000,
  minOrderValue: 1000,
  upiId: 'smartretail@upi',
  gstNumber: '',
  fssaiNumber: '',
  showCertifications: true,
}

describe('settings', () => {
  afterEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
  })

  it('checks UPI, GSTIN and FSSAI formats like the backend', () => {
    const base = formFromSettings(seed)
    expect(settingsErrors(base)).toEqual({})
    expect(settingsErrors({ ...base, upiId: 'shop' }).upiId).toBeDefined()
    expect(settingsErrors({ ...base, gstNumber: '36abcde1234f1z5' })).toEqual({})
    expect(settingsErrors({ ...base, gstNumber: '12345' }).gstNumber).toBeDefined()
    expect(settingsErrors({ ...base, fssaiNumber: '1362400200023' }).fssaiNumber).toBeDefined()
    expect(settingsErrors({ ...base, storeName: ' ', deliveryCharge: '-1' })).toMatchObject({
      storeName: expect.any(String),
      deliveryCharge: expect.any(String),
    })
  })

  it('closes the store and changes delivery charges', async () => {
    let saved: StoreSettings | null = null
    fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/settings': () => ({ status: 200, body: seed }),
      'PUT /api/admin/settings': ({ body }) => {
        saved = body as StoreSettings
        return { status: 200, body: saved }
      },
    })
    const user = userEvent.setup()
    renderApp('/settings')
    await signIn(user)

    expect(await screen.findByText('Store is open')).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: 'Store open' }))
    expect(screen.getByText('Store is closed')).toBeInTheDocument()

    const delivery = screen.getByLabelText('Delivery charge (₹)')
    await user.clear(delivery)
    await user.type(delivery, '300')
    await user.type(screen.getByLabelText('GST number (GSTIN)'), '36abcde1234f1z5')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))

    await waitFor(() => expect(saved).not.toBeNull())
    expect(saved).toMatchObject({ storeOpen: false, deliveryCharge: 300, freeDeliveryAbove: 5000, gstNumber: '36ABCDE1234F1Z5' })
    expect(await screen.findByRole('status')).toHaveTextContent('Saved')
  })

  it('shows server validation next to the field', async () => {
    fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/settings': () => ({ status: 200, body: seed }),
      'PUT /api/admin/settings': () => ({ status: 400, body: { detail: 'Validation failed', errors: { storeAddress: 'size must be between 0 and 300' } } }),
    })
    const user = userEvent.setup()
    renderApp('/settings')
    await signIn(user)
    await user.click(await screen.findByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText('size must be between 0 and 300')).toBeInTheDocument()
  })
})
