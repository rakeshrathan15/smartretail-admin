import type { DayCode, DeliveryRoute, MapPoint, RouteInput, Zone } from '../api/delivery'

export const ALL_DAYS: DayCode[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

const DAY_LABELS: Record<DayCode, string> = {
  MON: 'Mon',
  TUE: 'Tue',
  WED: 'Wed',
  THU: 'Thu',
  FRI: 'Fri',
  SAT: 'Sat',
  SUN: 'Sun',
}

export const dayLabel = (day: DayCode) => DAY_LABELS[day]

export function describeDays(days: DayCode[]): string {
  if (days.length === 0) return 'No days set'
  if (days.length === 7) return 'Every day'
  return ALL_DAYS.filter((d) => days.includes(d)).map(dayLabel).join(', ')
}

export type ZoneShape = 'NONE' | 'POLYGON' | 'CIRCLE'

export const DEFAULT_ROUTE_COLOR = '#2563EB'
const MIN_RADIUS_KM = 0.1
const MAX_RADIUS_KM = 100
export const MIN_POLYGON_POINTS = 3
const MAX_POLYGON_POINTS = 200

export interface RouteFormValues {
  name: string
  area: string
  days: DayCode[]
  storeId: string
  color: string
  sortOrder: string
  active: boolean
  shape: ZoneShape
  points: MapPoint[]
  center: MapPoint | null
  radiusKm: string
}

export const emptyRouteForm: RouteFormValues = {
  name: '',
  area: '',
  days: [],
  storeId: '',
  color: DEFAULT_ROUTE_COLOR,
  sortOrder: '0',
  active: true,
  shape: 'POLYGON',
  points: [],
  center: null,
  radiusKm: '5',
}

export function formFromRoute(route: DeliveryRoute): RouteFormValues {
  const zone = route.zone
  return {
    name: route.name,
    area: route.area ?? '',
    days: route.days,
    storeId: route.storeId ?? '',
    color: route.color ?? DEFAULT_ROUTE_COLOR,
    sortOrder: String(route.sortOrder),
    active: route.active,
    shape: zone?.shape ?? 'NONE',
    points: zone?.shape === 'POLYGON' ? zone.points : [],
    center: zone?.shape === 'CIRCLE' ? zone.center : null,
    radiusKm: zone?.shape === 'CIRCLE' ? String(zone.radiusKm) : '5',
  }
}

/** Only the shape picked counts, so switching shapes and back does not lose the drawing. */
function zoneFromForm(form: RouteFormValues): Zone | null {
  if (form.shape === 'POLYGON' && form.points.length > 0) return { shape: 'POLYGON', points: form.points }
  if (form.shape === 'CIRCLE' && form.center) {
    return { shape: 'CIRCLE', center: form.center, radiusKm: Number(form.radiusKm) }
  }
  return null
}

export function inputFromRouteForm(form: RouteFormValues): RouteInput {
  return {
    name: form.name.trim(),
    area: form.area.trim() || null,
    days: ALL_DAYS.filter((d) => form.days.includes(d)),
    storeId: form.storeId || null,
    color: form.color || null,
    zone: zoneFromForm(form),
    sortOrder: Number(form.sortOrder),
    active: form.active,
  }
}

/** The same rules as the backend's RouteRequest and DeliveryZone. */
export function routeFormErrors(form: RouteFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Enter the route name'
  const order = Number(form.sortOrder)
  if (form.sortOrder.trim() === '' || !Number.isInteger(order) || order < 0 || order > 9999) {
    errors.sortOrder = 'Enter a whole number from 0 to 9999'
  }
  if (form.shape === 'POLYGON' && form.points.length > 0 && form.points.length < MIN_POLYGON_POINTS) {
    errors.zone = `An area needs at least ${MIN_POLYGON_POINTS} points. Tap the map to add more.`
  }
  if (form.shape === 'POLYGON' && form.points.length > MAX_POLYGON_POINTS) {
    errors.zone = `An area can have at most ${MAX_POLYGON_POINTS} points`
  }
  if (form.shape === 'CIRCLE') {
    const radius = Number(form.radiusKm)
    if (form.radiusKm.trim() === '' || !(radius >= MIN_RADIUS_KM && radius <= MAX_RADIUS_KM)) {
      errors.radiusKm = `Enter ${MIN_RADIUS_KM} to ${MAX_RADIUS_KM} km`
    }
  }
  return errors
}
