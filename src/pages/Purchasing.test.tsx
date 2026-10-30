import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearTokens } from '../api/client'
import type { Expense, InventoryRow, Supplier } from '../api/purchasing'
import { todayInIndia } from '../lib/format'
import { authBody, fakeBackend } from '../test/fakeBackend'
import { renderApp, signIn } from '../test/renderApp'
import {
  adjustmentFormErrors,
  emptyAdjustmentForm,
  emptySupplierForm,
  expenseFormErrors,
  inputFromAdjustmentForm,
  inputFromReceiptForm,
  inputFromSupplierForm,
  receiptFormErrors,
  receiptTotal,
  supplierFormErrors,
} from './purchasingForms'

const login = { 'POST /api/auth/login': () => ({ status: 200, body: authBody() }) }
const page = <T,>(items: T[]) => ({ items, page: 0, size: 25, totalItems: items.length, totalPages: items.length ? 1 : 0 })

const product: InventoryRow = {
  productId: 'p1',
  name: 'Thums Up 750ml',
  brand: 'Thums Up',
  stock: 3,
  lowStockThreshold: 5,
  costPrice: 500,
  sellPrice: 600,
  stockValue: 1500,
  level: 'LOW',
  active: true,
}

const supplier: Supplier = { id: 's1', name: 'Coke Distributor', phone: null, gstin: null, address: null, notes: null, active: true }

