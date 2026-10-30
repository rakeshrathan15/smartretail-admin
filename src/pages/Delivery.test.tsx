import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearTokens } from '../api/client'
import type { DeliveryRoute, MapPoint, PickList, RouteInput } from '../api/delivery'
import { addDays, todayInIndia } from '../lib/format'
import { authBody, fakeBackend } from '../test/fakeBackend'
import { renderApp, signIn } from '../test/renderApp'
import { describeDays, emptyRouteForm, formFromRoute, inputFromRouteForm, routeFormErrors } from './routeForm'
import { emptyStoreForm, inputFromStoreForm, storeFormErrors } from './storeForm'

// jsdom cannot draw Leaflet; tapping the map is stood in for by a button.
vi.mock('../components/RouteZoneMap', () => ({
  RouteZoneMap: ({ onPick }: { onPick: (point: MapPoint) => void }) => {
    let n = 0
    return (
      <button type="button" onClick={() => onPick({ lat: 17.4 + n++ / 100, lng: 78.4 + (n % 2) / 100 })}>
        Tap map
      </button>
    )
  },
}))

const login = { 'POST /api/auth/login': () => ({ status: 200, body: authBody() }) }

const route: DeliveryRoute = {
  id: 'r1',
  name: 'Warangal North',
  area: 'Kazipet',
  days: ['MON', 'THU'],
  storeId: null,
  storeName: null,
  color: '#2563EB',
  zone: { shape: 'CIRCLE', center: { lat: 17.96, lng: 79.59 }, radiusKm: 3 },
  active: true,
  sortOrder: 0,
  shopCount: 4,
  nextDeliveryDate: '2026-11-02',
}

