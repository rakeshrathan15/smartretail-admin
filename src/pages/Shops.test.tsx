import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearTokens } from '../api/client'
import type { Shop, ShopLedger } from '../api/shops'
import { authBody, fakeBackend } from '../test/fakeBackend'
import { renderApp, signIn } from '../test/renderApp'
import { emptyPaymentForm, emptyShopForm, inputFromPaymentForm, inputFromShopForm, paymentFormErrors, shopFormErrors } from './shopForm'

const login = { 'POST /api/auth/login': () => ({ status: 200, body: authBody() }) }

const shop: Shop = {
  id: 's1',
  ownerUserId: 'u2',
  name: 'Lakshmi Kirana',
  phone: '9876543210',
  gstin: null,
  address: '12 Main Road',
  city: 'Warangal',
  pincode: '506001',
  routeId: null,
  routeName: null,
  creditLimit: 10000,
  outstanding: 12500,
  overLimit: true,
  active: true,
}

const ledger: ShopLedger = {
  shop,
  creditOrdersTotal: 12500,
  paidTotal: 0,
  openOrders: [{ id: 'o1', orderNumber: 'SR1001', createdAt: '2026-10-20T06:30:00Z', status: 'PLACED', total: 12500, due: 12500 }],
  payments: [],
}

const paymentRow = { id: 'p1', amount: 5000, method: 'CHEQUE', reference: 'CHQ-1', receivedBy: 'Admin', createdAt: '2026-10-21T06:30:00Z', voided: false, voidedAt: null, voidedBy: null }

const page = (items: Shop[]) => ({ items, page: 0, size: 25, totalItems: items.length, totalPages: items.length ? 1 : 0 })

