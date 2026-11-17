import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { authGuard, routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import CajaView from '../views/CajaView.vue'

const PINTURA = {
  id: 1,
  sku: 'PIN-001',
  barcode: '7701234567890',
  name: 'Pintura látex blanco 1 gal',
  sale_price: '49.90',
  stock: 41,
  is_active: true,
  cost_price: '32.00',
  min_stock: 5,
  is_low_stock: false,
  description: '',
  category: 1,
  category_name: 'Pinturas',
  supplier: null,
  supplier_name: null,
  created_at: '',
  updated_at: '',
}

let saleBody: Record<string, unknown> | null = null
const server = setupServer(
  http.get('*/api/products/', ({ request }) => {
    const q = new URL(request.url).searchParams.get('search') ?? ''
    const results = q === '' || q === '7701234567890' || q === 'PIN-001' ? [PINTURA] : []
    return HttpResponse.json({ count: results.length, next: null, previous: null, results })
  }),
  http.post('*/api/sales/', async ({ request }) => {
    saleBody = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      {
        id: 81,
        number: 'V-000081',
        total: '58.88',
        change: '41.12',
        amount_paid: '100.00',
        items: [],
      },
      { status: 201 },
    )
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  saleBody = null
})
afterEach(() => server.resetHandlers())

async function mountCaja() {
  useSessionStore().setUser({ id: 2, username: 'c', fullName: 'Luis Ramírez', role: 'cashier' })
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach(authGuard)
  await router.push('/caja')
  await router.isReady()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = mount(CajaView, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
  // El buscador va cerrado: los tests lo abren como lo haría la cajera.
  await wrapper.get('button.open-search').trigger('click')
  return wrapper
}

describe('caja: escaneo', () => {
  it('escanear el código de barras y pulsar Enter agrega el producto al carrito', async () => {
    const wrapper = await mountCaja()
    const search = wrapper.get('input[name="scan"]')
    await search.setValue('7701234567890')
    await search.trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(wrapper.text()).toContain('Pintura látex blanco 1 gal')
    expect(wrapper.get('input[name="scan"]').element).toBe(document.activeElement)
    wrapper.unmount()
  })

  it('un código que no existe muestra un aviso y no agrega nada', async () => {
    const wrapper = await mountCaja()
    const search = wrapper.get('input[name="scan"]')
    await search.setValue('000000')
    await search.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(wrapper.text()).toContain('No encontramos «000000»')
    wrapper.unmount()
  })
})

describe('caja: cobro', () => {
  it('en efectivo, si lo recibido no alcanza, el botón de cobro queda bloqueado', async () => {
    const wrapper = await mountCaja()
    const search = wrapper.get('input[name="scan"]')
    await search.setValue('PIN-001')
    await search.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    await wrapper.get('input[name="pay-amount"]').setValue('10')
    expect((wrapper.get('button[data-pay]').element as HTMLButtonElement).disabled).toBe(true)
    wrapper.unmount()
  })

  it('cobrar envía los productos, el método y el monto recibido, y muestra el número y el cambio', async () => {
    const wrapper = await mountCaja()
    const search = wrapper.get('input[name="scan"]')
    await search.setValue('PIN-001')
    await search.trigger('keydown', { key: 'Enter' })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Pintura látex blanco 1 gal'))
    await wrapper.get('input[name="pay-amount"]').setValue('100')
    await flushPromises()
    await wrapper.get('button[data-pay]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('V-000081'))

    expect(saleBody).toMatchObject({
      payments: [{ method: 'cash', amount: '100', reference: '' }],
      items: [{ product: 1, quantity: 1 }],
    })
    expect(wrapper.text()).toContain('V-000081')
    expect(wrapper.text().replace(/ /g, ' ')).toContain('S/ 41.12')
    wrapper.unmount()
  })
})

describe('caja: pagos múltiples', () => {
  it('Yape más efectivo se envían como dos pagos y el cambio sale del efectivo', async () => {
    const wrapper = await mountCaja()
    const search = wrapper.get('input[name="scan"]')
    await search.setValue('PIN-001')
    await search.trigger('keydown', { key: 'Enter' })
    await vi.waitFor(() => expect(wrapper.text()).toContain('Pintura látex blanco 1 gal'))

    await wrapper.get('select[name="pay-method-0"]').setValue('yape')
    await wrapper.get('input[name="pay-amount"]').setValue('40')
    await wrapper.get('input[name="pay-ref"]').setValue('OP-778812')
    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Agregar otro medio'))!
      .trigger('click')
    await flushPromises()
    await wrapper.get('select[name="pay-method-1"]').setValue('cash')
    await wrapper.findAll('input[name="pay-amount"]')[1]!.setValue('20')
    await flushPromises()

    expect(wrapper.text().replace(/ /g, ' ')).toContain('Cambio (en efectivo): S/ 1.12')
    await wrapper.get('button[data-pay]').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('V-000081'))

    expect(saleBody).toMatchObject({
      payments: [
        { method: 'yape', amount: '40', reference: 'OP-778812' },
        { method: 'cash', amount: '20', reference: '' },
      ],
    })
    wrapper.unmount()
  })
})

describe('caja: buscador con lista de productos', () => {
  it('al enfocar el buscador aparecen los productos y un clic agrega el producto', async () => {
    const wrapper = await mountCaja()
    await wrapper.get('input[name="scan"]').trigger('focus')
    await vi.waitFor(() => expect(wrapper.find('ul[aria-label="Productos"]').exists()).toBe(true))
    await wrapper.get('ul[aria-label="Productos"] button').trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('Pintura látex blanco 1 gal'))
    wrapper.unmount()
  })

  it('escribir un espacio muestra la lista completa de productos', async () => {
    const wrapper = await mountCaja()
    await wrapper.get('input[name="scan"]').setValue(' ')
    await vi.waitFor(() => expect(wrapper.find('ul[aria-label="Productos"]').exists()).toBe(true))
    wrapper.unmount()
  })
})

describe('caja: buscador cerrado al entrar', () => {
  it('el buscador empieza cerrado y se abre con el botón', async () => {
    useSessionStore().setUser({ id: 2, username: 'c', fullName: 'Luis Ramírez', role: 'cashier' })
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.beforeEach(authGuard)
    await router.push('/caja')
    await router.isReady()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const wrapper = mount(CajaView, {
      global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
      attachTo: document.body,
    })
    expect(wrapper.find('input[name="scan"]').exists()).toBe(false)
    await wrapper.get('button.open-search').trigger('click')
    expect(wrapper.find('input[name="scan"]').exists()).toBe(true)
    wrapper.unmount()
  })
})