describe('delivery', () => {
  afterEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('checks stores like the backend', () => {
    expect(storeFormErrors({ ...emptyStoreForm, name: 'Depot' })).toEqual({})
    expect(storeFormErrors(emptyStoreForm).name).toBeDefined()
    expect(storeFormErrors({ ...emptyStoreForm, name: 'D', gstin: 'BAD', pincode: '12' })).toMatchObject({
      gstin: expect.any(String),
      pincode: expect.any(String),
    })
    expect(inputFromStoreForm({ ...emptyStoreForm, name: ' D ', gstin: '36abcde1234f1z5' })).toMatchObject({
      name: 'D',
      gstin: '36ABCDE1234F1Z5',
      phone: null,
    })
  })

  it('checks routes and sends only the shape picked', () => {
    const named = { ...emptyRouteForm, name: 'R' }
    expect(routeFormErrors(named)).toEqual({})
    expect(routeFormErrors({ ...named, points: [{ lat: 1, lng: 1 }] }).zone).toBeDefined()
    expect(routeFormErrors({ ...named, shape: 'CIRCLE', radiusKm: '500' }).radiusKm).toBeDefined()
    expect(routeFormErrors({ ...named, sortOrder: '-1' }).sortOrder).toBeDefined()

    const points = [{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 1 }]
    const center = { lat: 5, lng: 5 }
    expect(inputFromRouteForm({ ...named, points, center }).zone).toEqual({ shape: 'POLYGON', points })
    expect(inputFromRouteForm({ ...named, shape: 'CIRCLE', points, center }).zone).toEqual({ shape: 'CIRCLE', center, radiusKm: 5 })
    expect(inputFromRouteForm({ ...named, shape: 'NONE', points, center }).zone).toBeNull()
    expect(inputFromRouteForm({ ...named, days: ['THU', 'MON'] }).days).toEqual(['MON', 'THU'])
    expect(formFromRoute(route)).toMatchObject({ shape: 'CIRCLE', center: { lat: 17.96, lng: 79.59 }, radiusKm: '3' })
    expect(describeDays(['THU', 'MON'])).toBe('Mon, Thu')
    expect(describeDays([])).toBe('No days set')
  })

  it('adds a route by drawing its area', async () => {
    let saved: RouteInput | null = null
    fakeBackend({
      ...login,
      'GET /api/admin/routes': () => ({ status: 200, body: saved ? [route] : [] }),
      'GET /api/admin/routes/shop-pins': () => ({ status: 200, body: [] }),
      'GET /api/admin/stores': () => ({ status: 200, body: [] }),
      'POST /api/admin/routes': ({ body }) => {
        saved = body as RouteInput
        return { status: 201, body: route }
      },
    })
    const user = userEvent.setup()
    renderApp('/routes')
    await signIn(user)

    await user.click(await screen.findByRole('button', { name: '+ Add route' }))
    await user.type(screen.getByLabelText(/^Route name/), 'Warangal North')
    await user.click(screen.getByRole('checkbox', { name: 'Mon' }))

    // Two points are not an area yet.
    await user.click(screen.getByRole('button', { name: 'Tap map' }))
    await user.click(screen.getByRole('button', { name: 'Tap map' }))
    await user.click(screen.getByRole('button', { name: 'Add route' }))
    expect(await screen.findByText(/at least 3 points/)).toBeInTheDocument()
    expect(saved).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Tap map' }))
    await user.click(screen.getByRole('button', { name: 'Add route' }))
    await waitFor(() => expect(saved).not.toBeNull())
    expect(saved).toMatchObject({ name: 'Warangal North', days: ['MON'], zone: { shape: 'POLYGON' } })
    expect((saved as unknown as RouteInput).zone).toHaveProperty('points.length', 3)
    expect(await screen.findByText('Warangal North')).toBeInTheDocument()
    expect(screen.getByText('Mon, Thu')).toBeInTheDocument()
  })

  it('shows why a route cannot be deleted', async () => {
    fakeBackend({
      ...login,
      'GET /api/admin/routes': () => ({ status: 200, body: [route] }),
      'DELETE /api/admin/routes/r1': () => ({ status: 409, body: { detail: 'Warangal North has 3 orders; turn it off instead of deleting' } }),
    })
    vi.stubGlobal('confirm', () => true)
    const user = userEvent.setup()
    renderApp('/routes')
    await signIn(user)
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('turn it off instead of deleting')
  })

  it('filters customers by route and search', async () => {
    const calls = fakeBackend({
      ...login,
      'GET /api/admin/routes': () => ({ status: 200, body: [route] }),
      'GET /api/admin/customers': () => ({
        status: 200,
        body: {
          items: [
            {
              userId: 'u2',
              shopName: 'Lakshmi Kirana',
              fullName: 'Ravi',
              phone: '9876543210',
              email: null,
              city: 'Warangal',
              pincode: '506001',
              hasLocation: true,
              profileComplete: true,
              routeId: null,
              routeName: null,
              routeColor: null,
              joinedAt: '2026-10-20T06:30:00Z',
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
    renderApp('/customers')
    await signIn(user)

    expect(await screen.findByText('Lakshmi Kirana')).toBeInTheDocument()
    expect(screen.getByText('Outside routes')).toBeInTheDocument()
    await screen.findByRole('option', { name: 'Warangal North' })
    await user.selectOptions(screen.getByLabelText('Route'), 'r1')
    await user.type(screen.getByLabelText('Search customers'), 'ravi')
    await waitFor(() => expect(calls.some((c) => c.url.includes('route=r1') && c.url.includes('q=ravi'))).toBe(true))
  })

  it('shows what to load and remembers ticks per route and date', async () => {
    const list: PickList = {
      routeId: 'r1',
      routeName: 'Warangal North',
      date: route.nextDeliveryDate as string,
      orders: [
        { id: 'o1', orderNumber: 'SR1001', shopName: 'Lakshmi Kirana', customerPhone: '9876543210', status: 'PLACED', paymentMethod: 'COD', totalCases: 8, total: 4320 },
      ],
      items: [{ productId: 'p1', productName: 'Thums Up 750ml', brand: 'Thums Up', unitsPerCase: 24, cases: 8, units: 192, value: 4320 }],
      totals: { orders: 1, uniqueSkus: 1, cases: 8, units: 192, itemsValue: 4320, revenue: 4320 },
    }
    const calls = fakeBackend({
      ...login,
      'GET /api/admin/routes': () => ({ status: 200, body: [route] }),
      'GET /api/admin/pick-list': () => ({ status: 200, body: list }),
    })
    const user = userEvent.setup()
    const first = renderApp('/pick-list')
    await signIn(user)

    expect(await screen.findByText('Choose a route to see what to load.')).toBeInTheDocument()
    expect(screen.getByLabelText('Delivery date')).toHaveValue(addDays(todayInIndia(), 1))
    await screen.findByRole('option', { name: 'Warangal North' })
    await user.selectOptions(screen.getByLabelText('Route'), 'r1')

    const row = (await screen.findByText('Thums Up 750ml')).closest('tr') as HTMLElement
    expect(within(row).getByText('192')).toBeInTheDocument()
    expect(screen.getByText('SR1001')).toBeInTheDocument()
    // The date follows the route's next run, not tomorrow.
    expect(screen.getByLabelText('Delivery date')).toHaveValue('2026-11-02')
    expect(calls.some((c) => c.url.includes('route=r1') && c.url.includes('date=2026-11-02'))).toBe(true)

    await user.click(screen.getByRole('checkbox', { name: 'Loaded Thums Up 750ml' }))
    expect(screen.getByRole('checkbox', { name: 'Loaded Thums Up 750ml' })).toBeChecked()

    // Coming back to the same route and date keeps the tick.
    first.unmount()
    clearTokens()
    renderApp('/pick-list')
    await signIn(user)
    await screen.findByRole('option', { name: 'Warangal North' })
    await user.selectOptions(screen.getByLabelText('Route'), 'r1')
    expect(await screen.findByRole('checkbox', { name: 'Loaded Thums Up 750ml' })).toBeChecked()
  })
})
