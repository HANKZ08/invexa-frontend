/** Kardex y movimientos de stock: filtros, vista previa y llamadas a la API. */
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type StockMovement = components['schemas']['StockMovement']
export type MovementType = 'in' | 'out' | 'adjustment'

export interface MovementFilters {
  page_size?: number
  product?: number
  movement_type?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
}

export function buildMovementQuery(filters: MovementFilters): Record<string, string | number> {
  const query: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = value as string | number
  }
  return query
}

/** Stock que quedará después del movimiento, antes de confirmarlo. */
export function previewResult(input: { stock: number; type: MovementType; quantity: number }): {
  after: number
  delta: number
} {
  if (input.type === 'in') return { after: input.stock + input.quantity, delta: input.quantity }
  if (input.type === 'out') return { after: input.stock - input.quantity, delta: -input.quantity }
  return { after: input.quantity, delta: input.quantity - input.stock }
}

export function fetchMovements(filters: MovementFilters) {
  return unwrap(
    api.GET('/api/stock-movements/', { params: { query: buildMovementQuery(filters) } }),
  )
}

export function createMovement(body: {
  product: number
  movement_type: MovementType
  quantity: number
  note: string
}) {
  return unwrap(api.POST('/api/stock-movements/', { body }))
}

export function fetchLowStock() {
  return unwrap(api.GET('/api/reports/low-stock/'))
}
