/** Cliente HTTP tipado a partir del esquema OpenAPI del backend. */

import createClient, { type Middleware } from 'openapi-fetch'

import { API_URL } from '@/config'

import { networkError, toApiError } from './errors'
import type { paths } from './schema'

type TokenProvider = () => string | null
/** Renueva el token de acceso. Devuelve true si se pudo; el store lo registra. */
type UnauthorizedHandler = () => Promise<boolean>

let getAccessToken: TokenProvider = () => null
let onUnauthorized: UnauthorizedHandler | null = null

/** El store de sesión registra cómo obtener el token de acceso vigente. */
export function setAccessTokenProvider(provider: TokenProvider): void {
  getAccessToken = provider
}

/** El store registra cómo renovar el token ante un 401. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  onUnauthorized = handler
}

/** Login y renovación no se reintentan: un 401 ahí significa credenciales inválidas. */
const NO_RETRY = ['/api/auth/token/']

function skipsRetry(url: string): boolean {
  return NO_RETRY.some((path) => new URL(url).pathname.endsWith(path))
}

function withToken(headers: Headers): Headers {
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return headers
}

/**
 * fetch del cliente: si la API responde 401 renueva el token una sola vez
 * (el store comparte la misma renovación entre peticiones) y reintenta.
 */
async function fetchWithRetry(request: Request): Promise<Response> {
  const copy = request.clone()
  const response = await globalThis.fetch(request)
  if (response.status !== 401 || !onUnauthorized || skipsRetry(request.url)) {
    return response
  }
  const renewed = await onUnauthorized()
  if (!renewed) return response
  return globalThis.fetch(new Request(copy, { headers: withToken(new Headers(copy.headers)) }))
}

const authMiddleware: Middleware = {
  onRequest({ request }) {
    withToken(request.headers)
    return request
  },
}

export const api = createClient<paths>({
  baseUrl: API_URL || globalThis.location?.origin,
  // Se resuelve `fetch` en cada llamada (no al importar) para respetar mocks y polyfills.
  fetch: (request) => fetchWithRetry(request),
})
api.use(authMiddleware)

type FetchResult<T> = { data?: T; error?: unknown; response: Response }

/** Devuelve los datos o lanza `ApiError` con los mensajes de DRF normalizados. */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>
  try {
    result = await request
  } catch {
    throw networkError()
  }
  if (result.error !== undefined || !result.response.ok) {
    throw toApiError(result.response.status, result.error ?? null)
  }
  return result.data as T
}

/** Petición autenticada que devuelve la respuesta cruda (por ejemplo, un PDF). */
export function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const token = getAccessToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return globalThis.fetch(`${API_URL}${path}`, { ...init, headers })
}
