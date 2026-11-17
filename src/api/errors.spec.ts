import { describe, expect, it } from 'vitest'

import { ApiError, networkError, toApiError } from './errors'

describe('toApiError', () => {
  it('separa los errores por campo de un 400 de DRF', () => {
    const error = toApiError(400, {
      sale_price: ['El precio de venta no puede ser menor al costo.'],
      sku: ['Ya existe producto con este SKU.'],
    })

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({
      sale_price: ['El precio de venta no puede ser menor al costo.'],
      sku: ['Ya existe producto con este SKU.'],
    })
    expect(error.message).toBe('Revisa los campos marcados.')
  })

  it('usa non_field_errors y detail como mensaje general', () => {
    expect(toApiError(400, { non_field_errors: ['Datos incompletos.'] }).message).toBe(
      'Datos incompletos.',
    )
    expect(toApiError(401, { detail: 'Credenciales inválidas.' }).message).toBe(
      'Credenciales inválidas.',
    )
  })

  it('acepta una lista de mensajes como cuerpo', () => {
    const error = toApiError(400, ['La venta ya está anulada.'])
    expect(error.message).toBe('La venta ya está anulada.')
    expect(error.fieldErrors).toEqual({})
  })

  it('aplana errores anidados con rutas de punto', () => {
    const error = toApiError(400, { items: [{ quantity: ['Debe ser mayor a cero.'] }, {}] })
    expect(error.fieldErrors).toEqual({ 'items.0.quantity': ['Debe ser mayor a cero.'] })
  })

  it('convierte mensajes sueltos de un campo en lista', () => {
    const error = toApiError(400, { code: 'Código inválido o vencido. Solicita uno nuevo.' })
    expect(error.fieldErrors).toEqual({ code: ['Código inválido o vencido. Solicita uno nuevo.'] })
  })

  it.each([
    [403, 'No tienes permiso para realizar esta acción.'],
    [404, 'No encontramos lo que buscabas.'],
    [429, 'Demasiados intentos. Espera un momento e inténtalo de nuevo.'],
    [500, 'Ocurrió un error en el servidor. Inténtalo de nuevo.'],
  ])('da un mensaje por defecto para el estado %i sin cuerpo', (status, message) => {
    expect(toApiError(status, null).message).toBe(message)
  })

  it('prefiere el detail del servidor al mensaje por defecto', () => {
    const error = toApiError(429, { detail: 'Solicitud fue regulada. Disponible en 42 segundos.' })
    expect(error.message).toBe('Solicitud fue regulada. Disponible en 42 segundos.')
  })
})

describe('networkError', () => {
  it('explica que no hay conexión', () => {
    const error = networkError()
    expect(error.status).toBe(0)
    expect(error.message).toBe('No se pudo conectar con el servidor. Revisa tu conexión.')
  })
})
