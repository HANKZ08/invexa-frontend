/** Configuración de la tienda: lectura pública y cambios del administrador. */
import { authorizedFetch } from '@/api/client'

/** Lo que cualquier visitante ve (también antes de iniciar sesión). */
export interface ShopPublic {
  name: string
  logo_url: string | null
  icon_url: string | null
}

/** Configuración completa, solo para el administrador. */
export interface ShopAdmin extends ShopPublic {
  legal_name: string
  tax_id: string
  address: string
  phone: string
  /** Fracción como texto, por ejemplo "0.1800" (18 %). */
  tax_rate: string
  currency_symbol: string
}

export const SHOP_PATH = '/api/shop/settings/'

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>
    throw new Error(firstMessage(body))
  }
  return (await response.json()) as T
}

/** Primer mensaje de error de la API, venga como texto, lista o campo. */
export function firstMessage(body: Record<string, unknown>): string {
  const first = Object.values(body).flat()[0]
  if (typeof first === 'string') return first
  return 'No pudimos guardar la configuración.'
}

export async function fetchShop(): Promise<ShopPublic | ShopAdmin> {
  return parse(await authorizedFetch(SHOP_PATH))
}

export async function saveShop(form: FormData): Promise<ShopAdmin> {
  return parse(await authorizedFetch(SHOP_PATH, { method: 'PATCH', body: form }))
}
