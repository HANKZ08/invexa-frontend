/** Pagos de una venta: reglas que la caja aplica antes de enviar (espejo de las del servidor). */

export type PaymentMethod =
  'cash' | 'card' | 'transfer' | 'yape' | 'plin' | 'tunki' | 'other_digital'

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; cash: boolean }[] = [
  { value: 'cash', label: 'Efectivo', cash: true },
  { value: 'yape', label: 'Yape', cash: false },
  { value: 'plin', label: 'Plin', cash: false },
  { value: 'tunki', label: 'Tunki', cash: false },
  { value: 'card', label: 'Tarjeta', cash: false },
  { value: 'transfer', label: 'Transferencia', cash: false },
  { value: 'other_digital', label: 'Otra billetera', cash: false },
]

export interface PaymentLine {
  id: number
  method: PaymentMethod
  amount: string
  reference: string
}

export interface PaymentCheck {
  valid: boolean
  /** Cuánto falta cubrir en efectivo (0 si ya está cubierto y no se deja deuda). */
  missing: number
  /** Cambio a devolver, solo si hay efectivo de sobra. */
  change: number
  /** Saldo que queda como deuda (solo si se permite dejar deuda). */
  debt: number
  error?: string
}

const cents = (value: number) => Math.round(value * 100) / 100

export function isCash(method: PaymentMethod): boolean {
  return method === 'cash'
}

export function evaluatePayments(
  total: number,
  lines: PaymentLine[],
  options: { allowDebt?: boolean } = {},
): PaymentCheck {
  if (!lines.length) return { valid: false, missing: total, change: 0, debt: 0 }

  let cash = 0
  let digital = 0
  for (const line of lines) {
    // Una línea recién agregada y sin monto todavía no es un error: solo falta llenarla.
    if (line.amount.trim() === '') continue
    const amount = Number(line.amount)
    if (Number.isNaN(amount) || amount <= 0) {
      return {
        valid: false,
        missing: 0,
        change: 0,
        debt: 0,
        error: 'Cada pago debe ser mayor a cero.',
      }
    }
    if (isCash(line.method)) {
      cash += amount
    } else {
      if (!line.reference.trim()) {
        return {
          valid: false,
          missing: 0,
          change: 0,
          debt: 0,
          error: 'Escribe el número de operación del pago digital.',
        }
      }
      digital += amount
    }
  }

  if (cents(digital) > cents(total)) {
    return {
      valid: false,
      missing: 0,
      change: 0,
      debt: 0,
      error: 'Los pagos digitales superan el total de la venta.',
    }
  }

  const cashNeeded = cents(total - digital)
  if (cash < cashNeeded) {
    const missing = cents(cashNeeded - cash)
    if (options.allowDebt) return { valid: true, missing: 0, change: 0, debt: missing }
    return { valid: false, missing, change: 0, debt: 0 }
  }
  return { valid: true, missing: 0, change: cents(cash + digital - total), debt: 0 }
}
