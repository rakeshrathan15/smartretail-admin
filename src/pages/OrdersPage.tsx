import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ordersApi, type OrderFilters } from '../api/orders'
import type { OrderStatus, PaymentMethod, PaymentStatus } from '../api/types'
import { Badge, Button, ErrorBanner, PageHeader, Spinner } from '../components/ui'
import { formatDateTime, formatRupees, todayInIndia } from '../lib/format'
import {
  paymentMethodLabels,
  paymentStatusLabels,
  paymentTone,
  statusLabels,
  statusTone,
} from '../lib/orderLabels'

/** New orders show up without reloading the page. */
const REFRESH_MS = 30_000

const statusFilters: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PLACED', label: 'New' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'PACKED', label: 'Packed' },
  { value: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

/** Filters live in the URL, so a refresh or the back button keeps them. */
export function OrdersPage() {
  const [params, setParams] = useSearchParams()
  const filters: OrderFilters = {
    status: (params.get('status') || undefined) as OrderStatus | undefined,
    paymentMethod: (params.get('paymentMethod') || undefined) as PaymentMethod | undefined,
    paymentStatus: (params.get('paymentStatus') || undefined) as PaymentStatus | undefined,
    q: params.get('q') || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    page: Number(params.get('page') ?? 0),
  }

  const update = useCallback(
    (changes: Record<string, string>) =>
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous)
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value)
            else next.delete(key)
          }
          if (!('page' in changes)) next.delete('page')
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  const q = filters.q ?? ''
  const [search, setSearch] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  if (q !== syncedQ) {
    setSyncedQ(q)
    setSearch(q)
  }
  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => update({ q: search }), 300)
    return () => clearTimeout(timer)
  }, [search, q, update])

  const stats = useQuery({ queryKey: ['order-stats'], queryFn: ordersApi.stats, refetchInterval: REFRESH_MS })
  const orders = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => ordersApi.list(filters),
    placeholderData: keepPreviousData,
    refetchInterval: REFRESH_MS,
  })

  const today = todayInIndia()
  const data = orders.data
  return (
    <>
      <PageHeader title="Orders" subtitle="Updates every 30 seconds." />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Today's orders" value={stats.data?.todayOrders} onClick={() => update({ from: today, to: today, status: '', paymentStatus: '' })} />
        <StatCard label="Today's revenue" value={stats.data && formatRupees(stats.data.todayRevenue)} />
        <StatCard
          label="New, to confirm"
          value={stats.data?.awaitingConfirmation}
          highlight={!!stats.data?.awaitingConfirmation}
          onClick={() => update({ status: 'PLACED', paymentStatus: '', from: '', to: '' })}
        />
        <StatCard
          label="UPI to check"
          value={stats.data?.upiToVerify}
          highlight={!!stats.data?.upiToVerify}
          onClick={() => update({ paymentStatus: 'PENDING_VERIFICATION', status: '', from: '', to: '' })}
        />
        <StatCard label="COD to collect" value={stats.data && formatRupees(stats.data.codToCollect)} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Order status">
        {statusFilters.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={(filters.status ?? '') === s.value}
            onClick={() => update({ status: s.value })}
            className={`rounded-full px-3 py-1 text-sm ${
              (filters.status ?? '') === s.value ? 'bg-brand text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          className="input max-w-xs"
          placeholder="Order no., shop, name or phone"
          aria-label="Search orders"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input w-auto"
          aria-label="Payment method"
          value={filters.paymentMethod ?? ''}
          onChange={(e) => update({ paymentMethod: e.target.value })}
        >
          <option value="">All payments</option>
          <option value="COD">Cash on delivery</option>
          <option value="UPI">UPI</option>
          <option value="CREDIT">Credit</option>
        </select>
        <select
          className="input w-auto"
          aria-label="Payment status"
          value={filters.paymentStatus ?? ''}
          onChange={(e) => update({ paymentStatus: e.target.value })}
        >
          <option value="">Any payment status</option>
          <option value="PENDING_VERIFICATION">UPI to check</option>
          <option value="PENDING">Unpaid</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Rejected</option>
        </select>
        <label className="flex items-center gap-1 text-sm text-slate-600">
          From
          <input type="date" className="input w-auto" value={filters.from ?? ''} onChange={(e) => update({ from: e.target.value })} />
        </label>
        <label className="flex items-center gap-1 text-sm text-slate-600">
          To
          <input type="date" className="input w-auto" value={filters.to ?? ''} onChange={(e) => update({ to: e.target.value })} />
        </label>
        {[...params.keys()].length > 0 && (
          <Button variant="ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear filters
          </Button>
        )}
      </div>

      <ErrorBanner message={orders.error?.message ?? stats.error?.message} />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Shop</th>
              <th className="px-4 py-3 text-right">Cases</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.isPending && (
              <tr>
                <td colSpan={6} className="p-8 text-center">
                  <Spinner />
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  No orders match these filters.
                </td>
              </tr>
            )}
            {data?.items.map((o) => (
              <tr key={o.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/orders/${o.id}`} className="font-medium text-brand hover:underline">
                    {o.orderNumber}
                  </Link>
                  <div className="text-xs text-slate-500">{formatDateTime(o.createdAt)}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{o.shopName ?? o.customerName ?? '—'}</div>
                  {o.customerPhone && <div className="text-xs text-slate-500">+91 {o.customerPhone}</div>}
                </td>
                <td className="px-4 py-3 text-right">{o.totalCases}</td>
                <td className="px-4 py-3 text-right font-medium">{formatRupees(o.total)}</td>
                <td className="px-4 py-3">
                  <div className="text-xs text-slate-600">{paymentMethodLabels[o.paymentMethod]}</div>
                  <Badge tone={paymentTone(o.paymentStatus)}>{paymentStatusLabels[o.paymentStatus]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone(o.status)}>{statusLabels[o.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button variant="secondary" disabled={!filters.page} onClick={() => update({ page: String((filters.page ?? 0) - 1) })}>
            Previous
          </Button>
          <span>
            Page {(filters.page ?? 0) + 1} of {data.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={(filters.page ?? 0) + 1 >= data.totalPages}
            onClick={() => update({ page: String((filters.page ?? 0) + 1) })}
          >
            Next
          </Button>
        </div>
      )}
    </>
  )
}

function StatCard({
  label,
  value,
  highlight = false,
  onClick,
}: {
  label: string
  value: string | number | undefined
  highlight?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${highlight ? 'text-accent' : ''}`}>{value ?? '—'}</div>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className="card p-4 text-left hover:ring-2 hover:ring-brand/20">
      {body}
    </button>
  ) : (
    <div className="card p-4">{body}</div>
  )
}
