import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { couponsApi } from '../api/orders'
import type { Coupon } from '../api/types'
import { Badge, Button, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui'
import { confirmAction } from '../lib/confirm'
import { formatRupees } from '../lib/format'
import {
  couponFormErrors,
  describeDiscount,
  emptyCouponForm,
  formFromCoupon,
  inputFromCouponForm,
  type CouponFormValues,
} from './couponForm'

export function CouponsPage() {
  const queryClient = useQueryClient()
  const coupons = useQuery({ queryKey: ['coupons'], queryFn: couponsApi.list })
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['coupons'] })
  const toggle = useMutation({
    mutationFn: (c: Coupon) => couponsApi.update(c.id, { ...inputFromCouponForm(formFromCoupon(c)), active: !c.active }),
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: (e) => setError(e.message),
  })
  const remove = useMutation({
    mutationFn: (c: Coupon) => couponsApi.remove(c.id),
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: (e) => setError(e.message),
  })

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Shops type the code in their cart. The discount is applied on the server."
        actions={editing === null && <Button onClick={() => setEditing('new')}>+ New coupon</Button>}
      />
      {editing !== null && (
        <CouponForm
          coupon={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      <ErrorBanner message={error ?? coupons.error?.message} />

      <div className="card mt-2 overflow-x-auto">
        {coupons.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Discount</th>
                <th className="px-4 py-3">Min order</th>
                <th className="px-4 py-3">Used</th>
                <th className="px-4 py-3">Valid until</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No coupons yet.
                  </td>
                </tr>
              )}
              {coupons.data?.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold">{c.code}</span>
                    {c.description && <div className="text-xs text-slate-500">{c.description}</div>}
                  </td>
                  <td className="px-4 py-3">{describeDiscount(c)}</td>
                  <td className="px-4 py-3">{c.minOrderValue ? formatRupees(c.minOrderValue) : '—'}</td>
                  <td className="px-4 py-3">
                    {c.usedCount}
                    {c.usageLimit !== null && <span className="text-slate-500"> / {c.usageLimit}</span>}
                  </td>
                  <td className="px-4 py-3">{c.validUntil ? formFromCoupon(c).validUntil : 'No end'}</td>
                  <td className="px-4 py-3">{c.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Off</Badge>}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    <Button variant="secondary" onClick={() => setEditing(c)}>
                      Edit
                    </Button>
                    <Button variant="secondary" busy={toggle.isPending && toggle.variables?.id === c.id} onClick={() => toggle.mutate(c)}>
                      {c.active ? 'Turn off' : 'Turn on'}
                    </Button>
                    <Button
                      variant="danger"
                      busy={remove.isPending && remove.variables?.id === c.id}
                      onClick={() => confirmAction(`Delete coupon ${c.code}?`) && remove.mutate(c)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function CouponForm({ coupon, onDone }: { coupon: Coupon | null; onDone: () => void }) {
  const [form, setForm] = useState<CouponFormValues>(coupon ? formFromCoupon(coupon) : emptyCouponForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => {
      const body = inputFromCouponForm(form)
      return coupon ? couponsApi.update(coupon.id, body) : couponsApi.create(body)
    },
    onSuccess: onDone,
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = couponFormErrors(form)
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  const set = (key: keyof CouponFormValues) => (value: string | boolean) => setForm((f) => ({ ...f, [key]: value }))
  const input = (key: keyof CouponFormValues, props: Record<string, unknown> = {}) => (
    <input className="input" value={form[key] as string} onChange={(e) => set(key)(e.target.value)} {...props} />
  )
  const isPercentage = form.discountType === 'PERCENTAGE'

  return (
    <form onSubmit={submit} className="card mb-4 space-y-4 p-5" noValidate>
      <h2 className="font-semibold">{coupon ? `Edit ${coupon.code}` : 'New coupon'}</h2>
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Code *" error={errors.code} hint="Shops type this, e.g. DIWALI10">
          {input('code', { className: 'input font-mono uppercase' })}
        </Field>
        <Field label="Type">
          <select className="input" value={form.discountType} onChange={(e) => set('discountType')(e.target.value)}>
            <option value="PERCENTAGE">Percentage off</option>
            <option value="FIXED">Fixed amount off</option>
          </select>
        </Field>
        <Field label={isPercentage ? 'Discount (%) *' : 'Discount (₹) *'} error={errors.discountValue}>
          {input('discountValue', { type: 'number', min: 0 })}
        </Field>
        {isPercentage && (
          <Field label="Up to (₹)" error={errors.maxDiscount} hint="Most a shop can save; empty for no cap">
            {input('maxDiscount', { type: 'number', min: 0 })}
          </Field>
        )}
        <Field label="Minimum order (₹)" error={errors.minOrderValue} hint="Cart value needed; empty for none">
          {input('minOrderValue', { type: 'number', min: 0 })}
        </Field>
        <Field label="Usage limit" error={errors.usageLimit} hint="Total uses by all shops; empty for no limit">
          {input('usageLimit', { type: 'number', min: 1 })}
        </Field>
        <Field label="Valid from" error={errors.validFrom}>
          {input('validFrom', { type: 'date' })}
        </Field>
        <Field label="Valid until" error={errors.validUntil}>
          {input('validUntil', { type: 'date' })}
        </Field>
      </div>
      <Field label="Description" hint="For your reference">
        {input('description')}
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => set('active')(e.target.checked)} />
        Active
      </label>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          {coupon ? 'Save' : 'Create coupon'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
