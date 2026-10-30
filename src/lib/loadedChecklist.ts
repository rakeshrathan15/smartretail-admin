import { useCallback, useState } from 'react'

/** Ticks only help whoever is loading the van, so they stay in this browser. */
const keyFor = (route: string, date: string) => `pick-list-loaded:${route}:${date}`

function read(key: string): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return new Set(Array.isArray(stored) ? stored.filter((v): v is string => typeof v === 'string') : [])
  } catch {
    return new Set()
  }
}

function write(key: string, values: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...values]))
  } catch {
    // Storage can be blocked; the ticks then last until the page is closed.
  }
}

/** Which pick-list lines are loaded, remembered per route and date. */
export function useLoadedChecklist(route: string, date: string) {
  const key = keyFor(route, date)
  const [state, setState] = useState(() => ({ key, loaded: read(key) }))
  // A different route or date starts from what was remembered for that one.
  const loaded = state.key === key ? state.loaded : read(key)

  const toggle = useCallback(
    (item: string) => {
      const next = new Set(loaded)
      if (next.has(item)) next.delete(item)
      else next.add(item)
      write(key, next)
      setState({ key, loaded: next })
    },
    [key, loaded],
  )
  return { loaded, toggle }
}
