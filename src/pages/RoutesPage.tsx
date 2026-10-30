import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { routesApi, storesApi, type DayCode, type DeliveryRoute, type MapPoint } from '../api/delivery'
import { RouteZoneMap } from '../components/RouteZoneMap'
import { Badge, Button, ErrorBanner, Field, PageHeader, Spinner } from '../components/ui'
import { confirmAction } from '../lib/confirm'
import { formatDay } from '../lib/format'
import {
  ALL_DAYS,
  dayLabel,
  describeDays,
  emptyRouteForm,
  formFromRoute,
  inputFromRouteForm,
  routeFormErrors,
  type RouteFormValues,
  type ZoneShape,
} from './routeForm'

const ROUTE_QUERIES = [['routes'], ['route-pins']]

export function RoutesPage() {
  const queryClient = useQueryClient()
  const routes = useQuery({ queryKey: ['routes'], queryFn: routesApi.list })
  const [editing, setEditing] = useState<DeliveryRoute | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = () => ROUTE_QUERIES.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }))
  const handlers = {
    onSuccess: () => {
      setError(null)
      refresh()
    },
    onError: (e: Error) => setError(e.message),
  }
  const toggle = useMutation({ mutationFn: (r: DeliveryRoute) => routesApi.setActive(r.id, !r.active), ...handlers })
  const remove = useMutation({ mutationFn: (r: DeliveryRoute) => routesApi.remove(r.id), ...handlers })
  const reassign = useMutation({
    mutationFn: routesApi.reassign,
    onSuccess: (result) => {
      setError(null)
      setNotice(`${result.assigned} shops are on a route; ${result.unassigned} are outside every route.`)
      refresh()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <>
      <PageHeader
        title="Delivery routes"
        subtitle="Draw each van's area on the map. Shops join the route around their map pin automatically."
        actions={
          editing === null && (
            <>
              <Button variant="secondary" busy={reassign.isPending} onClick={() => reassign.mutate()}>
                Reassign all shops
              </Button>
              <Button onClick={() => setEditing('new')}>+ Add route</Button>
            </>
          )
        }
      />
      {editing !== null && (
        <RouteForm
          key={editing === 'new' ? 'new' : editing.id}
          route={editing === 'new' ? null : editing}
          otherRoutes={(routes.data ?? []).filter((r) => editing === 'new' || r.id !== editing.id)}
          onDone={() => {
            setEditing(null)
            refresh()
          }}
        />
      )}
      <ErrorBanner message={error ?? routes.error?.message} />
      {notice && (
        <p role="status" className="mb-2 text-sm text-green-700">
          {notice}
        </p>
      )}

      <div className="card mt-2 overflow-x-auto">
        {routes.isPending ? (
          <div className="p-8 text-center">
            <Spinner />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Route</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Store</th>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3">Shops</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No routes yet.
                  </td>
                </tr>
              )}
              {routes.data?.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium">
                      <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color ?? '#94A3B8' }} />
                      {r.name}
                    </div>
                    {r.area && <div className="text-xs text-slate-500">{r.area}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div>{describeDays(r.days)}</div>
                    {r.active && r.nextDeliveryDate && <div className="text-xs text-slate-500">Next: {formatDay(r.nextDeliveryDate)}</div>}
                  </td>
                  <td className="px-4 py-3">{r.storeName ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.zone === null ? <Badge tone="amber">Not drawn</Badge> : r.zone.shape === 'CIRCLE' ? `${r.zone.radiusKm} km circle` : 'Drawn area'}
                  </td>
                  <td className="px-4 py-3">
                    <Link className="text-brand underline" to={`/customers?route=${r.id}`}>
                      {r.shopCount}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.active ? <Badge tone="green">Active</Badge> : <Badge tone="gray">Off</Badge>}</td>
                  <td className="space-x-1 px-4 py-3 text-right whitespace-nowrap">
                    <Button variant="secondary" onClick={() => setEditing(r)}>
                      Edit
                    </Button>
                    <Button variant="secondary" busy={toggle.isPending && toggle.variables?.id === r.id} onClick={() => toggle.mutate(r)}>
                      {r.active ? 'Turn off' : 'Turn on'}
                    </Button>
                    <Button
                      variant="danger"
                      busy={remove.isPending && remove.variables?.id === r.id}
                      onClick={() => confirmAction(`Delete route ${r.name}? Its shops will be placed again.`) && remove.mutate(r)}
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

function RouteForm({ route, otherRoutes, onDone }: { route: DeliveryRoute | null; otherRoutes: DeliveryRoute[]; onDone: () => void }) {
  const stores = useQuery({ queryKey: ['stores'], queryFn: storesApi.list })
  const pins = useQuery({ queryKey: ['route-pins'], queryFn: routesApi.shopPins })
  const [form, setForm] = useState<RouteFormValues>(route ? formFromRoute(route) : emptyRouteForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useMutation({
    mutationFn: () => {
      const body = inputFromRouteForm(form)
      return route ? routesApi.update(route.id, body) : routesApi.create(body)
    },
    onSuccess: onDone,
    onError: (e) => setErrors(e instanceof ApiError ? e.fieldErrors : {}),
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    const problems = routeFormErrors(form)
    setErrors(problems)
    if (Object.keys(problems).length === 0) save.mutate()
  }

  const update = (changes: Partial<RouteFormValues>) => setForm((f) => ({ ...f, ...changes }))
  const toggleDay = (day: DayCode) =>
    update({ days: form.days.includes(day) ? form.days.filter((d) => d !== day) : [...form.days, day] })
  const pick = (point: MapPoint) => {
    setForm((f) => {
      if (f.shape === 'POLYGON') return { ...f, points: [...f.points, point] }
      if (f.shape === 'CIRCLE') return { ...f, center: point }
      return f
    })
  }

  return (
    <form onSubmit={submit} className="card mb-4 space-y-4 p-5" noValidate>
      <h2 className="font-semibold">{route ? `Edit ${route.name}` : 'New route'}</h2>
      <ErrorBanner message={save.error && Object.keys(errors).length === 0 ? save.error.message : null} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Route name *" error={errors.name} hint="e.g. Warangal North">
          <input className="input" value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <Field label="Area note" error={errors.area} hint="e.g. Hanamkonda, Kazipet">
          <input className="input" value={form.area} onChange={(e) => update({ area: e.target.value })} />
        </Field>
        <Field label="Store" error={errors.storeId} hint={stores.data?.length === 0 ? 'Add your stores first under Stores' : 'Where the van leaves from'}>
          <select className="input" value={form.storeId} onChange={(e) => update({ storeId: e.target.value })}>
            <option value="">No store</option>
            {stores.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Colour" error={errors.color}>
            <input type="color" className="input h-[38px] p-1" value={form.color} onChange={(e) => update({ color: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Priority" error={errors.sortOrder} hint="Lower wins on overlap">
            <input className="input" type="number" min={0} value={form.sortOrder} onChange={(e) => update({ sortOrder: e.target.value })} />
          </Field>
        </div>
      </div>

      <fieldset>
        <legend className="label">Delivery days</legend>
        <div className="flex flex-wrap gap-2">
          {ALL_DAYS.map((day) => (
            <label
              key={day}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm ${
                form.days.includes(day) ? 'border-brand bg-brand text-white' : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              <input type="checkbox" className="sr-only" checked={form.days.includes(day)} onChange={() => toggleDay(day)} />
              {dayLabel(day)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-end gap-4">
        <Field label="Area shape">
          <select className="input" value={form.shape} onChange={(e) => update({ shape: e.target.value as ZoneShape })}>
            <option value="POLYGON">Draw shape</option>
            <option value="CIRCLE">Circle</option>
            <option value="NONE">No area yet</option>
          </select>
        </Field>
        {form.shape === 'CIRCLE' && (
          <Field label="Radius (km)" error={errors.radiusKm}>
            <input className="input w-28" type="number" min={0.1} step={0.5} value={form.radiusKm} onChange={(e) => update({ radiusKm: e.target.value })} />
          </Field>
        )}
        {form.shape === 'POLYGON' && (
          <>
            <Button variant="secondary" disabled={form.points.length === 0} onClick={() => update({ points: form.points.slice(0, -1) })}>
              Undo point
            </Button>
            <Button variant="ghost" disabled={form.points.length === 0} onClick={() => update({ points: [] })}>
              Clear area
            </Button>
          </>
        )}
      </div>

      {form.shape !== 'NONE' && (
        <div className="space-y-1">
          <RouteZoneMap form={form} otherRoutes={otherRoutes} pins={pins.data ?? []} onPick={pick} />
          <p className="text-xs text-slate-500">
            {form.shape === 'POLYGON' ? 'Tap the map to add each corner of the area.' : 'Tap the map to set the middle of the circle.'}{' '}
            Dots are shops; grey dots are on no route.
          </p>
        </div>
      )}
      {errors.zone && <p className="text-sm text-red-600">{errors.zone}</p>}

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => update({ active: e.target.checked })} />
        Active
      </label>
      <div className="flex gap-2">
        <Button type="submit" busy={save.isPending}>
          {route ? 'Save' : 'Add route'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
