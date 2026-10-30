import 'leaflet/dist/leaflet.css'
import { Circle, CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMapEvents } from 'react-leaflet'
import type { DeliveryRoute, MapPoint, ShopPin } from '../api/delivery'
import { DEFAULT_ROUTE_COLOR, type RouteFormValues } from '../pages/routeForm'

/** Hyderabad, used until a route has an area. */
const DEFAULT_CENTER: MapPoint = { lat: 17.385, lng: 78.4867 }
const UNASSIGNED_COLOR = '#94A3B8'

function centerOf(form: RouteFormValues): MapPoint {
  if (form.shape === 'CIRCLE' && form.center) return form.center
  if (form.points.length === 0) return DEFAULT_CENTER
  return {
    lat: form.points.reduce((sum, p) => sum + p.lat, 0) / form.points.length,
    lng: form.points.reduce((sum, p) => sum + p.lng, 0) / form.points.length,
  }
}

const isDrawn = (form: RouteFormValues) => form.points.length > 0 || form.center !== null

/**
 * OpenStreetMap for drawing a route's area. Tapping adds a corner, or sets the circle's centre.
 * Other routes and every shop pin are shown for reference, so areas can be drawn around real shops.
 */
export function RouteZoneMap({
  form,
  otherRoutes,
  pins,
  onPick,
}: {
  form: RouteFormValues
  otherRoutes: DeliveryRoute[]
  pins: ShopPin[]
  onPick: (point: MapPoint) => void
}) {
  const color = form.color || DEFAULT_ROUTE_COLOR
  const colorOf = (routeId: string | null) =>
    routeId === null ? UNASSIGNED_COLOR : (otherRoutes.find((r) => r.id === routeId)?.color ?? color)

  return (
    // `isolate` keeps Leaflet's high z-index layers inside this box.
    <div className="isolate h-96 overflow-hidden rounded-lg ring-1 ring-slate-300">
      <MapContainer center={centerOf(form)} zoom={isDrawn(form) ? 13 : 11} className="h-full w-full" scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <TapToDraw onPick={onPick} />

        {otherRoutes.map((route) => {
          const style = { color: route.color ?? UNASSIGNED_COLOR, weight: 1, fillOpacity: 0.08 }
          if (route.zone?.shape === 'POLYGON') return <Polygon key={route.id} positions={route.zone.points} pathOptions={style} />
          if (route.zone?.shape === 'CIRCLE') {
            return <Circle key={route.id} center={route.zone.center} radius={route.zone.radiusKm * 1000} pathOptions={style} />
          }
          return null
        })}

        {form.shape === 'POLYGON' && form.points.length >= 3 && (
          <Polygon positions={form.points} pathOptions={{ color, weight: 2, fillOpacity: 0.2 }} />
        )}
        {form.shape === 'POLYGON' && form.points.length === 2 && <Polyline positions={form.points} pathOptions={{ color, weight: 2 }} />}
        {form.shape === 'POLYGON' &&
          form.points.map((point, index) => (
            <CircleMarker key={index} center={point} radius={5} pathOptions={{ color: 'white', weight: 2, fillColor: color, fillOpacity: 1 }} />
          ))}
        {form.shape === 'CIRCLE' && form.center && Number(form.radiusKm) > 0 && (
          <Circle center={form.center} radius={Number(form.radiusKm) * 1000} pathOptions={{ color, weight: 2, fillOpacity: 0.2 }} />
        )}

        {pins.map((pin) => (
          <CircleMarker
            key={pin.userId}
            center={pin}
            radius={4}
            pathOptions={{ color: '#0F172A', weight: 1, fillColor: colorOf(pin.routeId), fillOpacity: 1 }}
            bubblingMouseEvents
          >
            <Tooltip>{pin.shopName}</Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  )
}

function TapToDraw({ onPick }: { onPick: (point: MapPoint) => void }) {
  useMapEvents({ click: (event) => onPick({ lat: round(event.latlng.lat), lng: round(event.latlng.lng) }) })
  return null
}

const round = (value: number) => Math.round(value * 1e6) / 1e6
