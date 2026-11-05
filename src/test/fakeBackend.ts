import { vi } from 'vitest'

/** Puts a route's result in the backend's response shape: `data` on success, `error` on failure. */
function envelope({ status, body }: { status: number; body?: unknown }) {
  if (body === undefined) return null
  return JSON.stringify(status < 400 ? { success: true, data: body } : { success: false, error: body })
}

export type Handler = (request: { url: URL; method: string; body: unknown; headers: Record<string, string> }) => {
  status: number
  body?: unknown
}

/** Replaces fetch with routes like "GET /api/me". Unknown routes answer 404. Returns the call log. */
export function fakeBackend(routes: Record<string, Handler>) {
  const calls: { method: string; path: string; url: string; auth?: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const url = new URL(input, 'http://admin.test')
      const method = init.method ?? 'GET'
      const headers = (init.headers ?? {}) as Record<string, string>
      calls.push({ method, path: url.pathname, url: url.toString(), auth: headers.Authorization })
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body
      const handler = routes[`${method} ${url.pathname}`]
      const result = handler ? handler({ url, method, body, headers }) : { status: 404, body: { message: 'Not found' } }
      return new Response(envelope(result), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )
  return calls
}

export const adminUser = {
  id: 'u1',
  email: 'admin@smartretail.local',
  phone: null,
  fullName: 'Administrator',
  roles: ['ADMIN'],
  shopProfileComplete: false,
}

export function authBody(roles = ['ADMIN'], access = 'access-1', refresh = 'refresh-1') {
  return { accessToken: access, refreshToken: refresh, tokenType: 'Bearer', expiresIn: 900, user: { ...adminUser, roles } }
}
