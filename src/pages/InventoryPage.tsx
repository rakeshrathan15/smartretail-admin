import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useState, type FormEvent } from 'react'
import { ApiError } from '../api/client'
import { inventoryApi, type AdjustmentReason, type InventoryRow, type LevelFilter } from '../api/purchasing'
import { Badge, Button, ErrorBanner, Field, PageHeader, Pager, Spinner, Stat } from '../components/ui'
import { formatDateTime, formatRupees } from '../lib/format'
import {
  ADJUSTMENT_REASONS,
  adjustmentFormErrors,
  emptyAdjustmentForm,
  inputFromAdjustmentForm,
  reasonLabel,
  type AdjustmentFormValues,
} from './purchasingForms'

export function InventoryPage() {
  const [search, setSearch] = useState('')
  const [level, setLevel] = useState<LevelFilter>('ALL')
  const [page, setPage] = useState(0)
  const [adjusting, setAdjusting] = useState<InventoryRow | null>(null)
  const q = useDeferredValue(search.trim())

  const summary = useQuery({ queryKey: ['inventory', 'summary'], queryFn: inventoryApi.summary })
  const stock = useQuery({
    queryKey: ['inventory', 'stock', { q, level, page }],
    queryFn: () => inventoryApi.stock({ q, level, page }),
    placeholderData: keepPreviousData,
  })
  const data = stock.data

  return (
    <>
      <PageHeader title="Inventory" subtitle="What you have in stock and what it is worth. All counts are in cases." />
      {summary.data && (
        <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Low stock" value={summary.data.lowStock} />
          <Stat label="Out of stock" value={summary.data.outOfStock} />
          <Stat label="Stock value (cost)" value={formatRupees(summary.data.stockValue)} />
          <Stat label="Potential profit" value={formatRupees(summary.data.potentialProfit)} />
        </dl>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="input max-w-sm"
          type="search"
          aria-label="Search products"
          placeholder="Search products"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        <select
          className="input w-auto"
          aria-label="Stock level"
          value={level}
          onChange={(e) => {
            setLevel(e.target.value as LevelFilter)
            setPage(0)
          }}
        >
          <option value="ALL">All products</option>
          <option value="LOW">Low stock</option>
          <option value="OUT">Out of stock</option>
        </select>
      </div>
      <ErrorBanner message={stock.error?.message ?? summary.error?.message} />
      {adjusting && <AdjustForm key={adjusting.productId} product={adjusting} onClose={() => setAdjusting(null)} />}

      <div className="card overflow-x-auto">
        {stock.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-right">Cost ₹</th>
                <th className="px-4 py-3 text-right">Sell ₹</th>
                <th className="px-4 py-3 text-right">Margin</th>
                <th className="px-4 py-3 text-right">Value</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No products found.
                  </td>
                </tr>
              )}
              {data?.items.map((p) => (
                <tr key={p.productId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.brand && <div className="text-xs text-slate-500">{p.brand}</div>}
                  </td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    {p.level === 'OUT' && <Badge tone="red">OUT</Badge>}
                    {p.level === 'LOW' && <Badge tone="amber">LOW</Badge>}
                    <span className="font-semibold">{p.stock}</span>
                  </td>
                  <td className="px-4 py-3 text-right">{p.costPrice == null ? '—' : formatRupees(p.costPrice)}</td>
                  <td className="px-4 py-3 text-right">{formatRupees(p.sellPrice)}</td>
                  <td className="px-4 py-3 text-right">{p.costPrice == null ? '—' : formatRupees(p.sellPrice - p.costPrice)}</td>
                  <td className="px-4 py-3 text-right">{p.stockValue == null ? '—' : formatRupees(p.stockValue)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="secondary" aria-label={`Adjust ${p.name}`} onClick={() => setAdjusting(p)}>
                      Adjust
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} noun="products" onPage={setPage} />}
      <AdjustmentHistory />
    </>
  )
}

function AdjustForm({ product, onClose }: { product: InventoryRow; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<AdjustmentFormValues>(emptyAdjustmentForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => inventoryApi.adjust(inputFromAdjustmentForm(product.productId, form)),
    onSuccess: () => {
      ;[['inventory'], ['products'], ['product']].forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
      onClose()
    },
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = adjustmentFormErrors(form, product.stock)
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  return (
    <form onSubmit={submit} className="card mb-4 space-y-3 p-4" noValidate>
      <h2 className="font-semibold">
        Adjust {product.name} ({product.stock} in stock)
      </h2>
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Change (+/-) *" error={errors.delta} hint="-2 for a loss, +5 for extra found">
          <input className="input" value={form.delta} onChange={(e) => setForm((f) => ({ ...f, delta: e.target.value }))} />
        </Field>
        <Field label="Reason">
          <select className="input" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value as AdjustmentReason }))}>
            {ADJUSTMENT_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" error={errors.notes}>
          <input className="input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          Save adjustment
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

function AdjustmentHistory() {
  const [page, setPage] = useState(0)
  const history = useQuery({
    queryKey: ['inventory', 'adjustments', page],
    queryFn: () => inventoryApi.adjustments(page),
    placeholderData: keepPreviousData,
  })
  const data = history.data

  return (
    <section className="mt-6">
      <div className="card overflow-x-auto">
        <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">Adjustment history</h2>
        <ErrorBanner message={history.error?.message} />
        {data?.items.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No adjustments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {data?.items.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                  <td className="px-4 py-2 font-medium">{a.productName}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${a.delta < 0 ? 'text-red-700' : 'text-green-700'}`}>
                    {a.delta > 0 ? `+${a.delta}` : a.delta}
                  </td>
                  <td className="px-4 py-2">{reasonLabel(a.reason)}</td>
                  <td className="px-4 py-2">{a.notes ?? '—'}</td>
                  <td className="px-4 py-2 text-xs">{a.createdBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} noun="adjustments" onPage={setPage} />}
    </section>
  )
}
