/** Llamadas de la caja: productos, clientes, ventas y factura. */
import { api, authorizedFetch, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type Sale = components['schemas']['Sale']
export type Customer = components['schemas']['Customer']

export interface SaleRequest {
  customer?: number | null
  payments: { method: string; amount: string; reference: string }[]
  discount: string
  notes: string
  items: { product: number; quantity: number }[]
}

/** Productos activos que coinciden con el texto (código de barras, SKU o nombre). */
export function searchProducts(search: string) {
  return unwrap(api.GET('/api/products/', { params: { query: { search, is_active: true } } }))
}

export function findCustomer(document: string) {
  return unwrap(api.GET('/api/customers/', { params: { query: { search: document } } }))
}

export function createCustomer(body: { name: string; document_id: string }) {
  return unwrap(api.POST('/api/customers/', { body }))
}

export function createSale(body: SaleRequest) {
  return unwrap(api.POST('/api/sales/', { body: body as never }))
}

/** Descarga la factura PDF con el token del usuario y la abre en otra pestaña. */
export async function openInvoice(saleId: number): Promise<void> {
  const response = await authorizedFetch(`/api/sales/${saleId}/invoice/`)
  if (!response.ok) throw new Error('No pudimos abrir la factura.')
  const url = URL.createObjectURL(await response.blob())
  window.open(url, '_blank', 'noopener')
}
