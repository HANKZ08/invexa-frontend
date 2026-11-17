/** Reglas del carrito y totales de la caja. Puras: sin Vue ni red. El total final lo confirma el servidor. */

export const IGV_RATE = 0.18

export interface CartLine {
  productId: number
  sku: string
  name: string
  unitPrice: number
  stock: number
  quantity: number
}

export interface SellableProduct {
  id: number
  sku: string
  name: string
  sale_price: string
  stock: number
}

export interface CartResult {
  lines: CartLine[]
  error?: string
}

const cents = (value: number) => Math.round(value * 100) / 100

function stockError(name: string, stock: number): string {
  return `Stock insuficiente para «${name}»: hay ${stock}.`
}

export function addLine(lines: CartLine[], product: SellableProduct): CartResult {
  const existing = lines.find((l) => l.productId === product.id)
  const quantity = (existing?.quantity ?? 0) + 1
  if (quantity > product.stock) {
    return { lines, error: stockError(product.name, product.stock) }
  }
  if (existing) {
    return { lines: lines.map((l) => (l.productId === product.id ? { ...l, quantity } : l)) }
  }
  return {
    lines: [
      ...lines,
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        unitPrice: Number(product.sale_price),
        stock: product.stock,
        quantity: 1,
      },
    ],
  }
}

export function setQuantity(lines: CartLine[], productId: number, quantity: number): CartResult {
  if (quantity < 1) return { lines: removeLine(lines, productId) }
  const line = lines.find((l) => l.productId === productId)
  if (line && quantity > line.stock) {
    return { lines, error: stockError(line.name, line.stock) }
  }
  return { lines: lines.map((l) => (l.productId === productId ? { ...l, quantity } : l)) }
}

export function removeLine(lines: CartLine[], productId: number): CartLine[] {
  return lines.filter((l) => l.productId !== productId)
}

export interface Totals {
  subtotal: number
  discount: number
  taxable: number
  tax: number
  total: number
}

/** Estimado para mostrar mientras se arma la venta. El cobro usa los números del servidor. */
export function totals(lines: CartLine[], discount: number): Totals {
  const subtotal = cents(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0))
  const appliedDiscount = cents(Math.min(Math.max(discount, 0), subtotal))
  const taxable = cents(subtotal - appliedDiscount)
  const tax = cents(taxable * IGV_RATE)
  return { subtotal, discount: appliedDiscount, taxable, tax, total: cents(taxable + tax) }
}

/** Cambio a devolver, o null si el monto recibido no alcanza. */
export function change(total: number, received: number): number | null {
  const diff = cents(received - total)
  return diff < 0 ? null : diff
}
