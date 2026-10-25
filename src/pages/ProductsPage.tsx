import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { catalogApi } from '../api/catalog'
import { Badge, Button, ErrorBanner, PageHeader, Spinner } from '../components/ui'
import { formatRupees } from '../lib/format'

const PAGE_SIZE = 20

/** Filters live in the URL (?q=&category=&status=&page=) so a refresh or back button keeps them. */
export function ProductsPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? 0)

  // The search box follows the URL when it changes from outside (back button, links).
  const [search, setSearch] = useState(q)
  const [syncedQ, setSyncedQ] = useState(q)
  if (q !== syncedQ) {
    setSyncedQ(q)
    setSearch(q)
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
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  // Search as the admin types, after a short pause.
  useEffect(() => {
    if (search === q) return
    const timer = setTimeout(() => update({ q: search, page: '' }), 300)
    return () => clearTimeout(timer)
  }, [search, q, update])

  const categories = useQuery({ queryKey: ['categories'], queryFn: catalogApi.categories })
  const products = useQuery({
    queryKey: ['products', { q, category, status, page }],
    queryFn: () =>
      catalogApi.products({
        q,
        category,
        active: status === '' ? undefined : status === 'active',
        page,
        size: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  })

  const data = products.data
  return (
    <>
      <PageHeader
        title="Products"
        subtitle={data ? `${data.totalItems} products` : undefined}
        actions={<Button onClick={() => navigate('/products/new')}>+ New product</Button>}
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          className="input max-w-xs"
          placeholder="Search name, brand, flavour"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search products"
        />
        <select
          className="input w-auto"
          value={category}
          onChange={(e) => update({ category: e.target.value, page: '' })}
          aria-label="Category"
        >
          <option value="">All categories</option>
          {categories.data?.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={status}
          onChange={(e) => update({ status: e.target.value, page: '' })}
          aria-label="Status"
        >
          <option value="">Active and hidden</option>
          <option value="active">Active only</option>
          <option value="hidden">Hidden only</option>
        </select>
      </div>

      <ErrorBanner message={products.error?.message} />

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price / case</th>
              <th className="px-4 py-3 text-right">Stock (cases)</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {products.isPending && (
              <tr>
                <td colSpan={5} className="p-8 text-center">
                  <Spinner />
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">
                  No products match these filters.
                </td>
              </tr>
            )}
            {data?.items.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <Link to={`/products/${p.id}`} className="flex items-center gap-3">
                    <Thumb url={p.imageUrl} />
                    <span>
                      <span className="block font-medium text-brand hover:underline">{p.name}</span>
                      <span className="text-xs text-slate-500">
                        {p.brand ?? 'No brand'} · {p.unitsPerCase}/case
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3">{p.categoryName ?? <span className="text-slate-400">None</span>}</td>
                <td className="px-4 py-3 text-right">
                  {formatRupees(p.price)}
                  {p.lowestPrice < p.price && (
                    <span className="block text-xs text-green-700">bulk from {formatRupees(p.lowestPrice)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {p.stockQuantity === 0 ? (
                    <Badge tone="red">Out of stock</Badge>
                  ) : p.stockQuantity <= p.lowStockThreshold ? (
                    <Badge tone="amber">{p.stockQuantity} low</Badge>
                  ) : (
                    p.stockQuantity
                  )}
                </td>
                <td className="px-4 py-3">{p.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Hidden</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          <Button variant="secondary" disabled={page === 0} onClick={() => update({ page: String(page - 1) })}>
            Previous
          </Button>
          <span>
            Page {page + 1} of {data.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page + 1 >= data.totalPages}
            onClick={() => update({ page: String(page + 1) })}
          >
            Next
          </Button>
        </div>
      )}
    </>
  )
}

export function Thumb({ url, size = 'h-10 w-10' }: { url: string | null; size?: string }) {
  return url ? (
    <img src={url} alt="" className={`${size} shrink-0 rounded object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded bg-slate-200 text-xs text-slate-500`}>
      No img
    </span>
  )
}