describe('shops', () => {
  afterEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
  })

  it('checks shops and repayments like the backend', () => {
    const named = { ...emptyShopForm, name: 'Shop' }
    expect(shopFormErrors(named)).toEqual({})
    expect(shopFormErrors(emptyShopForm).name).toBeDefined()
    expect(shopFormErrors({ ...named, phone: '12345', gstin: 'BAD', pincode: '12', creditLimit: '-1' })).toMatchObject({
      phone: expect.any(String),
      gstin: expect.any(String),
      pincode: expect.any(String),
      creditLimit: expect.any(String),
    })
    expect(shopFormErrors({ ...named, phone: '+91 98765 43210' })).toEqual({})
    expect(inputFromShopForm({ ...named, gstin: '36abcde1234f1z5', creditLimit: '500' })).toMatchObject({
      gstin: '36ABCDE1234F1Z5',
      phone: null,
      deliveryRouteId: null,
      creditLimit: 500,
    })

    for (const amount of ['', '0', '-5', '10.555', 'abc']) {
      expect(paymentFormErrors({ ...emptyPaymentForm, amount }).amount).toBeDefined()
    }
    expect(paymentFormErrors({ ...emptyPaymentForm, amount: '10.50' })).toEqual({})
    expect(inputFromPaymentForm({ amount: '10.50', method: 'UPI', reference: ' ' })).toEqual({ amount: 10.5, method: 'UPI', reference: null })
  })

  it('shows totals, flags shops over their limit and filters', async () => {
    const calls = fakeBackend({
      ...login,
      'GET /api/admin/shops': () => ({ status: 200, body: page([shop, { ...shop, id: 's2', name: 'Advance Stores', outstanding: -300, overLimit: false }]) }),
      'GET /api/admin/shops/summary': () => ({ status: 200, body: { totalShops: 2, activeShops: 2, creditOutstanding: 12500, overLimit: 1 } }),
    })
    const user = userEvent.setup()
    renderApp('/shops')
    await signIn(user)

    const row = (await screen.findByRole('link', { name: 'Lakshmi Kirana' })).closest('tr') as HTMLElement
    expect(within(row).getByText('OVER LIMIT')).toBeInTheDocument()
    expect(screen.getByText(/paid in advance/)).toBeInTheDocument()
    expect(screen.getByText('Credit outstanding')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Standing'), 'OVER_LIMIT')
    await user.type(screen.getByLabelText('Search shops'), 'war')
    await waitFor(() => expect(calls.some((c) => c.url.includes('standing=OVER_LIMIT') && c.url.includes('q=war'))).toBe(true))
  })

  it('adds a shop by hand', async () => {
    let saved: unknown = null
    fakeBackend({
      ...login,
      'GET /api/admin/shops': () => ({ status: 200, body: page([]) }),
      'GET /api/admin/shops/summary': () => ({ status: 200, body: { totalShops: 0, activeShops: 0, creditOutstanding: 0, overLimit: 0 } }),
      'GET /api/admin/routes': () => ({ status: 200, body: [] }),
      'POST /api/admin/shops': ({ body }) => {
        saved = body
        return { status: 201, body: { ...shop, ownerUserId: null } }
      },
    })
    const user = userEvent.setup()
    renderApp('/shops')
    await signIn(user)

    await user.click(await screen.findByRole('button', { name: '+ New shop' }))
    await user.click(screen.getByRole('button', { name: 'Add shop' }))
    expect(await screen.findByText('Enter the shop name')).toBeInTheDocument()
    expect(saved).toBeNull()

    await user.type(screen.getByLabelText(/^Shop name/), 'Walk-in Stores')
    await user.click(screen.getByRole('button', { name: 'Add shop' }))
    await waitFor(() => expect(saved).toMatchObject({ name: 'Walk-in Stores', creditLimit: 0 }))
  })

  it('records a repayment, asks about an advance, and voids', async () => {
    let current = ledger
    const posted: unknown[] = []
    fakeBackend({
      ...login,
      'GET /api/admin/shops/s1/ledger': () => ({ status: 200, body: current }),
      'POST /api/admin/shops/s1/payments': ({ body }) => {
        posted.push(body)
        current = { ...ledger, shop: { ...shop, outstanding: 7500, overLimit: false }, paidTotal: 5000, payments: [paymentRow] } as ShopLedger
        return { status: 201, body: current }
      },
      'POST /api/admin/shops/s1/payments/p1/void': () => {
        current = { ...ledger, payments: [{ ...paymentRow, voided: true, voidedBy: 'Admin' }] } as ShopLedger
        return { status: 200, body: current }
      },
    })
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)
    const user = userEvent.setup()
    renderApp('/shops/s1')
    await signIn(user)

    expect(await screen.findByText('SR1001')).toBeInTheDocument()
    expect(screen.getByText('OVER LIMIT')).toBeInTheDocument()
    expect(screen.getByText('No repayments yet.')).toBeInTheDocument()

    // More than is owed needs a yes first.
    await user.type(screen.getByLabelText('Amount ₹'), '20000')
    await user.click(screen.getByRole('button', { name: 'Record repayment' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(posted).toEqual([])

    await user.clear(screen.getByLabelText('Amount ₹'))
    await user.type(screen.getByLabelText('Amount ₹'), '5000')
    await user.selectOptions(screen.getByLabelText('Method'), 'CHEQUE')
    await user.type(screen.getByLabelText(/^Reference/), 'CHQ-1')
    await user.click(screen.getByRole('button', { name: 'Record repayment' }))
    await waitFor(() => expect(posted).toEqual([{ amount: 5000, method: 'CHEQUE', reference: 'CHQ-1' }]))
    expect(await screen.findByText('CHQ-1')).toBeInTheDocument()
    expect(screen.getByText('Within limit')).toBeInTheDocument()
    // The form is clear for the next payment.
    expect(screen.getByLabelText('Amount ₹')).toHaveValue('')

    confirm.mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Void' }))
    expect(await screen.findByText('Voided by Admin')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Void' })).not.toBeInTheDocument()
  })

  it('locks the route of a shop with an account', async () => {
    fakeBackend({
      ...login,
      'GET /api/admin/shops/s1/ledger': () => ({ status: 200, body: ledger }),
      'GET /api/admin/routes': () => ({ status: 200, body: [] }),
    })
    const user = userEvent.setup()
    renderApp('/shops/s1')
    await signIn(user)
    await user.click(await screen.findByRole('button', { name: 'Edit shop' }))
    expect(screen.getByLabelText(/^Delivery route/)).toBeDisabled()
    expect(screen.getByLabelText(/^Shop name/)).toHaveValue('Lakshmi Kirana')
  })
})
