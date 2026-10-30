import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { shopsApi, type ShopLedger, type ShopPayment } from '../api/shops'
import { Badge, Button, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui'
import { confirmAction } from '../lib/confirm'
import { formatDateTime, formatRupees } from '../lib/format'
import { ShopEditor } from './ShopEditor'
import {
  emptyPaymentForm,
  inputFromPaymentForm,
  paymentFormErrors,
  paymentMethodLabel,
  PAYMENT_METHODS,
  type PaymentFormValues,
} from './shopForm'
import { BalanceText } from './ShopsPage'

/** One shop: its details, what it owes, and the money it has paid back. */
export function ShopDetailPage() {
  const { id = '' } = useParams()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const ledger = useQuery({ queryKey: ['shops', 'ledger', id], queryFn: () => shopsApi.ledger(id) })
  const data = ledger.data
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shops'] })
  const toggle = useMutation({ mutationFn: (active: boolean) => shopsApi.setActive(id, active), onSuccess: refresh })

  if (ledger.isPending) {
    return (
      <div className="p-8 text-center">
        <Spinner />
      </div>
    )
  }
  if (!data) return <ErrorBanner message={ledger.error?.message} />
  const { shop } = data

  return (
    <>
      <Link to="/shops" className="text-sm text-brand underline">
        ← All shops
      </Link>
      <PageHeader
        title={shop.name}
        subtitle={[shop.phone, shop.city, shop.routeName].filter(Boolean).join(' · ') || undefined}
        actions={
          !editing && (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                Edit shop
              </Button>
              <Button variant="secondary" busy={toggle.isPending} onClick={() => toggle.mutate(!shop.active)}>
                {shop.active ? 'Turn off' : 'Turn on'}
              </Button>
            </>
          )
        }
      />
      <ErrorBanner message={toggle.error?.message} />
      {editing && (
        <ShopEditor
          shop={shop}
          onCancel={() => setEditing(false)}
          onDone={() => {
            setEditing(false)
            refresh()
          }}
        />
      )}

      <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Owes">
          <BalanceText outstanding={shop.outstanding} />
        </Stat>
        <Stat label="Credit limit">{formatRupees(shop.creditLimit)}</Stat>
        <Stat label="Status">{shop.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}</Stat>
        <Stat label="Standing">{shop.overLimit ? <Badge tone="red">OVER LIMIT</Badge> : <Badge tone="green">Within limit</Badge>}</Stat>
      </dl>
      <dl className="mb-4 grid gap-1 text-sm text-slate-600">
        {shop.gstin && <div>GSTIN: {shop.gstin}</div>}
        {shop.address && <div>{[shop.address, shop.city, shop.pincode].filter(Boolean).join(', ')}</div>}
      </dl>

      <RecordRepayment key={data.payments.length} ledger={data} onSaved={refresh} />
      <OpenOrders ledger={data} />
      <Payments shopId={id} payments={data.payments} onChanged={refresh} />
    </>
  )
}

function RecordRepayment({ ledger, onSaved }: { ledger: ShopLedger; onSaved: () => void }) {
  const [form, setForm] = useState<PaymentFormValues>(emptyPaymentForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => shopsApi.recordPayment(ledger.shop.id, inputFromPaymentForm(form)),
    onSuccess: onSaved,
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = paymentFormErrors(form)
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    const owed = Math.max(ledger.shop.outstanding, 0)
    const amount = Number(form.amount)
    if (amount > owed && !confirmAction(`This shop owes ${formatRupees(owed)}. Keep the extra ${formatRupees(amount - owed)} as an advance?`)) return
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="card mb-4 p-4" noValidate>
      <h2 className="mb-3 font-semibold">Record repayment</h2>
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
      <div className="flex flex-wrap items-start gap-3">
        <Field label="Amount ₹" error={errors.amount}>
          <input
            className="input w-36"
            inputMode="decimal"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </Field>
        <Field label="Method">
          <select
            className="input w-32"
            value={form.method}
            onChange={(e) => setForm((f) => ({ ...f, method: e.target.value as PaymentFormValues['method'] }))}
          >
            {PAYMENT_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference (optional)" error={errors.reference} hint="Cheque number, UTR">
          <input className="input w-56" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
        </Field>
        <div className="pt-6">
          <Button type="submit" busy={save.isPending}>
            Record repayment
          </Button>
        </div>
      </div>
    </form>
  )
}

function OpenOrders({ ledger }: { ledger: ShopLedger }) {
  return (
    <section className="card mb-4 overflow-x-auto">
      <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">Orders on credit</h2>
      {ledger.openOrders.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No open credit orders.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Order</th>
              <th className="px-4 py-2">Placed</th>
              <th className="px-4 py-2 text-right">Total</th>
              <th className="px-4 py-2 text-right">Still due</th>
            </tr>
          </thead>
          <tbody>
            {ledger.openOrders.map((order) => (
              <tr key={order.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <Link className="font-mono text-xs text-brand underline" to={`/orders/${order.id}`}>
                    {order.orderNumber}
                  </Link>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(order.createdAt)}</td>
                <td className="px-4 py-2 text-right">{formatRupees(order.total)}</td>
                <td className="px-4 py-2 text-right font-semibold">{formatRupees(order.due)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Repayments clear the oldest orders first.</p>
    </section>
  )
}

function Payments({ shopId, payments, onChanged }: { shopId: string; payments: ShopPayment[]; onChanged: () => void }) {
  const voidPayment = useMutation({
    mutationFn: (paymentId: string) => shopsApi.voidPayment(shopId, paymentId),
    onSuccess: onChanged,
  })

  return (
    <section className="card overflow-x-auto">
      <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">Payments received</h2>
      <ErrorBanner message={voidPayment.error?.message} />
      {payments.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No repayments yet.</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className={`border-b border-slate-100 last:border-0 ${p.voided ? 'text-slate-400' : ''}`}>
                <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(p.createdAt)}</td>
                <td className={`px-4 py-2 text-right font-semibold ${p.voided ? 'line-through' : ''}`}>{formatRupees(p.amount)}</td>
                <td className="px-4 py-2">{paymentMethodLabel(p.method)}</td>
                <td className="px-4 py-2">{p.reference ?? '—'}</td>
                <td className="px-4 py-2 text-xs">{p.receivedBy ?? '—'}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  {p.voided ? (
                    <Badge tone="gray">Voided{p.voidedBy ? ` by ${p.voidedBy}` : ''}</Badge>
                  ) : (
                    <Button
                      variant="danger"
                      busy={voidPayment.isPending && voidPayment.variables === p.id}
                      onClick={() =>
                        confirmAction(`Void this ${formatRupees(p.amount)} payment? The shop will owe it again.`) && voidPayment.mutate(p.id)
                      }
                    >
                      Void
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="card p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-lg font-semibold">{children}</dd>
    </div>
  )
}
