import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { settingsApi } from '../api/orders'
import type { StoreSettings } from '../api/types'
import { Button, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui'
import { formatRupees } from '../lib/format'
import { formFromSettings, settingsErrors, settingsFromForm, type SettingsFormValues } from './settingsForm'

export function SettingsPage() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get })
  if (settings.isPending) return <Spinner />
  if (settings.error) return <ErrorBanner message={settings.error.message} />
  return <SettingsForm initial={settings.data} />
}

function SettingsForm({ initial }: { initial: StoreSettings }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<SettingsFormValues>(() => formFromSettings(initial))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: (body: StoreSettings) => settingsApi.save(body),
    onSuccess: (result) => {
      queryClient.setQueryData(['settings'], result)
      setForm(formFromSettings(result))
      setSaved(true)
    },
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setSaved(false)
    const problems = settingsErrors(form)
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate(settingsFromForm(form))
  }

  function set<K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) {
    setSaved(false)
    setForm((f) => ({ ...f, [key]: value }))
  }

  const text = (key: keyof SettingsFormValues, props: Record<string, unknown> = {}) => (
    <input className="input" value={form[key] as string} onChange={(e) => set(key, e.target.value as never)} {...props} />
  )

  const delivery = Number(form.deliveryCharge || 0)
  const freeAbove = Number(form.freeDeliveryAbove || 0)
  const minimum = Number(form.minOrderValue || 0)

  return (
    <form onSubmit={submit} noValidate className="max-w-4xl">
      <PageHeader title="Settings" subtitle="Changes apply to the app, the website and checkout as soon as you save." />
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />

      <div className="space-y-4">
        <Section title="Taking orders">
          <label className="flex items-center justify-between gap-4 rounded-md bg-slate-50 p-3 sm:col-span-2">
            <span>
              <span className="block font-medium">{form.storeOpen ? 'Store is open' : 'Store is closed'}</span>
              <span className="text-sm text-slate-500">
                {form.storeOpen ? 'Shops can place orders.' : 'Shops can browse, but checkout is blocked with “The store is closed right now”.'}
              </span>
            </span>
            <Toggle checked={form.storeOpen} onChange={(v) => set('storeOpen', v)} label="Store open" />
          </label>
          <Field label="Delivery charge (₹)" error={errors.deliveryCharge}>
            {text('deliveryCharge', { type: 'number', min: 0, step: 10 })}
          </Field>
          <Field
            label="Free delivery above (₹)"
            error={errors.freeDeliveryAbove}
            hint={freeAbove > 0 ? `Orders of ${formatRupees(freeAbove)} or more (after coupon) pay no delivery` : '0 = delivery is never free'}
          >
            {text('freeDeliveryAbove', { type: 'number', min: 0, step: 500 })}
          </Field>
          <Field label="Minimum order (₹)" error={errors.minOrderValue} hint={minimum > 0 ? `Smaller carts cannot check out` : '0 = no minimum'}>
            {text('minOrderValue', { type: 'number', min: 0, step: 100 })}
          </Field>
          <p className="self-end text-sm text-slate-600">
            Example: a {formatRupees(Math.max(minimum, 3000))} order pays{' '}
            {freeAbove > 0 && Math.max(minimum, 3000) >= freeAbove ? 'no delivery' : `${formatRupees(delivery)} delivery`}.
          </p>
        </Section>

        <Section title="Payments">
          <Field label="UPI ID" error={errors.upiId} hint="Shown at checkout for UPI payments. Leave empty to turn UPI off.">
            {text('upiId', { placeholder: 'yourshop@okaxis', autoCapitalize: 'off' })}
          </Field>
        </Section>

        <Section title="Store details">
          <Field label="Store name *" error={errors.storeName}>
            {text('storeName')}
          </Field>
          <Field label="Phone" error={errors.storePhone}>
            {text('storePhone', { type: 'tel' })}
          </Field>
          <Field label="Email" error={errors.storeEmail}>
            {text('storeEmail', { type: 'email' })}
          </Field>
          <Field label="WhatsApp number" error={errors.whatsappNumber}>
            {text('whatsappNumber', { type: 'tel' })}
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address" error={errors.storeAddress} hint="Shown at the top of the home page and in the footer">
              {text('storeAddress')}
            </Field>
          </div>
        </Section>

        <Section title="Certifications">
          <Field label="GST number (GSTIN)" error={errors.gstNumber}>
            {text('gstNumber', { className: 'input font-mono uppercase', maxLength: 15 })}
          </Field>
          <Field label="FSSAI number" error={errors.fssaiNumber}>
            {text('fssaiNumber', { className: 'input font-mono', inputMode: 'numeric', maxLength: 14 })}
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.showCertifications} onChange={(e) => set('showCertifications', e.target.checked)} />
            Show GSTIN and FSSAI number on the website footer
          </label>
        </Section>
      </div>

      <div className="sticky bottom-0 mt-4 flex items-center gap-3 border-t border-slate-200 bg-slate-50 py-3">
        <Button type="submit" busy={save.isPending}>
          Save settings
        </Button>
        {saved && <span role="status" className="text-sm text-green-700">Saved. The app and website use these now.</span>}
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${checked ? 'bg-green-600' : 'bg-slate-300'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-6' : 'left-1'}`} />
    </button>
  )
}
