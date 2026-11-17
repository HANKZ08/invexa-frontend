import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'

import { navFor } from '@/app/nav'
import { useShopStore } from '@/stores/shop'

import SettingsView from '../views/SettingsView.vue'

const ADMIN_SHOP = {
  name: 'Ferretería El Tornillo',
  legal_name: '',
  tax_id: '',
  address: '',
  phone: '',
  tax_rate: '0.1800',
  currency_symbol: 'S/',
  logo_url: null,
  icon_url: null,
}

const server = setupServer()
let savedBody: FormData | null = null

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  setActivePinia(createPinia())
  savedBody = null
})
afterEach(() => server.resetHandlers())

describe('tienda: identidad', () => {
  it('al cargar, la tienda toma el nombre y los logos que devuelve la API', async () => {
    server.use(
      http.get('*/api/shop/settings/', () =>
        HttpResponse.json({
          name: 'Ferretería Central',
          logo_url: 'https://api.test/media/shop/logo.png',
          icon_url: null,
        }),
      ),
    )
    const shop = useShopStore()
    await shop.load()

    expect(shop.name).toBe('Ferretería Central')
    expect(shop.logoUrl).toBe('https://api.test/media/shop/logo.png')
    expect(shop.iconUrl).toBeNull()
  })

  it('si la API no responde, la tienda mantiene el nombre por defecto', async () => {
    server.use(http.get('*/api/shop/settings/', () => HttpResponse.json({}, { status: 500 })))
    const shop = useShopStore()
    await shop.load()
    expect(shop.name).toBe('Ferretería El Tornillo')
  })
})

describe('menú de configuración', () => {
  it('solo el administrador ve Configuración en el menú', () => {
    const labelsFor = (role: 'admin' | 'cashier' | 'warehouse') =>
      navFor(role).flatMap((group) => group.items.map((item) => item.label))

    expect(labelsFor('admin')).toContain('Configuración')
    expect(labelsFor('cashier')).not.toContain('Configuración')
    expect(labelsFor('warehouse')).not.toContain('Configuración')
  })
})

describe('pantalla de configuración', () => {
  it('el administrador cambia el nombre y se envía con el IGV en fracción', async () => {
    server.use(
      http.get('*/api/shop/settings/', () => HttpResponse.json(ADMIN_SHOP)),
      http.patch('*/api/shop/settings/', async ({ request }) => {
        savedBody = await request.formData()
        return HttpResponse.json({ ...ADMIN_SHOP, name: 'Ferretería Central' })
      }),
    )
    const wrapper = mount(SettingsView, {
      global: {
        plugins: [
          [
            VueQueryPlugin,
            { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          ],
        ],
      },
      attachTo: document.body,
    })
    await vi.waitFor(() =>
      expect(wrapper.get('input[name="name"]').element).toHaveProperty(
        'value',
        'Ferretería El Tornillo',
      ),
    )

    await wrapper.get('input[name="name"]').setValue('Ferretería Central')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(savedBody).not.toBeNull())
    await flushPromises()

    expect(savedBody?.get('name')).toBe('Ferretería Central')
    expect(savedBody?.get('tax_rate')).toBe('0.1800')
    expect(useShopStore().name).toBe('Ferretería Central')
    wrapper.unmount()
  })
})
