import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDeferredValue, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { shopsApi, type ShopStanding } from '../api/shops'
import type { CustomerOption } from '../api/types'
import { Badge, Button, ErrorBanner, PageHeader, Pager, Spinner, Stat } from '../components/ui'
import { formatRupees } from '../lib/format'
import { ShopEditor } from './ShopEditor'

/** What a shop owes, or the advance it has paid. */
export function BalanceText({ outstanding }: { outstanding: number }) {
  return outstanding < 0 ? <span className="text-green-700">{formatRupees(-outstanding)} paid in advance</span> : <>{formatRupees(outstanding)}</>
}

/** Every shop, what it owes, and who may order on credit. */
export function ShopsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [standing, setStanding] = useState<ShopStanding>('ALL')
  const [page, setPage] = useState(0)
  const [adding, setAdding] = useState(false)
  const q = useDeferredValue(search.trim())

  const summary = useQuery({ queryKey: ['shops', 'summary'], queryFn: shopsApi.summary })
  const shops = useQuery({
    queryKey: ['shops', 'list', { q, standing, page }],
    queryFn: () => shopsApi.list({ q, standing, page }),
    placeholderData: keepPreviousData,
  })
  const data = shops.data

  return (
    <>
      <PageHeader
        title="Shops"
        subtitle="Shops with a credit limit can choose “Credit” at checkout, up to the limit minus what they owe."
        actions={!adding && <Button onClick={() => setAdding(true)}>+ New shop</Button>}
      />
      {adding && (
        <ShopEditor
          shop={null}
          onCancel={() => setAdding(false)}
          onDone={() => {
            setAdding(false)
            queryClient.invalidateQueries({ queryKey: ['shops'] })
          }}
        />
      )}
      {summary.data && (
        <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Active shops" value={summary.data.activeShops} />
          <Stat label="Total shops" value={summary.data.totalShops} />
          <Stat label="Credit outstanding" value={formatRupees(summary.data.creditOutstanding)} />
          <Stat label="Over limit" value={summary.data.overLimit} />
        </dl>
      )}
      <GiveCredit />

      <div className="mt-4 mb-3 flex flex-wrap gap-2">
        <input
          className="input max-w-sm"
          type="search"
          aria-label="Search shops"
          placeholder="Search by shop name, phone, city"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        <select
          className="input w-auto"
          aria-label="Standing"
          value={standing}
          onChange={(e) => {
            setStanding(e.target.value as ShopStanding)
            setPage(0)
          }}
        >
          <option value="ALL">All shops</option>
          <option value="OWING">Owing money</option>
          <option value="OVER_LIMIT">Over limit</option>
        </select>
      </div>
      <ErrorBanner message={shops.error?.message ?? summary.error?.message} />

      <div className="card overflow-x-auto">
        {shops.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3 text-right">Owes</th>
                <th className="px-4 py-3 text-right">Limit</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No shops found.
                  </td>
                </tr>
              )}
              {data?.items.map((shop) => (
                <tr key={shop.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <Link className="font-medium text-brand underline" to={`/shops/${shop.id}`}>
                      {shop.name}
                    </Link>
                    {shop.phone && <div className="text-xs text-slate-500">+91 {shop.phone}</div>}
                  </td>
                  <td className="px-4 py-3">{shop.city ?? '—'}</td>
                  <td className="px-4 py-3">{shop.routeName ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <BalanceText outstanding={shop.outstanding} />
                  </td>
                  <td className="px-4 py-3 text-right">{formatRupees(shop.creditLimit)}</td>
                  <td className="space-x-1 px-4 py-3 whitespace-nowrap">
                    {shop.overLimit && <Badge tone="red">OVER LIMIT</Badge>}
                    {shop.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Inactive</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} noun="shops" onPage={setPage} />}
    </>
  )
}

/** Search a shop owner by name, shop, phone or email and set their limit. */
function GiveCredit() {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(timer)
  }, [search])

  const results = useQuery({
    queryKey: ['customers', query],
    queryFn: () => shopsApi.searchCustomers(query),
    enabled: query.length >= 2,
  })

  return (
    <section className="card p-4">
      <h2 className="mb-2 font-semibold">Give credit to a shop</h2>
      <input
        className="input max-w-md"
        placeholder="Search by name, shop, mobile or email"
        aria-label="Search shop owners"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ErrorBanner message={results.error?.message} />
      {query.length >= 2 && results.data && (
        <ul className="mt-3 divide-y divide-slate-100">
          {results.data.length === 0 && <li className="py-2 text-sm text-slate-500">No shop owners found.</li>}
          {results.data.map((c) => (
            <CustomerResult key={c.userId} customer={c} />
          ))}
        </ul>
      )}
    </section>
  )
}

function CustomerResult({ customer }: { customer: CustomerOption }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
      <div>
        <div className="font-medium">{customer.shopName ?? customer.fullName ?? 'Unnamed'}</div>
        <div className="text-xs text-slate-500">
          {[customer.shopName ? customer.fullName : null, customer.phone && `+91 ${customer.phone}`, customer.email]
            .filter(Boolean)
            .join(' · ')}
        </div>
      </div>
      <CreditLimitEditor userId={customer.userId} current={customer.creditLimit ?? 0} />
    </li>
  )
}

function CreditLimitEditor({ userId, current }: { userId: string; current: number }) {
  const queryClient = useQueryClient()
  const [value, setValue] = useState(String(current))
  const [saved, setSaved] = useState(false)
  const save = useMutation({
    mutationFn: () => shopsApi.setCredit(userId, Number(value)),
    onSuccess: () => {
      setSaved(true)
      queryClient.invalidateQueries({ queryKey: ['shops'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
  const valid = value.trim() !== '' && Number(value) >= 0

  return (
    <div className="flex items-center gap-2">
      <input
        className="input w-32"
        type="number"
        min={0}
        step={1000}
        aria-label="Credit limit"
        value={value}
        onChange={(e) => {
          setSaved(false)
          setValue(e.target.value)
        }}
      />
      <Button busy={save.isPending} disabled={!valid || Number(value) === current} onClick={() => save.mutate()}>
        {Number(value) === 0 && current > 0 ? 'Turn off credit' : 'Save'}
      </Button>
      {saved && <span className="text-xs text-green-700">Saved</span>}
      {save.error && <span className="text-xs text-red-600">{save.error.message}</span>}
    </div>
  )
}
