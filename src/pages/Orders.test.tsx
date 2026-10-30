import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearTokens } from '../api/client'
import type { AdminOrder, OrderStatus, PaymentStatus } from '../api/types'
import { authBody, fakeBackend } from '../test/fakeBackend'
import { renderApp, signIn } from '../test/renderApp'

function adminOrder(status: OrderStatus, paymentStatus: PaymentStatus, next: OrderStatus[]): AdminOrder {
  return {
    order: {
      id: 'o1',
      orderNumber: 'SR1001',
      status,
      paymentMethod: 'UPI',
      paymentStatus,
      paymentTerms: 'PREPAID',
      subtotal: 3780,
      couponCode: 'SAVE5',
      discount: 189,
      deliveryCharge: 500,
      total: 4091,
      totalCases: 10,
      address: {
        label: 'Shop',
        fullName: 'Ravi Kumar',
        phone: '9876501234',
        addressLine1: '12 Main Road',
        addressLine2: null,
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500001',
      },
      notes: 'Deliver before noon',
      createdAt: '2026-10-25T05:30:00Z',
      items: [{ productId: 'p1', productName: 'Thums Up 750ml PET', quantity: 10, price: 378, total: 3780 }],
    },
    userId: 'u2',
    shopId: null,
    shopName: 'Ravi Kirana',
    customerName: 'Ravi Kumar',
    customerPhone: '9876501234',
    hasPaymentScreenshot: true,
    nextStatuses: next,
    paymentNeedsReview: paymentStatus === 'PENDING_VERIFICATION',
  }
}

describe('admin orders', () => {
  afterEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
  })

  it('opens on the orders list with today’s numbers and filters by card', async () => {
    const calls = fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/orders/stats': () => ({
        status: 200,
        body: { todayOrders: 7, todayRevenue: 28640, awaitingConfirmation: 3, upiToVerify: 1, codToCollect: 9200 },
      }),
      'GET /api/admin/orders': () => ({
        status: 200,
        body: {
          items: [
            {
              id: 'o1',
              orderNumber: 'SR1001',
              createdAt: '2026-10-25T05:30:00Z',
              shopName: 'Ravi Kirana',
              customerName: 'Ravi Kumar',
              customerPhone: '9876501234',
              status: 'PLACED',
              paymentMethod: 'UPI',
              paymentStatus: 'PENDING_VERIFICATION',
              paymentTerms: 'PREPAID',
              total: 4091,
              totalCases: 10,
            },
          ],
          page: 0,
          size: 25,
          totalItems: 1,
          totalPages: 1,
        },
      }),
    })
    const user = userEvent.setup()
    renderApp()
    await signIn(user)

    expect(await screen.findByRole('link', { name: 'SR1001' })).toBeInTheDocument()
    expect(screen.getByText('₹28,640')).toBeInTheDocument()
    expect(screen.getByText('Ravi Kirana')).toBeInTheDocument()
    expect(screen.getByText('Check UPI')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /UPI to check/ }))
    await waitFor(() =>
      expect(calls.some((c) => c.path === '/api/admin/orders' && c.url.includes('paymentStatus=PENDING_VERIFICATION'))).toBe(true),
    )
  })

  it('approves a UPI payment and then confirms the order', async () => {
    let current = adminOrder('PLACED', 'PENDING_VERIFICATION', ['CONFIRMED', 'CANCELLED'])
    const posted: string[] = []
    fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/orders/o1': () => ({ status: 200, body: current }),
      'GET /api/admin/orders/o1/payment-screenshot': () => ({ status: 200, body: 'png-bytes' }),
      'POST /api/admin/orders/o1/payment-review': ({ body }) => {
        posted.push(`review ${(body as { decision: string }).decision}`)
        current = adminOrder('PLACED', 'PAID', ['CONFIRMED', 'CANCELLED'])
        return { status: 200, body: current }
      },
      'POST /api/admin/orders/o1/status': ({ body }) => {
        const status = (body as { status: OrderStatus }).status
        posted.push(`status ${status}`)
        current = adminOrder(status, 'PAID', ['PROCESSING', 'PACKED', 'CANCELLED'])
        return { status: 200, body: current }
      },
    })
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:screenshot', revokeObjectURL: () => {} }))
    const user = userEvent.setup()
    renderApp('/orders/o1')
    await signIn(user)

    expect(await screen.findByRole('heading', { name: 'Order SR1001' })).toBeInTheDocument()
    expect(screen.getByText('Deliver before noon')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '+91 9876501234' })).toHaveAttribute('href', 'tel:+919876501234')
    expect(await screen.findByAltText('UPI payment screenshot')).toHaveAttribute('src', 'blob:screenshot')

    // Confirming waits for the payment check.
    expect(screen.getByRole('button', { name: 'Confirm order' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Payment received' }))
    expect(await screen.findByText('Paid')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Confirm order' }))
    const statusCard = (await screen.findByText('Confirmed')).closest('div')!
    expect(within(statusCard).getByRole('button', { name: 'Mark packed' })).toBeInTheDocument()
    expect(posted).toEqual(['review APPROVE', 'status CONFIRMED'])
  })

  it('asks before cancelling and shows why the server refused', async () => {
    fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/orders/o1': () => ({ status: 200, body: { ...adminOrder('PLACED', 'PENDING', ['CONFIRMED', 'CANCELLED']), hasPaymentScreenshot: false } }),
      'POST /api/admin/orders/o1/status': () => ({ status: 409, body: { detail: 'An order that is cancelled cannot be marked cancelled' } }),
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const user = userEvent.setup()
    renderApp('/orders/o1')
    await signIn(user)

    await user.click(await screen.findByRole('button', { name: 'Cancel order' }))
    expect(confirm).toHaveBeenCalledWith('Cancel order SR1001? Its 10 cases go back to stock.')

    await user.click(screen.getByRole('button', { name: 'Cancel order' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('An order that is cancelled cannot be marked cancelled')
  })

  it('finds a shop owner and gives them credit', async () => {
    let saved: unknown = null
    fakeBackend({
      'POST /api/auth/login': () => ({ status: 200, body: authBody() }),
      'GET /api/admin/shops': () => ({ status: 200, body: { items: [], page: 0, size: 25, totalItems: 0, totalPages: 0 } }),
      'GET /api/admin/shops/summary': () => ({ status: 200, body: { totalShops: 0, activeShops: 0, creditOutstanding: 0, overLimit: 0 } }),
      'GET /api/admin/shops/customers': () => ({
        status: 200,
        body: [{ userId: 'u2', fullName: 'Ravi Kumar', shopName: 'Ravi Kirana', phone: '9876501234', email: null, creditLimit: null }],
      }),
      'PUT /api/admin/shops/credit': ({ body }) => {
        saved = body
        return { status: 200, body: { id: 's1', ownerUserId: 'u2', name: 'Ravi Kirana', phone: '9876501234', creditLimit: 25000, outstanding: 0, overLimit: false, active: true } }
      },
    })
    const user = userEvent.setup()
    renderApp('/shops')
    await signIn(user)

    await user.type(await screen.findByLabelText('Search shop owners'), 'ravi')
    const result = (await screen.findByText('Ravi Kirana')).closest('li')!
    const limit = within(result).getByLabelText('Credit limit')
    await user.clear(limit)
    await user.type(limit, '25000')
    await user.click(within(result).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(saved).toEqual({ userId: 'u2', creditLimit: 25000 }))
    expect(await within(result).findByText('Saved')).toBeInTheDocument()
  })
})
