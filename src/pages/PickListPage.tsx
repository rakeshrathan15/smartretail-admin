import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { pickListApi, routesApi, type PickItem } from '../api/delivery'
import { Button, ErrorBanner, Field, PageHeader, Spinner, Stat } from '../components/ui'
import { addDays, formatDay, formatRupees, todayInIndia } from '../lib/format'
import { useLoadedChecklist } from '../lib/loadedChecklist'

const itemKey = (item: PickItem) => item.productId ?? item.productName

export function PickListPage() {
  const [route, setRoute] = useState('')
  const [date, setDate] = useState(() => addDays(todayInIndia(), 1))
  const routes = useQuery({ queryKey: ['routes'], queryFn: routesApi.list })
  const pickList = useQuery({
    queryKey: ['pick-list', route, date],
    queryFn: () => pickListApi.get(route, date),
    enabled: route !== '' && date !== '',
  })
  const { loaded, toggle } = useLoadedChecklist(route, date)
  const data = pickList.data

  /** Jumps to the route's next run, so a route that does not go tomorrow does not look empty. */
  function chooseRoute(id: string) {
    setRoute(id)
    const next = routes.data?.find((r) => r.id === id)?.nextDeliveryDate
    if (next) setDate(next)
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title="Route pick-list"
          subtitle="What to load on the van for a route and delivery date. Cancelled and returned orders are left out."
          actions={
            <>
              <Button variant="secondary" disabled={!route} onClick={() => pickList.refetch()}>
                Refresh
              </Button>
              <Button disabled={!data || data.items.length === 0} onClick={() => window.print()}>
                Print
              </Button>
            </>
          }
        />
        <div className="mb-4 grid max-w-xl gap-4 sm:grid-cols-2">
          <Field label="Route">
            <select className="input" value={route} onChange={(e) => chooseRoute(e.target.value)}>
              <option value="">Choose a route</option>
              {routes.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
              <option value="unassigned">No route</option>
            </select>
          </Field>
          <Field label="Delivery date">
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>
      </div>
      <ErrorBanner message={routes.error?.message ?? pickList.error?.message} />

      {!route && <p className="card p-8 text-center text-slate-500">Choose a route to see what to load.</p>}
      {pickList.isFetching && !data && (
        <div className="p-8 text-center">
          <Spinner />
        </div>
      )}

      {route && data && (
        <>
          <h2 className="mb-3 hidden text-xl font-semibold print:block">
            {data.routeName}: {formatDay(data.date)}
          </h2>
          <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Orders" value={data.totals.orders} />
            <Stat label="Unique SKUs" value={data.totals.uniqueSkus} />
            <Stat label="Cases" value={data.totals.cases} />
            <Stat label="Units" value={data.totals.units} />
            <Stat label="Route revenue" value={formatRupees(data.totals.revenue)} />
          </dl>

          <div className="card mb-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3 text-right">Cases</th>
                  <th className="px-4 py-3 text-right">Units</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-center">Loaded ✓</th>
                </tr>
              </thead>
              <tbody>
                {data.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No orders for this route and date.
                    </td>
                  </tr>
                )}
                {data.items.map((item) => {
                  const key = itemKey(item)
                  const isLoaded = loaded.has(key)
                  return (
                    <tr key={key} className={`border-b border-slate-100 last:border-0 ${isLoaded ? 'bg-green-50' : ''}`}>
                      <td className="px-4 py-3 font-medium">{item.productName}</td>
                      <td className="px-4 py-3">{item.brand ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{item.cases}</td>
                      <td className="px-4 py-3 text-right">{item.units}</td>
                      <td className="px-4 py-3 text-right">{formatRupees(item.value)}</td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          aria-label={`Loaded ${item.productName}`}
                          checked={isLoaded}
                          onChange={() => toggle(key)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {data.orders.length > 0 && (
            <div className="card overflow-x-auto">
              <h3 className="border-b border-slate-200 px-4 py-3 font-semibold">Orders on this run</h3>
              <table className="w-full text-sm">
                <tbody>
                  {data.orders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">{order.orderNumber}</td>
                      <td className="px-4 py-2">{order.shopName ?? 'Shop'}</td>
                      <td className="px-4 py-2">{order.customerPhone}</td>
                      <td className="px-4 py-2">{order.paymentMethod}</td>
                      <td className="px-4 py-2 text-right">{order.totalCases} cases</td>
                      <td className="px-4 py-2 text-right">{formatRupees(order.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  )
}
