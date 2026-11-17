import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { authGuard, routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import { buildMovementQuery, previewResult } from '../api'
import MovementDialog from '../components/MovementDialog.vue'
import StockView from '../views/StockView.vue'

const MOVEMENTS = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      product: 1,
      product_name: 'Pintura látex blanco 1 gal',
      product_sku: 'PIN-001',
      movement_type: 'in',
      movement_type_display: 'Entrada',
      quantity: 20,
      stock_before: 21,
      stock_after: 41,
      note: 'Factura 0031',
      sale: null,
      user: 1,
      user_name: 'admin',
      created_at: '2026-11-16T10:00:00-05:00',
    },
  ],
}
const PRODUCTS = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 2,
      sku: 'ELE-003',
      name: 'Interruptor simple empotrable',
      stock: 9,
      min_stock: 15,
      is_low_stock: true,
      cost_price: '5.20',
      sale_price: '9.50',
      is_active: true,
    },
  ],
}

const requests: string[] = []
let created = 0
const server = setupServer(
  http.get('*/api/stock-movements/', ({ request }) => {
    requests.push(request.url)
    return HttpResponse.json(MOVEMENTS)
  }),
  http.post('*/api/stock-movements/', async ({ request }) => {
    const body = (await request.json()) as { quantity: number; movement_type: string }
    if (body.movement_type === 'out' && body.quantity > 9) {
      return HttpResponse.json(
        { quantity: ['Stock insuficiente para «Interruptor»: disponible 9, solicitado 50.'] },
        { status: 400 },
      )
    }
    created++
    return HttpResponse.json({ id: 9 }, { status: 201 })
  }),
  http.get('*/api/reports/low-stock/', () => HttpResponse.json(PRODUCTS.results)),
  http.get('*/api/products/', () => HttpResponse.json(PRODUCTS)),
)

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  server.listen({ onUnhandledRequest: 'error' })
})
afterAll(() => server.close())
beforeEach(() => {
  setActivePinia(createPinia())
  requests.length = 0
  created = 0
})
afterEach(() => server.resetHandlers())

function mountAs(
  role: 'admin' | 'cashier' | 'warehouse',
  component: unknown,
  path = '/inventario',
) {
  useSessionStore().setUser({ id: 1, username: 'u', fullName: 'U', role })
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(component as never, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
}

describe('filtros del kardex', () => {
  it('traduce tipo, producto y fechas a parámetros de la API', () => {
    expect(
      buildMovementQuery({
        product: 2,
        movement_type: 'out',
        date_from: '2026-11-01',
        date_to: '2026-11-16',
        search: 'merma',
        page: 2,
      }),
    ).toEqual({
      product: 2,
      movement_type: 'out',
      date_from: '2026-11-01',
      date_to: '2026-11-16',
      search: 'merma',
      page: 2,
    })
  })
})

describe('vista previa del movimiento', () => {
  it('calcula el stock resultante de una entrada, salida y conteo', () => {
    expect(previewResult({ stock: 12, type: 'in', quantity: 3 })).toEqual({ after: 15, delta: 3 })
    expect(previewResult({ stock: 12, type: 'out', quantity: 5 })).toEqual({ after: 7, delta: -5 })
    expect(previewResult({ stock: 9, type: 'adjustment', quantity: 7 })).toEqual({
      after: 7,
      delta: -2,
    })
  })
})

describe('kardex', () => {
  it('muestra antes → después y el usuario de cada movimiento', async () => {
    const wrapper = mountAs('warehouse', StockView)
    await flushPromises()
    expect(wrapper.text()).toContain('PIN-001')
    expect(wrapper.text()).toContain('21 → 41')
    expect(wrapper.text()).toContain('admin')
    wrapper.unmount()
  })

  it('el filtro por tipo envía movement_type a la API', async () => {
    const wrapper = mountAs('warehouse', StockView)
    await flushPromises()
    await wrapper.get('select[name="movement-type"]').setValue('out')
    await flushPromises()
    expect(requests[requests.length - 1]).toContain('movement_type=out')
    wrapper.unmount()
  })

  it('el cajero no puede abrir inventario y lo lleva a caja', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.beforeEach(authGuard)
    useSessionStore().setUser({ id: 2, username: 'c', fullName: 'C', role: 'cashier' })
    await router.push('/inventario')
    expect(router.currentRoute.value.path).toBe('/caja')
  })
})

describe('registrar movimiento', () => {
  it('una salida mayor al stock muestra el error en cantidad y no crea nada', async () => {
    const wrapper = mountAs('warehouse', MovementDialog, '/inventario')
    await wrapper.setProps({ open: true, product: PRODUCTS.results[0] } as never)
    await flushPromises()
    await wrapper.get('select[name="movement-type"]').setValue('out')
    await wrapper.get('input[name="quantity"]').setValue('50')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Stock insuficiente')
    expect(created).toBe(0)
    wrapper.unmount()
  })

  it('un conteo igual al stock actual no crea movimiento', async () => {
    const wrapper = mountAs('warehouse', MovementDialog, '/inventario')
    await wrapper.setProps({ open: true, product: PRODUCTS.results[0] } as never)
    await flushPromises()
    await wrapper.get('select[name="movement-type"]').setValue('adjustment')
    await wrapper.get('input[name="quantity"]').setValue('9')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('El conteo coincide con el stock actual.')
    expect(created).toBe(0)
    wrapper.unmount()
  })
})
