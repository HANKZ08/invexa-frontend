/** Llamadas a la API del catálogo: productos, categorías y proveedores. */
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type Product = components['schemas']['Product']
export type ProductRequest = components['schemas']['ProductRequest']
export type Category = components['schemas']['Category']
export type Supplier = components['schemas']['Supplier']

export interface ProductFilters {
  page_size?: number
  search?: string
  category?: number
  supplier?: number
  low_stock?: boolean
  is_active?: boolean
  ordering?: string
  page?: number
}

/** Quita los filtros vacíos y deja solo lo que la API entiende. */
export function buildProductQuery(
  filters: ProductFilters,
): Record<string, string | number | boolean> {
  const query: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue
    query[key] = value as string | number | boolean
  }
  return query
}

export function fetchProducts(filters: ProductFilters) {
  return unwrap(api.GET('/api/products/', { params: { query: buildProductQuery(filters) } }))
}

export function createProduct(body: ProductRequest) {
  return unwrap(api.POST('/api/products/', { body }))
}

export function updateProduct(id: number, body: Partial<ProductRequest>) {
  return unwrap(api.PATCH('/api/products/{id}/', { params: { path: { id } }, body }))
}

interface Page<T> {
  results: T[]
  next: string | null
}

/** Trae todas las páginas (la API responde de 20 en 20) para usarlas en selectores. */
async function fetchAll<T>(
  fetchPage: (page: number) => Promise<Page<T>>,
): Promise<{ results: T[] }> {
  const results: T[] = []
  for (let page = 1; page <= 50; page++) {
    const data = await fetchPage(page)
    results.push(...data.results)
    if (!data.next) break
  }
  return { results }
}

export function fetchCategories() {
  return fetchAll<Category>(
    (page) =>
      unwrap(api.GET('/api/categories/', { params: { query: { page } } })) as Promise<
        Page<Category>
      >,
  )
}

export function fetchSuppliers() {
  return fetchAll<Supplier>(
    (page) =>
      unwrap(api.GET('/api/suppliers/', { params: { query: { page } } })) as Promise<
        Page<Supplier>
      >,
  )
}
