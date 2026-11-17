/** Identidad de la tienda: nombre, logos y favicon. Se carga al iniciar la app. */
import { defineStore } from 'pinia'
import { ref } from 'vue'

import { fetchShop, type ShopPublic } from '@/features/shop/api'

export const DEFAULT_SHOP_NAME = 'Ferretería El Tornillo'
const DEFAULT_FAVICON = '/favicon.ico'

export const useShopStore = defineStore('shop', () => {
  const name = ref(DEFAULT_SHOP_NAME)
  const logoUrl = ref<string | null>(null)
  const iconUrl = ref<string | null>(null)

  /** Aplica los datos recibidos de la API; sin ícono propio se usa el favicon estándar. */
  function apply(data: Pick<ShopPublic, 'name' | 'logo_url' | 'icon_url'>) {
    name.value = data.name
    logoUrl.value = data.logo_url ?? null
    iconUrl.value = data.icon_url ?? null
    syncFavicon()
  }

  /** Si la API no responde, la app sigue con los valores por defecto. */
  async function load() {
    try {
      apply(await fetchShop())
    } catch {
      syncFavicon()
    }
  }

  function syncFavicon() {
    if (typeof document === 'undefined') return
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    if (link) link.href = iconUrl.value ?? DEFAULT_FAVICON
  }

  return { name, logoUrl, iconUrl, apply, load }
})
