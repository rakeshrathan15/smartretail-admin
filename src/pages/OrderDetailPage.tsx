import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ordersApi } from '../api/orders'
import type { AdminOrder, OrderStatus } from '../api/types'
import { Badge, Button, ErrorBanner, PageHeader, Spinner } from '../components/ui'
import { confirmAction } from '../lib/confirm'
import { formatDateTime, formatRupees } from '../lib/format'
import {
  paymentMethodLabels,
  paymentStatusLabels,
  paymentTone,
  statusActions,
  statusLabels,
  statusTone,
} from '../lib/orderLabels'

export function OrderDetailPage() {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const order = useQuery({ queryKey: ['order', id], queryFn: () => ordersApi.get(id!) })
  const [error, setError] = useState<string | null>(null)

  const apply = (updated: AdminOrder) => {
    queryClient.setQueryData(['order', id], updated)
    queryClient.invalidateQueries({ queryKey: ['orders'] })
    queryClient.invalidateQueries({ queryKey: ['order-stats'] })
    setError(null)
  }
  const changeStatus = useMutation({
    mutationFn: (status: OrderStatus) => ordersApi.changeStatus(id!, status),
    onSuccess: apply,
    onError: (e) => setError(e.message),
  })
  const review = useMutation({
    mutationFn: (decision: 'APPROVE' | 'REJECT') => ordersApi.reviewPayment(id!, decision),
    onSuccess: apply,
    onError: (e) => setError(e.message),
  })

  if (order.isPending) return <Spinner />
  if (order.error) return <ErrorBanner message={order.error.message} />

  const admin = order.data
  const o = admin.order
  const busy = changeStatus.isPending || review.isPending

  function move(status: OrderStatus) {
    if (status === 'CANCELLED' && !confirmAction(`Cancel order ${o.orderNumber}? Its ${o.totalCases} cases go back to stock.`)) return
    if (status === 'RETURNED' && !confirmAction(`Mark order ${o.orderNumber} as returned? Its cases go back to stock.`)) return
    changeStatus.mutate(status)
  }

  return (
    <>
      <PageHeader
        title={`Order ${o.orderNumber}`}
        subtitle={`Placed ${formatDateTime(o.createdAt)}`}
        actions={
          <Link to="/orders" className="self-center text-sm text-slate-600 hover:underline">
            ← All orders
          </Link>
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <span className="text-sm text-slate-500">Status</span>
        <Badge tone={statusTone(o.status)}>{statusLabels[o.status]}</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          {admin.nextStatuses.length === 0 && <span className="text-sm text-slate-500">This order is finished.</span>}
          {admin.nextStatuses.map((next) => (
            <Button
              key={next}
              variant={next === 'CANCELLED' || next === 'RETURNED' ? 'danger' : 'primary'}
              busy={changeStatus.isPending && changeStatus.variables === next}
              disabled={busy || (next === 'CONFIRMED' && admin.paymentNeedsReview)}
              title={next === 'CONFIRMED' && admin.paymentNeedsReview ? 'Check the UPI payment first' : undefined}
              onClick={() => move(next)}
            >
              {statusActions[next]}
            </Button>
          ))}
        </div>
      </div>
      <ErrorBanner message={error} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Cases</th>
                <th className="px-4 py-3 text-right">Price / case</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="px-4 py-3">{item.productName}</td>
                  <td className="px-4 py-3 text-right">{item.quantity}</td>
                  <td className="px-4 py-3 text-right">{formatRupees(item.price)}</td>
                  <td className="px-4 py-3 text-right">{formatRupees(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="space-y-1 p-4 text-sm">
            <Line label={`Subtotal (${o.totalCases} cases)`} value={formatRupees(o.subtotal)} />
            {o.discount > 0 && <Line label={`Coupon ${o.couponCode ?? ''}`} value={`− ${formatRupees(o.discount)}`} />}
            <Line label="Delivery" value={o.deliveryCharge === 0 ? 'Free' : formatRupees(o.deliveryCharge)} />
            <div className="border-t border-slate-200 pt-2">
              <Line label="Total" value={formatRupees(o.total)} bold />
            </div>
          </dl>
          {o.notes && (
            <div className="border-t border-slate-200 p-4 text-sm">
              <div className="label">Note from the shop</div>
              {o.notes}
            </div>
          )}
        </section>

        <div className="space-y-4">
          <section className="card p-4 text-sm">
            <h2 className="mb-2 font-semibold">Shop</h2>
            <div className="font-medium">{admin.shopName ?? admin.customerName ?? '—'}</div>
            {admin.customerName && admin.shopName && <div>{admin.customerName}</div>}
            {admin.customerPhone && (
              <a href={`tel:+91${admin.customerPhone}`} className="text-brand hover:underline">
                +91 {admin.customerPhone}
              </a>
            )}
            {o.address && (
              <address className="mt-3 not-italic text-slate-700">
                <div className="label">Deliver to ({o.address.label})</div>
                {o.address.addressLine1}
                {o.address.addressLine2 && <>, {o.address.addressLine2}</>}
                <br />
                {o.address.city}, {o.address.state} {o.address.pincode}
              </address>
            )}
          </section>

          <section className="card p-4 text-sm">
            <h2 className="mb-2 font-semibold">Payment</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span>{paymentMethodLabels[o.paymentMethod]}</span>
              <Badge tone={paymentTone(o.paymentStatus)}>{paymentStatusLabels[o.paymentStatus]}</Badge>
              {o.paymentTerms === 'CREDIT' && <Badge tone="blue">On credit</Badge>}
            </div>
            {o.paymentMethod === 'COD' && o.paymentStatus === 'PENDING' && o.status !== 'CANCELLED' && (
              <p className="mt-2 text-slate-500">Collect {formatRupees(o.total)} on delivery. Marked paid when delivered.</p>
            )}
            {o.status === 'CANCELLED' && o.paymentStatus === 'PAID' && (
              <p className="mt-2 text-red-700">This order was paid. Refund {formatRupees(o.total)} to the shop.</p>
            )}
            {admin.hasPaymentScreenshot && <Screenshot orderId={o.id} />}
            {admin.paymentNeedsReview && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                <p className="mb-2">
                  Check that {formatRupees(o.total)} reached your UPI account, then:
                </p>
                <div className="flex gap-2">
                  <Button busy={review.isPending && review.variables === 'APPROVE'} disabled={busy} onClick={() => review.mutate('APPROVE')}>
                    Payment received
                  </Button>
                  <Button
                    variant="danger"
                    busy={review.isPending && review.variables === 'REJECT'}
                    disabled={busy}
                    onClick={() => confirmAction('Reject this payment? The shop will see "Payment rejected".') && review.mutate('REJECT')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  )
}

/** Loads the private screenshot with the admin's token and shows it; click to open it full size. */
function Screenshot({ orderId }: { orderId: string }) {
  const image = useQuery({
    queryKey: ['payment-screenshot', orderId],
    queryFn: async () => URL.createObjectURL(await ordersApi.paymentScreenshot(orderId)),
    staleTime: Infinity,
    // Dropped from the cache when the page closes, so the object URL below can be released.
    gcTime: 0,
  })
  const url = image.data
  useEffect(() => (url ? () => URL.revokeObjectURL(url) : undefined), [url])

  if (image.error) return <ErrorBanner message={`Screenshot: ${image.error.message}`} />
  if (!url) return <div className="mt-3"><Spinner /></div>
  return (
    <a href={url} target="_blank" rel="noreferrer" className="mt-3 block">
      <img src={url} alt="UPI payment screenshot" className="max-h-96 rounded-md border border-slate-200" />
      <span className="text-xs text-brand">Open full size</span>
    </a>
  )
}

function Line({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
