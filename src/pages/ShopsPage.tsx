import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { shopsApi } from '../api/orders'
import type { CustomerOption, ShopCredit } from '../api/types'
import { Badge, Button, ErrorBanner, PageHeader, Spinner } from '../components/ui'
import { formatRupees } from '../lib/format'

/** Which shops may order on credit, how much, and what they owe. */
export function ShopsPage() {
  const shops = useQuery({ queryKey: ['shops'], queryFn: shopsApi.list })
  const withCredit = shops.data?.filter((s) => s.creditLimit > 0) ?? []

  return (
    <>
      <PageHeader
        title="Shop credit"
        subtitle="Shops with a credit limit can choose “Credit” at checkout, up to the limit minus what they owe."
      />
      <GiveCredit />
      <ErrorBanner message={shops.error?.message} />

      <div className="card mt-4 overflow-x-auto">
        {shops.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Shop</th>
                <th className="px-4 py-3 text-right">Owes</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3">Credit limit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {withCredit.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-500">
                    No shops have credit yet. Find a shop above to give credit.
                  </td>
                </tr>
              )}
              {withCredit.map((shop) => (
                <ShopRow key={shop.id} shop={shop} />
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        “Owes” is credit orders that are not cancelled, minus repayments. Recording repayments comes with the credit
        ledger.
      </p>
    </>
  )
}

function ShopRow({ shop }: { shop: ShopCredit }) {
  const available = shop.creditLimit - shop.outstanding
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-4 py-3">
        <div className="font-medium">{shop.name}</div>
        {shop.ownerPhone && <div className="text-xs text-slate-500">+91 {shop.ownerPhone}</div>}
      </td>
      <td className="px-4 py-3 text-right">{formatRupees(shop.outstanding)}</td>
      <td className="px-4 py-3 text-right">
        {available < 0 ? <Badge tone="red">Over by {formatRupees(-available)}</Badge> : formatRupees(available)}
      </td>
      <td className="px-4 py-3">
        {shop.ownerUserId ? <CreditLimitEditor userId={shop.ownerUserId} current={shop.creditLimit} /> : formatRupees(shop.creditLimit)}
      </td>
    </tr>
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
