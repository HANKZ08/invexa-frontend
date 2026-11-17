/** Normaliza las respuestas de error de Django REST Framework. */

export type FieldErrors = Record<string, string[]>

const DEFAULT_MESSAGES: Record<number, string> = {
  400: 'Revisa los campos marcados.',
  401: 'Tu sesión terminó. Inicia sesión de nuevo.',
  403: 'No tienes permiso para realizar esta acción.',
  404: 'No encontramos lo que buscabas.',
  429: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
}
const SERVER_ERROR = 'Ocurrió un error en el servidor. Inténtalo de nuevo.'
const NETWORK_ERROR = 'No se pudo conectar con el servidor. Revisa tu conexión.'
const GENERAL_KEYS = new Set(['detail', 'non_field_errors'])

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.fieldErrors = fieldErrors
  }

  /** Primer mensaje del campo, para mostrarlo junto al input. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0]
  }
}

function defaultMessage(status: number): string {
  return (
    DEFAULT_MESSAGES[status] ??
    (status >= 500 ? SERVER_ERROR : 'Algo salió mal. Inténtalo de nuevo.')
  )
}

function messagesOf(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value
  return []
}

/** Recorre el cuerpo de DRF y junta los errores por ruta (`items.0.quantity`). */
function collectFieldErrors(value: unknown, path: string, into: FieldErrors): void {
  const messages = messagesOf(value)
  if (messages.length) {
    into[path] = messages
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectFieldErrors(item, `${path}.${index}`, into))
  } else if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      collectFieldErrors(nested, path ? `${path}.${key}` : key, into)
    }
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  const general = messagesOf(body)
  if (general.length) return new ApiError(status, general.join(' '))

  const fieldErrors: FieldErrors = {}
  let message: string | undefined

  if (body && typeof body === 'object') {
    for (const [key, value] of Object.entries(body)) {
      if (GENERAL_KEYS.has(key)) {
        message ??= messagesOf(value).join(' ') || undefined
      } else {
        collectFieldErrors(value, key, fieldErrors)
      }
    }
  }

  return new ApiError(status, message ?? defaultMessage(status), fieldErrors)
}

export function networkError(): ApiError {
  return new ApiError(0, NETWORK_ERROR)
}
