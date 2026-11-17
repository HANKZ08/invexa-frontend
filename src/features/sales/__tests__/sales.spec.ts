import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { authGuard, routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import { buildSaleQuery, isDocumentValid } from '../api'
import SalesView from '../views/SalesView.vue'
import CustomersView from '../views/CustomersView.vue'

const SALE = {
  id: 80,
  number: 'V-000080',
  status: 'completed',
  status_display: 'Completada',
  customer: null,
  customer_name: null,
  cashier: 2,
  cashier_name: 'cajero',
  payment_method: 'cash',
  payment_method_display: 'Efectivo',
  subtotal: '49.90',
  discount: '0.00',
  tax: '8.98',
  total: '58.88',
  amount_paid: '100.00',
  change: '41.12',
  notes: '',
  items_count: 1,
  created_at: '2026-11-16T10:00:00-05:00',
  cancelled_at: null,
  cancelled_by: null,
  cancellation_reason: '',
  items: [],
}

let cancelBody: unknown = null
let customerPosts = 0
const server = setupServer(
  http.get('*/api/sales/', () =>
    HttpResponse.json({ count: 1, next: null, previous: null, results: [SALE] }),
  ),
  http.post('*/api/sales/:id/cancel/', async ({ request }) => {
    cancelBody = await request.json()
    return HttpResponse.json({ ...SALE, status: 'cancelled', status_display: 'Anulada' })
  }),
  http.get('*/api/customers/', () =>
    HttpResponse.json({ count: 0, next: null, previous: null, results: [] }),
  ),
  http.post('*/api/customers/', () => {
    customerPosts++
    return HttpResponse.json({ id: 9 }, { status: 201 })
  }),
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
  cancelBody = null
  customerPosts = 0
})
afterEach(() => server.resetHandlers())

function mountAs(role: 'admin' | 'cashier', component: unknown, path: string) {
  useSessionStore().setUser({ id: 2, username: 'cajero', fullName: 'Luis', role })
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach(authGuard)
  router.push(path)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(component as never, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
}

describe('filtros y documentos', () => {
  it('traduce los filtros del historial a parámetros de la API', () => {
    expect(
      buildSaleQuery({
        search: 'V-000080',
        status: 'cancelled',
        payment_method: 'cash',
        date_from: '2026-11-01',
      }),
    ).toEqual({
      search: 'V-000080',
      status: 'cancelled',
      payment_method: 'cash',
      date_from: '2026-11-01',
    })
  })

  it('valida DNI de 8 dígitos y RUC de 11', () => {
    expect(isDocumentValid('45781236')).toBe(true)
    expect(isDocumentValid('20512345678')).toBe(true)
    expect(isDocumentValid('7012345')).toBe(false)
    expect(isDocumentValid('abc')).toBe(false)
  })
})

describe('historial de ventas', () => {
  it('muestra el número, el estado y el total de cada venta', async () => {
    const wrapper = mountAs('cashier', SalesView, '/ventas')
    await flushPromises()
    expect(wrapper.text()).toContain('V-000080')
    expect(wrapper.text()).toContain('Completada')
    wrapper.unmount()
  })

  it('anular exige motivo: sin motivo no envía nada', async () => {
    const wrapper = mountAs('admin', SalesView, '/ventas')
    await flushPromises()
    await wrapper
      .findAll('tbody button')
      .find((b) => b.text() === 'Anular')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('form[data-cancel]').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Escribe el motivo de la anulación.')
    expect(cancelBody).toBeNull()
    wrapper.unmount()
  })

  it('anular con motivo envía la anulación a la API', async () => {
    const wrapper = mountAs('admin', SalesView, '/ventas')
    await flushPromises()
    await wrapper
      .findAll('tbody button')
      .find((b) => b.text() === 'Anular')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('input[name="reason"]').setValue('El cliente devolvió la mercadería')
    await wrapper.get('form[data-cancel]').trigger('submit')
    await vi.waitFor(() =>
      expect(cancelBody).toEqual({ reason: 'El cliente devolvió la mercadería' }),
    )
    wrapper.unmount()
  })

  it('el cajero no ve el botón de anular', async () => {
    const wrapper = mountAs('cashier', SalesView, '/ventas')
    await flushPromises()
    expect(wrapper.findAll('tbody button').map((b) => b.text())).not.toContain('Anular')
    wrapper.unmount()
  })
})

describe('clientes', () => {
  it('un DNI de 7 dígitos muestra el error y no guarda', async () => {
    const wrapper = mountAs('cashier', CustomersView, '/clientes')
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Nuevo cliente')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('input[name="name"]').setValue('Juan Pérez')
    await wrapper.get('input[name="document_id"]').setValue('7012345')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('El DNI debe tener 8 dígitos o el RUC 11.')
    expect(customerPosts).toBe(0)
    wrapper.unmount()
  })
})
