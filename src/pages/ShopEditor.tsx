import { useMutation, useQuery } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { routesApi } from '../api/delivery'
import { shopsApi, type Shop } from '../api/shops'
import { Button, ErrorBanner, Field } from '../components/ui'
import { emptyShopForm, formFromShop, inputFromShopForm, shopFormErrors, type ShopFormValues } from './shopForm'

/** Adds a shop by hand, or edits one. The route of a shop with an account follows its map pin. */
export function ShopEditor({ shop, onDone, onCancel }: { shop: Shop | null; onDone: () => void; onCancel: () => void }) {
  const routes = useQuery({ queryKey: ['routes'], queryFn: routesApi.list })
  const [form, setForm] = useState<ShopFormValues>(shop ? formFromShop(shop) : emptyShopForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => {
      const body = inputFromShopForm(form)
      return shop ? shopsApi.update(shop.id, body) : shopsApi.create(body)
    },
    onSuccess: onDone,
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })
  const routeFromPin = shop?.ownerUserId != null

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = shopFormErrors(form)
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  const text = (key: keyof ShopFormValues) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <form onSubmit={submit} className="card mb-4 space-y-4 p-5" noValidate>
      <h2 className="font-semibold">{shop ? `Edit ${shop.name}` : 'New shop'}</h2>
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Shop name *" error={errors.name}>
          <input className="input" {...text('name')} />
        </Field>
        <Field label="Phone" error={errors.phone}>
          <input className="input" inputMode="tel" {...text('phone')} />
        </Field>
        <Field label="GSTIN" error={errors.gstin}>
          <input className="input" {...text('gstin')} />
        </Field>
        <Field label="Address" error={errors.address}>
          <input className="input" {...text('address')} />
        </Field>
        <Field label="City" error={errors.city}>
          <input className="input" {...text('city')} />
        </Field>
        <Field label="PIN code" error={errors.pincode}>
          <input className="input" inputMode="numeric" {...text('pincode')} />
        </Field>
        <Field label="Delivery route" error={errors.deliveryRouteId} hint={routeFromPin ? 'Follows the shop’s map pin' : undefined}>
          <select className="input" disabled={routeFromPin} {...text('routeId')}>
            <option value="">No route</option>
            {routes.data?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Credit limit (₹)" error={errors.creditLimit} hint="0 means no credit">
          <input className="input" type="number" min={0} step={1000} {...text('creditLimit')} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          {shop ? 'Save' : 'Add shop'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
