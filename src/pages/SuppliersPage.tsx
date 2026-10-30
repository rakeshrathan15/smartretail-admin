import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { suppliersApi, type Supplier } from '../api/purchasing'
import { Badge, Button, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui'
import { emptySupplierForm, formFromSupplier, inputFromSupplierForm, supplierFormErrors, type SupplierFormValues } from './purchasingForms'

export function SuppliersPage() {
  const queryClient = useQueryClient()
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['suppliers'] })
  const toggle = useMutation({ mutationFn: (s: Supplier) => suppliersApi.setActive(s.id, !s.active), onSuccess: refresh })

  return (
    <>
      <PageHeader
        title="Suppliers"
        subtitle="The companies you buy stock from."
        actions={editing === null && <Button onClick={() => setEditing('new')}>+ Add supplier</Button>}
      />
      {editing !== null && (
        <SupplierForm
          key={editing === 'new' ? 'new' : editing.id}
          supplier={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      <ErrorBanner message={suppliers.error?.message ?? toggle.error?.message} />
      <div className="card mt-2 overflow-x-auto">
        {suppliers.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">GSTIN</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No suppliers yet. Add your first one.
                  </td>
                </tr>
              )}
              {suppliers.data?.map((s) => (
                <tr key={s.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name}</div>
                    {s.address && <div className="text-xs text-slate-500">{s.address}</div>}
                    {s.notes && <div className="text-xs text-slate-500">{s.notes}</div>}
                  </td>
                  <td className="px-4 py-3">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3">{s.gstin ?? '—'}</td>
                  <td className="px-4 py-3">{s.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Off</Badge>}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    <Button variant="secondary" onClick={() => setEditing(s)}>
                      Edit
                    </Button>
                    <Button variant="secondary" busy={toggle.isPending && toggle.variables?.id === s.id} onClick={() => toggle.mutate(s)}>
                      {s.active ? 'Turn off' : 'Turn on'}
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

function SupplierForm({ supplier, onDone, onCancel }: { supplier: Supplier | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<SupplierFormValues>(supplier ? formFromSupplier(supplier) : emptySupplierForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => {
      const body = inputFromSupplierForm(form)
      return supplier ? suppliersApi.update(supplier.id, body) : suppliersApi.create(body)
    },
    onSuccess: onDone,
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = supplierFormErrors(form)
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  const text = (key: keyof SupplierFormValues) => ({
    value: form[key],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <form onSubmit={submit} className="card mb-4 space-y-4 p-5" noValidate>
      <h2 className="font-semibold">{supplier ? `Edit ${supplier.name}` : 'New supplier'}</h2>
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Name *" error={errors.name}>
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
        <Field label="Notes" error={errors.notes}>
          <input className="input" {...text('notes')} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          {supplier ? 'Save' : 'Add supplier'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
