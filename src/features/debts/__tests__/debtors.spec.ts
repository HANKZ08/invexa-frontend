import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import DebtorsView from '../views/DebtorsView.vue'

const DEBTOR = {
  id: 5,
  name: 'Constructora Andina S.A.C.',
  document_id: '20556677881',
  email: '',
  phone: '',
  created_at: '',
  debt: '6.80',
  pending_sales: 1,
}
const PENDING_SALE = {
  id: 80,
  number: 'V-000080',
  status: 'pending',
  status_display: 'Pendiente',
  customer: 5,
  customer_name: DEBTOR.name,
  total: '11.80',
  balance: '6.80',
  amount_paid: '5.00',
  created_at: '2026-11-16T10:00:00-05:00',
  payment_method: 'cash',
  payment_method_display: 'Efectivo',
  items: [],
  payments: [],
  debt_payments: [],
}

let abonoBody: unknown = null
const server = setupServer(
  http.get('*/api/customers/', () =>
    HttpResponse.json({ count: 1, next: null, previous: null, results: [DEBTOR] }),
  ),
  http.get('*/api/sales/', () =>
    HttpResponse.json({ count: 1, next: null, previous: null, results: [PENDING_SALE] }),
  ),
  http.post('*/api/sales/:id/pay-debt/', async ({ request }) => {
    abonoBody = await request.json()
    return HttpResponse.json({ ...PENDING_SALE, balance: '4.80', status: 'pending' })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  setActivePinia(createPinia())
  useSessionStore().setUser({ id: 1, username: 'a', fullName: 'A', role: 'admin' })
  abonoBody = null
})
afterEach(() => server.resetHandlers())

async function mountDebtors() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/deudores')
  await router.isReady()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(DebtorsView, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
}

describe('deudores', () => {
  it('lista los clientes con saldo y lo que deben', async () => {
    const wrapper = await mountDebtors()
    await flushPromises()
    expect(wrapper.text()).toContain('Constructora Andina')
    expect(wrapper.text()).toContain('6.80')
    wrapper.unmount()
  })

  it('un abono envía el monto y el medio a la venta pendiente', async () => {
    const wrapper = await mountDebtors()
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.findAll('button').some((b) => b.text() === 'Ver ventas')).toBe(true),
    )
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Ver ventas')!
      .trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('V-000080'))
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Registrar abono')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('select[name="abono-method"]').setValue('yape')
    await wrapper.get('input[name="abono-amount"]').setValue('2')
    await wrapper.get('input[name="abono-ref"]').setValue('OP-99')
    await wrapper.get('form[data-abono]').trigger('submit')
    await vi.waitFor(() =>
      expect(abonoBody).toEqual({
        payments: [{ method: 'yape', amount: '2', reference: 'OP-99' }],
      }),
    )
    wrapper.unmount()
  })

  it('un abono digital sin número de operación no se envía', async () => {
    const wrapper = await mountDebtors()
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.findAll('button').some((b) => b.text() === 'Ver ventas')).toBe(true),
    )
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Ver ventas')!
      .trigger('click')
    await vi.waitFor(() => expect(wrapper.text()).toContain('V-000080'))
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Registrar abono')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('select[name="abono-method"]').setValue('plin')
    await wrapper.get('input[name="abono-amount"]').setValue('2')
    await wrapper.get('form[data-abono]').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Escribe el número de operación')
    expect(abonoBody).toBeNull()
    wrapper.unmount()
  })
})