describe('purchasing', () => {
  afterEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
  })

  it('checks forms like the backend', () => {
    expect(supplierFormErrors(emptySupplierForm).name).toBeDefined()
    expect(supplierFormErrors({ ...emptySupplierForm, name: 'S', phone: 'x', gstin: 'BAD' })).toMatchObject({ phone: expect.any(String), gstin: expect.any(String) })
    expect(inputFromSupplierForm({ ...emptySupplierForm, name: ' S ', gstin: '36abcde1234f1z5' })).toMatchObject({ name: 'S', gstin: '36ABCDE1234F1Z5', phone: null })

    const today = '2026-10-30'
    const line = { productId: 'p1', name: 'P', quantity: '3', cost: '0.07' }
    const receipt = { supplierId: '', storeId: '', receiptDate: today, invoiceNumber: ' ', notes: '', lines: [line] }
    expect(receiptFormErrors(receipt, today)).toEqual({})
    expect(receiptFormErrors({ ...receipt, lines: [] }, today).lines).toBeDefined()
    expect(receiptFormErrors({ ...receipt, receiptDate: '2026-10-31' }, today).receiptDate).toBeDefined()
    expect(receiptFormErrors({ ...receipt, lines: [{ ...line, quantity: '0', cost: '1.555' }] }, today)).toMatchObject({ 'quantity-p1': expect.any(String), 'cost-p1': expect.any(String) })
    // 3 x 0.07 is 0.21000000000000002 in plain floating point.
    expect(receiptTotal([line])).toBe(0.21)
    expect(inputFromReceiptForm(receipt)).toMatchObject({ supplierId: null, invoiceNumber: null, items: [{ productId: 'p1', quantity: 3, costPrice: 0.07 }] })

    expect(adjustmentFormErrors({ ...emptyAdjustmentForm, delta: '-3' }, 3)).toEqual({})
    expect(adjustmentFormErrors({ ...emptyAdjustmentForm, delta: '-4' }, 3).delta).toContain('Only 3')
    for (const delta of ['', '0', 'abc', '1.5']) expect(adjustmentFormErrors({ ...emptyAdjustmentForm, delta }, 3).delta).toBeDefined()
    expect(adjustmentFormErrors({ delta: '1', reason: 'OTHER', notes: ' ' }, 3).notes).toBeDefined()
    expect(inputFromAdjustmentForm('p1', { ...emptyAdjustmentForm, delta: '+5' }).delta).toBe(5)

    const expense = { title: 'Diesel', category: 'FUEL' as const, amount: '10.50', description: '', expenseDate: today }
    expect(expenseFormErrors(expense, today)).toEqual({})
    expect(expenseFormErrors({ ...expense, title: '', amount: '0', expenseDate: '2026-11-01' }, today)).toMatchObject({
      title: expect.any(String),
      amount: expect.any(String),
      expenseDate: expect.any(String),
    })
  })

  it('adds a supplier and turns one off', async () => {
    let list: Supplier[] = []
    let posted: unknown = null
    let toggled: unknown = null
    fakeBackend({
      ...login,
      'GET /api/admin/suppliers': () => ({ status: 200, body: list }),
      'POST /api/admin/suppliers': ({ body }) => {
        posted = body
        list = [supplier]
        return { status: 201, body: supplier }
      },
      'PATCH /api/admin/suppliers/s1/active': ({ body }) => {
        toggled = body
        return { status: 200, body: { ...supplier, active: false } }
      },
    })
    const user = userEvent.setup()
    renderApp('/suppliers')
    await signIn(user)

    expect(await screen.findByText(/No suppliers yet/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Add supplier' }))
    await user.click(screen.getByRole('button', { name: 'Add supplier' }))
    expect(await screen.findByText('Enter the supplier name')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^Name/), 'Coke Distributor')
    await user.click(screen.getByRole('button', { name: 'Add supplier' }))
    await waitFor(() => expect(posted).toMatchObject({ name: 'Coke Distributor', phone: null }))

    await user.click(await screen.findByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(toggled).toEqual({ active: false }))
  })

  it('receives stock and shows the total', async () => {
    let posted: unknown = null
    const receipt = { id: 'r1', receiptDate: '2026-10-30', supplierName: 'Coke Distributor', storeName: null, invoiceNumber: 'B-1', totalCost: 5005, itemCount: 1, totalCases: 10, createdBy: 'Admin', createdAt: '2026-10-30T06:30:00Z' }
    let receipts: (typeof receipt)[] = []
    fakeBackend({
      ...login,
      'GET /api/admin/inventory/receipts': () => ({ status: 200, body: page(receipts) }),
      'GET /api/admin/suppliers': () => ({ status: 200, body: [supplier, { ...supplier, id: 's2', name: 'Off Supplier', active: false }] }),
      'GET /api/admin/stores': () => ({ status: 200, body: [] }),
      'GET /api/admin/inventory': () => ({ status: 200, body: page([product]) }),
      'POST /api/admin/inventory/receipts': ({ body }) => {
        posted = body
        receipts = [receipt]
        return { status: 201, body: { receipt, notes: null, items: [] } }
      },
    })
    const user = userEvent.setup()
    renderApp('/stock-receipts')
    await signIn(user)

    await user.click(await screen.findByRole('button', { name: '+ Receive stock' }))
    await screen.findByRole('option', { name: 'Coke Distributor' })
    expect(screen.queryByRole('option', { name: 'Off Supplier' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save receipt' }))
    expect(await screen.findByText('Add at least one product')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/^Supplier/), 's1')
    await user.type(screen.getByLabelText(/^Bill number/), 'B-1')
    await user.type(screen.getByLabelText('Add products'), 'thums')
    await user.click(await screen.findByRole('button', { name: /Thums Up 750ml/ }))
    // The last cost is filled in; it can be changed.
    expect(screen.getByLabelText('Cost of Thums Up 750ml')).toHaveValue('500')
    await user.type(screen.getByLabelText('Cases of Thums Up 750ml'), '10')
    await user.clear(screen.getByLabelText('Cost of Thums Up 750ml'))
    await user.type(screen.getByLabelText('Cost of Thums Up 750ml'), '500.50')
    expect(screen.getByText(/Total cost:/)).toHaveTextContent('5,005')

    await user.click(screen.getByRole('button', { name: 'Save receipt' }))
    await waitFor(() =>
      expect(posted).toMatchObject({ supplierId: 's1', invoiceNumber: 'B-1', items: [{ productId: 'p1', quantity: 10, costPrice: 500.5 }] }),
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Received 10 cases')
    expect(await screen.findByText('B-1')).toBeInTheDocument()
  })

  it('shows stock levels and saves an adjustment', async () => {
    let posted: unknown = null
    const calls = fakeBackend({
      ...login,
      'GET /api/admin/inventory': () => ({ status: 200, body: page([product]) }),
      'GET /api/admin/inventory/summary': () => ({ status: 200, body: { products: 1, lowStock: 1, outOfStock: 0, stockValue: 1500, potentialProfit: 300 } }),
      'GET /api/admin/inventory/adjustments': () => ({ status: 200, body: page([]) }),
      'POST /api/admin/inventory/adjustments': ({ body }) => {
        posted = body
        return { status: 201, body: { id: 'a1' } }
      },
    })
    const user = userEvent.setup()
    renderApp('/inventory')
    await signIn(user)

    const row = (await screen.findByText('Thums Up 750ml')).closest('tr') as HTMLElement
    expect(within(row).getByText('LOW')).toBeInTheDocument()
    expect(within(row).getByText('₹100')).toBeInTheDocument()
    expect(await screen.findByText('Stock value (cost)')).toBeInTheDocument()

    await user.click(within(row).getByRole('button', { name: 'Adjust Thums Up 750ml' }))
    await user.type(screen.getByLabelText(/^Change/), '-4')
    await user.click(screen.getByRole('button', { name: 'Save adjustment' }))
    expect(await screen.findByText('Only 3 cases are in stock')).toBeInTheDocument()
    expect(posted).toBeNull()

    await user.clear(screen.getByLabelText(/^Change/))
    await user.type(screen.getByLabelText(/^Change/), '-2')
    await user.type(screen.getByLabelText('Notes'), 'Dropped')
    await user.click(screen.getByRole('button', { name: 'Save adjustment' }))
    await waitFor(() => expect(posted).toEqual({ productId: 'p1', delta: -2, reason: 'DAMAGE', notes: 'Dropped' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save adjustment' })).not.toBeInTheDocument())

    await user.selectOptions(screen.getByLabelText('Stock level'), 'OUT')
    await waitFor(() => expect(calls.some((c) => c.url.includes('level=OUT'))).toBe(true))
  })

  it('adds, totals and deletes expenses', async () => {
    const diesel: Expense = { id: 'e1', title: 'Diesel', category: 'FUEL', amount: 2000, description: null, expenseDate: todayInIndia() }
    let list: Expense[] = []
    let posted: unknown = null
    let deleted = false
    const calls = fakeBackend({
      ...login,
      'GET /api/admin/expenses': () => ({ status: 200, body: page(list) }),
      'GET /api/admin/expenses/summary': () => ({
        status: 200,
        body: list.length ? { total: 2000, count: 1, byCategory: [{ category: 'FUEL', total: 2000 }] } : { total: 0, count: 0, byCategory: [] },
      }),
      'POST /api/admin/expenses': ({ body }) => {
        posted = body
        list = [diesel]
        return { status: 201, body: diesel }
      },
      'DELETE /api/admin/expenses/e1': () => {
        deleted = true
        list = []
        return { status: 204 }
      },
    })
    vi.stubGlobal('confirm', () => true)
    const user = userEvent.setup()
    renderApp('/expenses')
    await signIn(user)

    expect(await screen.findByText('No expenses for these dates.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Add expense' }))
    await user.click(screen.getByRole('button', { name: 'Add expense' }))
    expect(await screen.findByText('Enter a title')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/^Title/), 'Diesel')
    await user.selectOptions(screen.getByLabelText('Category'), 'FUEL')
    await user.type(screen.getByLabelText(/^Amount/), '2000')
    await user.click(screen.getByRole('button', { name: 'Add expense' }))
    await waitFor(() => expect(posted).toMatchObject({ title: 'Diesel', category: 'FUEL', amount: 2000, expenseDate: todayInIndia() }))
    expect(await screen.findByText('Diesel')).toBeInTheDocument()
    expect(screen.getByText('Total expenses').closest('div')).toHaveTextContent('₹2,000')

    await user.selectOptions(screen.getByLabelText('Show category'), 'RENT')
    await waitFor(() => expect(calls.some((c) => c.url.includes('category=RENT'))).toBe(true))
    await user.selectOptions(screen.getByLabelText('Show category'), '')
    await user.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(deleted).toBe(true))
  })
})
