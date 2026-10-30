import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { storesApi } from '../api/delivery'
import { inventoryApi, suppliersApi, type InventoryRow, type Receipt } from '../api/purchasing'
import { Button, ErrorBanner, Field, PageHeader, Pager, Spinner } from '../components/ui'
import { formatDay, formatRupees, todayInIndia } from '../lib/format'
import { inputFromReceiptForm, receiptFormErrors, receiptTotal, type ReceiptFormValues } from './purchasingForms'

const emptyForm = (): ReceiptFormValues => ({ supplierId: '', storeId: '', receiptDate: todayInIndia(), invoiceNumber: '', notes: '', lines: [] })

export function StockReceiptsPage() {
  const [page, setPage] = useState(0)
  const [receiving, setReceiving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const receipts = useQuery({
    queryKey: ['receipts', page],
    queryFn: () => inventoryApi.receipts(page),
    placeholderData: keepPreviousData,
  })
  const data = receipts.data

  return (
    <>
      <PageHeader
        title="Stock receipts"
        subtitle="Record stock arriving from a supplier. Each product's stock goes up and its cost becomes the new price."
        actions={!receiving && <Button onClick={() => setReceiving(true)}>+ Receive stock</Button>}
      />
      {receiving && (
        <ReceiveForm
          onCancel={() => setReceiving(false)}
          onDone={(message) => {
            setReceiving(false)
            setNotice(message)
          }}
        />
      )}
      {notice && (
        <p role="status" className="mb-2 text-sm text-green-700">
          {notice}
        </p>
      )}
      <ErrorBanner message={receipts.error?.message} />
      <div className="card mt-2 overflow-x-auto">
        {receipts.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Bill no.</th>
                <th className="px-4 py-3 text-right">Products</th>
                <th className="px-4 py-3 text-right">Cases</th>
                <th className="px-4 py-3 text-right">Total cost</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No stock receipts yet.
                  </td>
                </tr>
              )}
              {data?.items.map((r) => (
                <ReceiptRow key={r.id} receipt={r} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} noun="receipts" onPage={setPage} />}
    </>
  )
}

function ReceiptRow({ receipt }: { receipt: Receipt }) {
  const [open, setOpen] = useState(false)
  const detail = useQuery({ queryKey: ['receipts', 'detail', receipt.id], queryFn: () => inventoryApi.receipt(receipt.id), enabled: open })
  return (
    <>
      <tr className="border-b border-slate-100 last:border-0">
        <td className="px-4 py-3 whitespace-nowrap">{formatDay(receipt.receiptDate)}</td>
        <td className="px-4 py-3">{receipt.supplierName ?? '—'}</td>
        <td className="px-4 py-3">{receipt.invoiceNumber ?? '—'}</td>
        <td className="px-4 py-3 text-right">{receipt.itemCount}</td>
        <td className="px-4 py-3 text-right">{receipt.totalCases}</td>
        <td className="px-4 py-3 text-right font-semibold">{formatRupees(receipt.totalCost)}</td>
        <td className="px-4 py-3 text-right">
          <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'View'}
          </Button>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-slate-100 bg-slate-50">
          <td colSpan={7} className="px-4 py-3">
            <ErrorBanner message={detail.error?.message} />
            {detail.data?.notes && <p className="mb-2 text-xs text-slate-500">{detail.data.notes}</p>}
            {detail.isPending && <Spinner small />}
            <ul className="space-y-1">
              {detail.data?.items.map((item) => (
                <li key={item.productId} className="flex justify-between gap-4">
                  <span>{item.productName}</span>
                  <span className="whitespace-nowrap text-slate-600">
                    {item.quantity} × {formatRupees(item.costPrice)} = {formatRupees(item.total)}
                  </span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}

function ReceiveForm({ onDone, onCancel }: { onDone: (message: string) => void; onCancel: () => void }) {
  const queryClient = useQueryClient()
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: suppliersApi.list })
  const stores = useQuery({ queryKey: ['stores'], queryFn: storesApi.list })
  const [form, setForm] = useState<ReceiptFormValues>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => inventoryApi.receive(inputFromReceiptForm(form)),
    onSuccess: (saved) => {
      ;[['receipts'], ['inventory'], ['products'], ['product']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      onDone(`Received ${saved.receipt.totalCases} cases for ${formatRupees(saved.receipt.totalCost)}.`)
    },
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = receiptFormErrors(form, todayInIndia())
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  const update = (changes: Partial<ReceiptFormValues>) => setForm((f) => ({ ...f, ...changes }))
  const setLine = (productId: string, changes: { quantity?: string; cost?: string }) =>
    update({ lines: form.lines.map((l) => (l.productId === productId ? { ...l, ...changes } : l)) })
  const addProduct = (p: InventoryRow) => {
    if (form.lines.some((l) => l.productId === p.productId)) return
    update({ lines: [...form.lines, { productId: p.productId, name: p.name, quantity: '', cost: p.costPrice == null ? '' : String(p.costPrice) }] })
  }

  return (
    <form onSubmit={submit} className="card mb-4 space-y-4 p-5" noValidate>
      <h2 className="font-semibold">Receive stock from a supplier</h2>
      <ErrorBanner message={suppliers.error?.message ?? (save.error && Object.keys(errors).length === 0 ? save.error.message : null)} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Supplier" hint={suppliers.data?.length === 0 ? 'Add suppliers under Suppliers' : 'Optional'}>
          <select className="input" value={form.supplierId} onChange={(e) => update({ supplierId: e.target.value })}>
            <option value="">No supplier</option>
            {suppliers.data?.filter((s) => s.active).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Store" hint="Optional">
          <select className="input" value={form.storeId} onChange={(e) => update({ storeId: e.target.value })}>
            <option value="">No store</option>
            {stores.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date *" error={errors.receiptDate}>
          <input className="input" type="date" max={todayInIndia()} value={form.receiptDate} onChange={(e) => update({ receiptDate: e.target.value })} />
        </Field>
        <Field label="Bill number" error={errors.invoiceNumber} hint="Stops the same bill being entered twice">
          <input className="input" value={form.invoiceNumber} onChange={(e) => update({ invoiceNumber: e.target.value })} />
        </Field>
      </div>

      <ProductSearch onPick={addProduct} />
      {errors.lines && <p className="text-sm text-red-600">{errors.lines}</p>}
      {form.lines.length > 0 && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2 pr-2">Product</th>
              <th className="py-2 pr-2">Cases</th>
              <th className="py-2 pr-2">Cost per case ₹</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {form.lines.map((line) => (
              <tr key={line.productId} className="border-t border-slate-100 align-top">
                <td className="py-2 pr-2 font-medium">{line.name}</td>
                <td className="py-2 pr-2">
                  <Field label="" error={errors[`quantity-${line.productId}`]}>
                    <input
                      className="input w-24"
                      inputMode="numeric"
                      aria-label={`Cases of ${line.name}`}
                      value={line.quantity}
                      onChange={(e) => setLine(line.productId, { quantity: e.target.value })}
                    />
                  </Field>
                </td>
                <td className="py-2 pr-2">
                  <Field label="" error={errors[`cost-${line.productId}`]}>
                    <input
                      className="input w-28"
                      inputMode="decimal"
                      aria-label={`Cost of ${line.name}`}
                      value={line.cost}
                      onChange={(e) => setLine(line.productId, { cost: e.target.value })}
                    />
                  </Field>
                </td>
                <td className="py-2 text-right">
                  <Button variant="ghost" aria-label={`Remove ${line.name}`} onClick={() => update({ lines: form.lines.filter((l) => l.productId !== line.productId) })}>
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-right font-semibold">Total cost: {formatRupees(receiptTotal(form.lines))}</p>
      <Field label="Notes" error={errors.notes}>
        <input className="input" value={form.notes} onChange={(e) => update({ notes: e.target.value })} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          Save receipt
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function ProductSearch({ onPick }: { onPick: (product: InventoryRow) => void }) {
  const [search, setSearch] = useState('')
  const q = useDeferredValue(search.trim())
  const results = useQuery({
    queryKey: ['inventory', 'product-search', q],
    queryFn: () => inventoryApi.stock({ q, level: 'ALL', page: 0 }),
    enabled: q.length >= 2,
  })
  return (
    <div>
      <Field label="Add products">
        <input className="input max-w-md" type="search" placeholder="Search product to add" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <ErrorBanner message={results.error?.message} />
      {q.length >= 2 && results.data && (
        <ul className="mt-1 max-w-md divide-y divide-slate-100 rounded-md border border-slate-200">
          {results.data.items.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No products found.</li>}
          {results.data.items.map((p) => (
            <li key={p.productId}>
              <button
                type="button"
                className="flex w-full justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onPick(p)
                  setSearch('')
                }}
              >
                <span>{p.name}</span>
                <span className="text-slate-500">{p.stock} in stock</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
