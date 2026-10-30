/**
 * Fetch wrapper for the Spring Boot API.
 *
 * The access token lives only in memory. The refresh token is kept in localStorage so the
 * admin stays signed in across reloads; on a 401 the client swaps it for a new pair once
 * and retries. If that fails, listeners are told the session ended.
 */

const REFRESH_KEY = 'smart-retail-admin.refresh-token'

let accessToken: string | null = null
let refreshing: Promise<boolean> | null = null
const sessionEndedListeners = new Set<() => void>()

export class ApiError extends Error {
  readonly status: number
  /** Validation messages by field, from the backend's problem-detail "errors" map. */
  readonly fieldErrors: Record<string, string>

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

export interface Tokens {
  accessToken: string
  refreshToken: string
}

export function saveTokens(tokens: Tokens) {
  accessToken = tokens.accessToken
  try {
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken)
  } catch {
    // Private mode or blocked storage: the session simply won't survive a reload.
  }
}

export function storedRefreshToken(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY)
  } catch {
    return null
  }
}

export function clearTokens() {
  accessToken = null
  try {
    localStorage.removeItem(REFRESH_KEY)
  } catch {
    // Nothing stored.
  }
}

export function onSessionEnded(listener: () => void): () => void {
  sessionEndedListeners.add(listener)
  return () => sessionEndedListeners.delete(listener)
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  json?: unknown
  form?: FormData
  query?: Record<string, string | number | boolean | undefined | null>
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return parse<T>(await authorized(path, options))
}

/** Downloads a file that needs the admin's token, such as a private payment screenshot. */
export async function apiBlob(path: string): Promise<Blob> {
  const response = await authorized(path, {})
  if (!response.ok) await parse(response)
  return response.blob()
}

/** Sends the request; on 401 refreshes the tokens once and retries, or ends the session. */
async function authorized(path: string, options: RequestOptions): Promise<Response> {
  const response = await send(path, options)
  if (response.status !== 401 || path.startsWith('/api/auth/')) return response
  if (await refreshOnce()) return send(path, options)
  clearTokens()
  sessionEndedListeners.forEach((listener) => listener())
  return response
}

function send(path: string, { method = 'GET', json, form, query }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {}
  if (accessToken && !path.startsWith('/api/auth/')) headers.Authorization = `Bearer ${accessToken}`
  if (json !== undefined) headers['Content-Type'] = 'application/json'

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const url = params.size > 0 ? `${path}?${params}` : path

  return fetch(url, {
    method,
    headers,
    body: form ?? (json !== undefined ? JSON.stringify(json) : undefined),
  })
}

/** Exchanges the refresh token once, even when several requests fail with 401 at the same time. */
function refreshOnce(): Promise<boolean> {
  refreshing ??= (async () => {
    const refreshToken = storedRefreshToken()
    if (!refreshToken) return false
    try {
      const tokens = await parse<Tokens>(await send('/api/auth/refresh', { method: 'POST', json: { refreshToken } }))
      saveTokens(tokens)
      return true
    } catch {
      return false
    }
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T
  const body = await response.text()
  let data
  try {
    data = body ? JSON.parse(body) : undefined
  } catch {
    // Not JSON, e.g. the dev proxy's error page when the backend is down.
    data = undefined
  }
  if (!response.ok && response.status >= 500 && data === undefined) {
    throw new ApiError(response.status, 'Server is not responding. Is the backend running?')
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.detail ?? `Request failed (${response.status})`,
      data?.errors ?? {},
    )
  }
  return data as T
}
