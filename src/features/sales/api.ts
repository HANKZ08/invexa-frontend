/** Historial de ventas, anulación y clientes. */
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type SaleListItem = components['schemas']['SaleList']
export type SaleDetail = components['schemas']['Sale']
export type CustomerRow = components['schemas']['Customer']

export interface SaleFilters {
  page_size?: number
  search?: string
  status?: string
  payment_method?: string
  date_from?: string
  date_to?: string
  page?: number
}

export function buildSaleQuery(filters: SaleFilters): Record<string, string | number> {
  const query: Record<string, string | number> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = value as string | number
  }
  return query
}

/** DNI de 8 dígitos o RUC de 11. */
export function isDocumentValid(value: string): boolean {
  return /^(\d{8}|\d{11})$/.test(value.trim())
}

export function fetchSales(filters: SaleFilters) {
  return unwrap(api.GET('/api/sales/', { params: { query: buildSaleQuery(filters) } }))
}

export function fetchSale(id: number) {
  return unwrap(api.GET('/api/sales/{id}/', { params: { path: { id } } }))
}

export function cancelSale(id: number, reason: string) {
  return unwrap(api.POST('/api/sales/{id}/cancel/', { params: { path: { id } }, body: { reason } }))
}

export function fetchCustomers(search: string, page = 1, pageSize = 25) {
  return unwrap(
    api.GET('/api/customers/', {
      params: { query: { search: search || undefined, page, page_size: pageSize } },
    }),
  )
}

export function saveCustomer(
  body: { name: string; document_id: string; email: string; phone: string },
  id?: number,
) {
  return id
    ? unwrap(api.PATCH('/api/customers/{id}/', { params: { path: { id } }, body }))
    : unwrap(api.POST('/api/customers/', { body }))
}
