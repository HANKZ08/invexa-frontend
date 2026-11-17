import { describe, expect, it } from 'vitest'

import { evaluatePayments, type PaymentLine } from '../payments'

const line = (over: Partial<PaymentLine>): PaymentLine => ({
  id: 1,
  method: 'cash',
  amount: '',
  reference: '',
  ...over,
})

describe('evaluatePayments', () => {
  it('sin pagos falta todo el total', () => {
    const r = evaluatePayments(11.8, [])
    expect(r.valid).toBe(false)
    expect(r.missing).toBe(11.8)
  })

  it('efectivo exacto es válido y sin cambio', () => {
    const r = evaluatePayments(11.8, [line({ amount: '11.80' })])
    expect(r.valid).toBe(true)
    expect(r.change).toBe(0)
  })

  it('Yape + efectivo: el cambio sale solo del efectivo', () => {
    const r = evaluatePayments(11.8, [
      line({ id: 1, method: 'yape', amount: '5', reference: 'OP-778812' }),
      line({ id: 2, method: 'cash', amount: '10' }),
    ])
    expect(r.valid).toBe(true)
    expect(r.change).toBe(3.2)
  })

  it('un pago digital sin número de operación no es válido', () => {
    const r = evaluatePayments(11.8, [line({ method: 'plin', amount: '11.80', reference: '' })])
    expect(r.valid).toBe(false)
    expect(r.error).toContain('número de operación')
  })

  it('los pagos digitales no pueden superar el total', () => {
    const r = evaluatePayments(11.8, [line({ method: 'tunki', amount: '50', reference: 'T1' })])
    expect(r.valid).toBe(false)
    expect(r.error).toContain('superan el total')
  })

  it('falta efectivo para cubrir el resto y lo indica', () => {
    const r = evaluatePayments(11.8, [
      line({ method: 'yape', amount: '5', reference: 'OP-1' }),
      line({ id: 2, method: 'cash', amount: '2' }),
    ])
    expect(r.valid).toBe(false)
    expect(r.missing).toBe(4.8)
  })

  it('un monto vacío o cero es inválido', () => {
    expect(evaluatePayments(11.8, [line({ amount: '0' })]).valid).toBe(false)
    expect(evaluatePayments(11.8, [line({ amount: '' })]).valid).toBe(false)
  })
  it('con permiso de deuda, lo que falta queda como saldo pendiente', () => {
    const r = evaluatePayments(
      11.8,
      [
        line({ method: 'yape', amount: '5', reference: 'OP-1' }),
        line({ id: 2, method: 'cash', amount: '2' }),
      ],
      { allowDebt: true },
    )
    expect(r.valid).toBe(true)
    expect(r.debt).toBe(4.8)
  })
})
