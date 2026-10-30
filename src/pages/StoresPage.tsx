import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { storesApi, type Store } from '../api/delivery'
import { Badge, Button, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui'
import { confirmAction } from '../lib/confirm'
import { emptyStoreForm, formFromStore, inputFromStoreForm, storeFormErrors, type StoreFormValues } from './storeForm'

export function StoresPage() {
  const queryClient = useQueryClient()
  const stores = useQuery({ queryKey: ['stores'], queryFn: storesApi.list })
  const [editing, setEditing] = useState<Store | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['stores'] })
  const handlers = {
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: (e: Error) => setError(e.message),
  }
  const toggle = useMutation({ mutationFn: (s: Store) => storesApi.setActive(s.id, !s.active), ...handlers })
  const remove = useMutation({ mutationFn: (s: Store) => storesApi.remove(s.id), ...handlers })

  return (
    <>
      <PageHeader
        title="Stores"
        subtitle="The warehouses and branches your delivery routes leave from."
        actions={editing === null && <Button onClick={() => setEditing('new')}>+ Add store</Button>}
      />
      {editing !== null && (
        <StoreForm
          key={editing === 'new' ? 'new' : editing.id}
          store={editing === 'new' ? null : editing}
          onDone={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      <ErrorBanner message={error ?? stores.error?.message} />

      <div className="card mt-2 overflow-x-auto">
        {stores.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">GSTIN</th>
                <th className="px-4 py-3">Routes</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {stores.data?.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No stores yet.
                  </td>
                </tr>
              )}
              {stores.data?.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-slate-500">{[s.address, s.city, s.pincode].filter(Boolean).join(', ')}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{s.phone ?? '—'}</div>
                    {s.email && <div className="text-xs text-slate-500">{s.email}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{s.gstin ?? '—'}</td>
                  <td className="px-4 py-3">{s.routeCount}</td>
                  <td className="px-4 py-3">{s.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Off</Badge>}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    <Button variant="secondary" onClick={() => setEditing(s)}>
                      Edit
                    </Button>
                    <Button variant="secondary" busy={toggle.isPending && toggle.variables?.id === s.id} onClick={() => toggle.mutate(s)}>
                      {s.active ? 'Turn off' : 'Turn on'}
                    </Button>
                    <Button
                      variant="danger"
                      busy={remove.isPending && remove.variables?.id === s.id}
                      onClick={() => confirmAction(`Delete store ${s.name}?`) && remove.mutate(s)}
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

function StoreForm({ store, onDone }: { store: Store | null; onDone: () => void }) {
  const [form, setForm] = useState<StoreFormValues>(store ? formFromStore(store) : emptyStoreForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => {
      const body = inputFromStoreForm(form)
      return store ? storesApi.update(store.id, body) : storesApi.create(body)
    },
    onSuccess: onDone,
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = storeFormErrors(form)
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  const input = (key: keyof StoreFormValues, props: Record<string, unknown> = {}) => (
    <input className="input" value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} {...props} />
  )

  return (
    <form onSubmit={submit} className="card mb-4 space-y-4 p-5" noValidate>
      <h2 className="font-semibold">{store ? `Edit ${store.name}` : 'New store'}</h2>
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Store name *" error={errors.name}>
          {input('name')}
        </Field>
        <Field label="Phone" error={errors.phone}>
          {input('phone', { type: 'tel' })}
        </Field>
        <Field label="Email" error={errors.email}>
          {input('email', { type: 'email' })}
        </Field>
        <Field label="GSTIN" error={errors.gstin}>
          {input('gstin', { className: 'input font-mono uppercase', maxLength: 15 })}
        </Field>
        <Field label="City" error={errors.city}>
          {input('city')}
        </Field>
        <Field label="PIN code" error={errors.pincode}>
          {input('pincode', { inputMode: 'numeric', maxLength: 6 })}
        </Field>
      </div>
      <Field label="Full address" error={errors.address}>
        {input('address')}
      </Field>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          {store ? 'Save' : 'Add store'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
