import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDeferredValue, useState } from 'react'
import { useSearchParams } from 'react-router'
import { customersApi, routesApi } from '../api/delivery'
import { Badge, ErrorBanner, PageHeader, Pager, Spinner } from '../components/ui'
import { formatDateTime } from '../lib/format'

export function CustomersPage() {
  const [params, setParams] = useSearchParams()
  const route = params.get('route') ?? 'all'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const q = useDeferredValue(search.trim())

  const routes = useQuery({ queryKey: ['routes'], queryFn: routesApi.list })
  const customers = useQuery({
    queryKey: ['customers', { q, route, page }],
    queryFn: () => customersApi.list({ q, route, page }),
    placeholderData: keepPreviousData,
  })
  const data = customers.data

  return (
    <>
      <PageHeader title="Customers" subtitle="Every registered shop, and the delivery route it is on." />
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          className="input max-w-sm"
          type="search"
          aria-label="Search customers"
          placeholder="Search shop, name, phone, city or PIN"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(0)
          }}
        />
        <select
          className="input w-auto"
          aria-label="Route"
          value={route}
          onChange={(e) => {
            setParams(e.target.value === 'all' ? {} : { route: e.target.value })
            setPage(0)
          }}
        >
          <option value="all">All routes</option>
          <option value="unassigned">No route</option>
          {routes.data?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <ErrorBanner message={customers.error?.message} />

      <div className="card overflow-x-auto">
        {customers.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Shop / name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">City</th>
                <th className="px-4 py-3">PIN</th>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No customers found.
                  </td>
                </tr>
              )}
              {data?.items.map((c) => (
                <tr key={c.userId} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{c.shopName ?? c.fullName ?? 'Unknown'}</div>
                    {c.shopName && c.fullName && <div className="text-xs text-slate-500">{c.fullName}</div>}
                  </td>
                  <td className="px-4 py-3">{c.phone ?? c.email ?? '—'}</td>
                  <td className="px-4 py-3">{c.city ?? '—'}</td>
                  <td className="px-4 py-3">{c.pincode ?? '—'}</td>
                  <td className="px-4 py-3">
                    {c.routeName ? (
                      <span className="flex items-center gap-2">
                        <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: c.routeColor ?? '#94A3B8' }} />
                        {c.routeName}
                      </span>
                    ) : c.hasLocation ? (
                      <Badge tone="amber">Outside routes</Badge>
                    ) : (
                      <Badge tone="gray">No location</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(c.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && <Pager page={data.page} totalPages={data.totalPages} totalItems={data.totalItems} noun="customers" onPage={setPage} />}
    </>
  )
}
