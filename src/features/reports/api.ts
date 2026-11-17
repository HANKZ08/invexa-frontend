/** Dashboard y exportaciones a Excel. */
import { api, authorizedFetch, unwrap } from '@/api/client'

export type Period = 'today' | '7' | '30'

export interface DateRange {
  date_from: string
  date_to: string
}

const LIMA = 'America/Lima'

/** Fecha de un instante en hora de Lima, como YYYY-MM-DD. */
export function limaDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LIMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

function shiftDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const shifted = new Date(Date.UTC(y!, m! - 1, d! + days))
  return shifted.toISOString().slice(0, 10)
}

/** Rango de un periodo rápido, terminando hoy (hora de Lima). */
export function periodRange(period: Period, now: Date = new Date()): DateRange {
  const today = limaDate(now)
  if (period === 'today') return { date_from: today, date_to: today }
  const days = period === '7' ? 6 : 29
  return { date_from: shiftDays(today, -days), date_to: today }
}

export function buildDashboardQuery(range: DateRange): Record<string, string> {
  return { date_from: range.date_from, date_to: range.date_to }
}

export interface Dashboard {
  date_from: string
  date_to: string
  summary: {
    sales_count: number
    revenue: string
    tax: string
    discounts: string
    units_sold: number
    gross_profit: string
    average_ticket: string
    cancelled_count: number
  }
  inventory: { products_count: number; inventory_cost: string; low_stock_count: number }
  sales_by_day: { day: string; sales_count: number; revenue: string }[]
  sales_by_payment_method: {
    payment_method: string
    payment_method_display: string
    sales_count: number
    revenue: string
  }[]
  top_products: {
    product_id: number
    product_sku: string
    product_name: string
    units_sold: number
    revenue: string
  }[]
}

export function fetchDashboard(range: DateRange) {
  return unwrap(
    api.GET('/api/reports/dashboard/', { params: { query: buildDashboardQuery(range) } }),
  ) as Promise<Dashboard>
}

/** Descarga un archivo de la API con el token del usuario. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await authorizedFetch(path)
  if (!response.ok) throw new Error('No pudimos generar el archivo.')
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = match?.[1] ?? fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function exportSalesPath(range: DateRange): string {
  const params = new URLSearchParams(buildDashboardQuery(range))
  return `/api/reports/sales/export/?${params.toString()}`
}

export const INVENTORY_EXPORT_PATH = '/api/reports/inventory/export/'
