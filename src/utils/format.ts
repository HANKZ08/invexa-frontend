/** Formateo para Perú: soles (PEN), separadores es-PE y hora de Lima. */

export const LOCALE = 'es-PE'
export const TIME_ZONE = 'America/Lima'
const EMPTY = '—'

const money = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'PEN' })
const number = new Intl.NumberFormat(LOCALE)
const dateTime = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
})
const date = new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeZone: TIME_ZONE })

type Numeric = string | number | null | undefined

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** `'1234.5'` → `S/ 1,234.50`. La API envía los montos como strings decimales. */
export function formatMoney(value: Numeric): string {
  const parsed = toNumber(value)
  return parsed === null ? EMPTY : money.format(parsed)
}

export function formatNumber(value: Numeric): string {
  const parsed = toNumber(value)
  return parsed === null ? EMPTY : number.format(parsed)
}

/** Fecha y hora en America/Lima, por ejemplo `16/11/26, 12:30 p. m.`. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const parsed = toDate(value)
  return parsed ? dateTime.format(parsed) : EMPTY
}

/** Solo la fecha en America/Lima, por ejemplo `15 nov. 2026`. */
export function formatDate(value: string | Date | null | undefined): string {
  const parsed = toDate(value)
  return parsed ? date.format(parsed) : EMPTY
}
