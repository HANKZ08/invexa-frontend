import { describe, expect, it } from 'vitest'

import {
  addLine,
  change,
  IGV_RATE,
  removeLine,
  setQuantity,
  totals,
  type CartLine,
  type CartResult,
} from '../cart'

const pintura = { id: 1, sku: 'PIN-001', name: 'Pintura látex', sale_price: '49.90', stock: 41 }
const cable = { id: 2, sku: 'ELE-002', name: 'Cable THW', sale_price: '2.00', stock: 5 }

describe('addLine', () => {
  it('agrega una unidad de un producto nuevo', () => {
    const { lines, error } = addLine([], pintura)
    expect(error).toBeUndefined()
    expect(lines).toEqual<CartLine[]>([
      {
        productId: 1,
        sku: 'PIN-001',
        name: 'Pintura látex',
        unitPrice: 49.9,
        stock: 41,
        quantity: 1,
      },
    ])
  })

  it('si el producto ya está, suma una unidad a la línea existente', () => {
    const first = addLine([], pintura).lines
    const { lines } = addLine(first, pintura)
    expect(lines).toHaveLength(1)
    expect(lines[0]!.quantity).toBe(2)
  })

  it('no agrega más unidades que el stock disponible', () => {
    const lines = addLine([], cable).lines
    let result: CartResult = { lines }
    for (let i = 0; i < 5; i++) result = addLine(result.lines, cable)
    expect(result.lines[0]!.quantity).toBe(5)
    expect(result.error).toContain('Stock insuficiente')
  })
})

describe('setQuantity y removeLine', () => {
  it('cambia la cantidad dentro del stock', () => {
    const lines = addLine([], pintura).lines
    expect(setQuantity(lines, 1, 3).lines[0]!.quantity).toBe(3)
  })

  it('rechaza una cantidad mayor al stock sin cambiar la línea', () => {
    const lines = addLine([], cable).lines
    const result = setQuantity(lines, 2, 9)
    expect(result.error).toContain('Stock insuficiente')
    expect(result.lines[0]!.quantity).toBe(1)
  })

  it('una cantidad menor a 1 quita la línea', () => {
    const lines = addLine([], pintura).lines
    expect(setQuantity(lines, 1, 0).lines).toEqual([])
  })

  it('quita un producto del carrito', () => {
    const lines = addLine(addLine([], pintura).lines, cable).lines
    expect(removeLine(lines, 1).map((l) => l.productId)).toEqual([2])
  })
})

describe('totals', () => {
  it('calcula subtotal, descuento, IGV del 18 % y total con centavos exactos', () => {
    const lines = setQuantity(addLine([], pintura).lines, 1, 3).lines // 3 × 49.90
    expect(totals(lines, 0)).toEqual({
      subtotal: 149.7,
      discount: 0,
      taxable: 149.7,
      tax: 26.95,
      total: 176.65,
    })
    expect(IGV_RATE).toBe(0.18)
  })

  it('aplica el descuento antes del IGV', () => {
    const lines = setQuantity(addLine([], pintura).lines, 1, 2).lines // 99.80
    const t = totals(lines, 10)
    expect(t.taxable).toBe(89.8)
    expect(t.tax).toBe(16.16)
    expect(t.total).toBe(105.96)
  })

  it('un descuento mayor al subtotal se limita al subtotal', () => {
    const lines = addLine([], cable).lines
    expect(totals(lines, 50).discount).toBe(2)
  })
})

describe('change', () => {
  it('calcula el cambio en efectivo', () => {
    expect(change(20.5, 50)).toBe(29.5)
  })

  it('sin monto suficiente devuelve null (no se puede cobrar)', () => {
    expect(change(20.5, 15)).toBeNull()
  })
})
