import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { api, setAccessTokenProvider, unwrap } from './client'
import { ApiError } from './errors'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  setAccessTokenProvider(() => null)
})
afterAll(() => server.close())

describe('api client', () => {
  it('envía el token de acceso en la cabecera Authorization', async () => {
    let authorization: string | null = null
    server.use(
      http.get('*/api/auth/me/', ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json({ id: 1, username: 'cajero' })
      }),
    )
    setAccessTokenProvider(() => 'token-123')

    await api.GET('/api/auth/me/')

    expect(authorization).toBe('Bearer token-123')
  })

  it('no envía Authorization sin token', async () => {
    let authorization: string | null = 'sin llamar'
    server.use(
      http.get('*/api/auth/me/', ({ request }) => {
        authorization = request.headers.get('Authorization')
        return HttpResponse.json({ detail: 'No autenticado.' }, { status: 401 })
      }),
    )

    await api.GET('/api/auth/me/')

    expect(authorization).toBeNull()
  })
})

describe('unwrap', () => {
  it('devuelve los datos cuando la respuesta es correcta', async () => {
    server.use(http.get('*/api/auth/me/', () => HttpResponse.json({ id: 1, username: 'cajero' })))

    const me = await unwrap(api.GET('/api/auth/me/'))

    expect(me.username).toBe('cajero')
  })

  it('lanza ApiError con los errores de DRF', async () => {
    server.use(
      http.post('*/api/auth/token/', () =>
        HttpResponse.json({ detail: 'Credenciales inválidas.' }, { status: 401 }),
      ),
    )

    const promise = unwrap(api.POST('/api/auth/token/', { body: { username: 'x', password: 'y' } }))

    await expect(promise).rejects.toBeInstanceOf(ApiError)
    await expect(promise).rejects.toMatchObject({ status: 401, message: 'Credenciales inválidas.' })
  })

  it('lanza un error de red cuando no hay conexión', async () => {
    server.use(http.get('*/api/auth/me/', () => HttpResponse.error()))

    await expect(unwrap(api.GET('/api/auth/me/'))).rejects.toMatchObject({ status: 0 })
  })
})
