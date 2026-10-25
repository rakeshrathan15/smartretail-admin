import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeBackend } from '../test/fakeBackend'
import { api, ApiError, clearTokens, onSessionEnded, saveTokens, storedRefreshToken } from './client'

describe('api client', () => {
  beforeEach(() => saveTokens({ accessToken: 'expired', refreshToken: 'refresh-1' }))
  afterEach(() => {
    clearTokens()
    vi.unstubAllGlobals()
  })

  it('refreshes once on 401, retries, and keeps the new tokens', async () => {
    const calls = fakeBackend({
      'GET /api/admin/categories': ({ headers }) =>
        headers.Authorization === 'Bearer access-2' ? { status: 200, body: [] } : { status: 401 },
      'POST /api/auth/refresh': ({ body }) =>
        (body as { refreshToken: string }).refreshToken === 'refresh-1'
          ? { status: 200, body: { accessToken: 'access-2', refreshToken: 'refresh-2' } }
          : { status: 401 },
    })

    // Two requests fail at the same time, but only one refresh is sent.
    await Promise.all([api('/api/admin/categories'), api('/api/admin/categories')])

    expect(calls.filter((c) => c.path === '/api/auth/refresh')).toHaveLength(1)
    expect(storedRefreshToken()).toBe('refresh-2')
  })

  it('ends the session when the refresh token is rejected', async () => {
    fakeBackend({
      'GET /api/admin/categories': () => ({ status: 401 }),
      'POST /api/auth/refresh': () => ({ status: 401, body: { detail: 'Session expired' } }),
    })
    const ended = vi.fn()
    const unsubscribe = onSessionEnded(ended)

    await expect(api('/api/admin/categories')).rejects.toBeInstanceOf(ApiError)
    expect(ended).toHaveBeenCalledOnce()
    expect(storedRefreshToken()).toBeNull()
    unsubscribe()
  })

  it('reads the message and field errors of a problem detail', async () => {
    fakeBackend({
      'POST /api/admin/products': () => ({
        status: 400,
        body: { detail: 'Validation failed', errors: { price: 'must not be null' } },
      }),
    })
    const error = (await api('/api/admin/products', { method: 'POST', json: {} }).catch((e: unknown) => e)) as ApiError
    expect(error).toBeInstanceOf(ApiError)
    expect(error.message).toBe('Validation failed')
    expect(error.fieldErrors).toEqual({ price: 'must not be null' })
  })

  it('explains a missing backend instead of failing to parse', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })))
    await expect(api('/api/admin/categories')).rejects.toThrow('Server is not responding. Is the backend running?')
  })
})
