import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'

import { useSessionStore } from '../session'

const ME = {
  id: 2,
  username: 'cajero',
  first_name: 'Luis',
  last_name: 'Ramírez',
  role: 'cashier',
}

const server = setupServer()
let refreshCalls = 0

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  refreshCalls = 0
})
afterEach(() => server.resetHandlers())

function loginHandler() {
  server.use(
    http.post('*/api/auth/token/', async ({ request }) => {
      const body = (await request.json()) as { username: string; password: string }
      if (body.password !== 'Invexa2026!') {
        return HttpResponse.json({ detail: 'Credenciales inválidas.' }, { status: 401 })
      }
      return HttpResponse.json({ access: 'access-1', refresh: 'refresh-1' })
    }),
    http.get('*/api/auth/me/', ({ request }) => {
      if (request.headers.get('Authorization') !== 'Bearer access-1') {
        return HttpResponse.json({ detail: 'Token inválido.' }, { status: 401 })
      }
      return HttpResponse.json(ME)
    }),
  )
}

describe('login', () => {
  it('guarda el usuario con su rol y los tokens', async () => {
    loginHandler()
    const session = useSessionStore()
    await session.login('cajero', 'Invexa2026!')

    expect(session.isAuthenticated).toBe(true)
    expect(session.user).toEqual({
      id: 2,
      username: 'cajero',
      fullName: 'Luis Ramírez',
      role: 'cashier',
      avatarUrl: null,
    })
    // El refresh queda en localStorage; el access solo en memoria.
    expect(localStorage.getItem('invexa.refresh')).toBe('refresh-1')
    expect(localStorage.getItem('invexa.access')).toBeNull()
  })

  it('rechaza credenciales inválidas sin guardar sesión', async () => {
    loginHandler()
    const session = useSessionStore()
    await expect(session.login('cajero', 'mal')).rejects.toMatchObject({
      status: 401,
      message: 'Credenciales inválidas.',
    })
    expect(session.isAuthenticated).toBe(false)
  })
})

describe('restaurar sesión', () => {
  it('recupera la sesión desde el refresh guardado al recargar', async () => {
    loginHandler()
    localStorage.setItem('invexa.refresh', 'refresh-1')
    server.use(
      http.post('*/api/auth/token/refresh/', () => {
        refreshCalls++
        return HttpResponse.json({ access: 'access-1' })
      }),
    )
    const session = useSessionStore()
    await session.restore()

    expect(refreshCalls).toBe(1)
    expect(session.user?.username).toBe('cajero')
  })

  it('sin refresh guardado no hace peticiones', async () => {
    const session = useSessionStore()
    await session.restore()
    expect(session.isAuthenticated).toBe(false)
  })
})

describe('refresh compartido', () => {
  it('varias peticiones con 401 disparan un solo refresh', async () => {
    loginHandler()
    const session = useSessionStore()
    await session.login('cajero', 'Invexa2026!')

    // El access vence: el servidor responde 401 a las peticiones protegidas.
    let protectedCalls = 0
    server.use(
      http.get('*/api/products/', ({ request }) => {
        protectedCalls++
        if (request.headers.get('Authorization') === 'Bearer access-2') {
          return HttpResponse.json({ results: [] })
        }
        return HttpResponse.json({ detail: 'expirado' }, { status: 401 })
      }),
      http.post('*/api/auth/token/refresh/', async () => {
        refreshCalls++
        await new Promise((r) => setTimeout(r, 20))
        return HttpResponse.json({ access: 'access-2' })
      }),
    )

    const { api, unwrap } = await import('@/api/client')
    session.bindApiClient()
    await Promise.all([
      unwrap(api.GET('/api/products/')),
      unwrap(api.GET('/api/products/')),
      unwrap(api.GET('/api/products/')),
    ])

    expect(refreshCalls).toBe(1)
    expect(protectedCalls).toBe(6) // 3 fallidas + 3 reintentadas
  })
})

describe('logout', () => {
  it('borra usuario, tokens y el refresh guardado', async () => {
    loginHandler()
    const session = useSessionStore()
    await session.login('cajero', 'Invexa2026!')
    session.logout()

    expect(session.isAuthenticated).toBe(false)
    expect(localStorage.getItem('invexa.refresh')).toBeNull()
  })
})
