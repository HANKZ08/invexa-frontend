import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime, formatMoney, formatNumber } from './format'

// Intl usa espacio duro (U+00A0) entre el símbolo y el monto; se normaliza para comparar.
const plain = (text: string) => text.replace(/ | /g, ' ')

describe('formatMoney', () => {
  it('formatea strings decimales de la API en soles', () => {
    expect(plain(formatMoney('1234.5'))).toBe('S/ 1,234.50')
  })

  it('acepta números y negativos', () => {
    expect(plain(formatMoney(0))).toBe('S/ 0.00')
    expect(plain(formatMoney('-3'))).toBe('-S/ 3.00')
  })

  it('devuelve un guion para valores vacíos o inválidos', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney('abc')).toBe('—')
  })
})

describe('formatNumber', () => {
  it('separa miles', () => {
    expect(formatNumber(12500)).toBe('12,500')
  })
})

describe('fechas en hora de Lima', () => {
  it('convierte UTC a America/Lima', () => {
    // 17:30 UTC = 12:30 en Lima (UTC-5)
    expect(plain(formatDateTime('2026-11-16T17:30:00Z'))).toBe('16/11/26, 12:30 p. m.')
  })

  it('usa el día de Lima, no el de UTC', () => {
    // 03:00 UTC del 16 = 22:00 del 15 en Lima
    expect(plain(formatDate('2026-11-16T03:00:00Z'))).toBe('15 nov. 2026')
  })

  it('devuelve un guion sin fecha', () => {
    expect(formatDateTime(null)).toBe('—')
  })
})
