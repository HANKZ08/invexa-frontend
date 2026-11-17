import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { authGuard, routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import { buildDashboardQuery, periodRange } from '../api'
import DashboardView from '../views/DashboardView.vue'

const DASHBOARD = {
  date_from: '2026-10-18',
  date_to: '2026-11-16',
  summary: {
    sales_count: 80,
    revenue: '6455.90',
    tax: '984.80',
    discounts: '0.00',
    units_sold: 429,
    gross_profit: '2212.42',
    average_ticket: '80.70',
    cancelled_count: 1,
  },
  inventory: { products_count: 25, inventory_cost: '11402.28', low_stock_count: 3 },
  sales_by_day: [
    { day: '2026-11-15', sales_count: 4, revenue: '96.64' },
    { day: '2026-11-16', sales_count: 6, revenue: '243.67' },
  ],
  sales_by_payment_method: [
    {
      payment_method: 'cash',
      payment_method_display: 'Efectivo',
      sales_count: 40,
      revenue: '2231.63',
    },
    { payment_method: 'yape', payment_method_display: 'Yape', sales_count: 20, revenue: '1100.00' },
  ],
  top_products: [
    {
      product_id: 1,
      product_sku: 'PIN-001',
      product_name: 'Pintura látex',
      units_sold: 28,
      revenue: '1397.20',
    },
  ],
}

const plain = (text: string) => text.replace(/ | /g, ' ')

const requested: string[] = []
const server = setupServer(
  http.get('*/api/reports/dashboard/', ({ request }) => {
    requested.push(request.url)
    return HttpResponse.json(DASHBOARD)
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  setActivePinia(createPinia())
  useSessionStore().setUser({ id: 1, username: 'a', fullName: 'A', role: 'admin' })
  requested.length = 0
})
afterEach(() => server.resetHandlers())

async function mountDashboard() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach(authGuard)
  await router.push('/dashboard')
  await router.isReady()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(DashboardView, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
}

describe('periodos del dashboard', () => {
  it('"Hoy" pide un rango de un solo día y "30 días" pide 30 días', () => {
    const now = new Date('2026-11-16T12:00:00-05:00')
    expect(periodRange('today', now)).toEqual({ date_from: '2026-11-16', date_to: '2026-11-16' })
    expect(periodRange('30', now)).toEqual({ date_from: '2026-10-18', date_to: '2026-11-16' })
  })

  it('traduce el rango a parámetros de la API', () => {
    expect(buildDashboardQuery({ date_from: '2026-11-01', date_to: '2026-11-16' })).toEqual({
      date_from: '2026-11-01',
      date_to: '2026-11-16',
    })
  })
})

describe('dashboard', () => {
  it('muestra ingresos, ventas, stock bajo y los medios de pago', async () => {
    const wrapper = await mountDashboard()
    await vi.waitFor(() => expect(plain(wrapper.text())).toContain('S/ 6,455.90'))
    expect(wrapper.text()).toContain('Yape')
    expect(wrapper.text()).toContain('PIN-001')
    wrapper.unmount()
  })

  it('cambiar a "Hoy" vuelve a pedir la API con el día actual', async () => {
    const wrapper = await mountDashboard()
    await vi.waitFor(() => expect(plain(wrapper.text())).toContain('S/ 6,455.90'))
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Hoy')!
      .trigger('click')
    await flushPromises()
    expect(requested[requested.length - 1]).not.toContain('date_from=2026-10-18')
    wrapper.unmount()
  })

  it('la gráfica tiene una barra por día', async () => {
    const wrapper = await mountDashboard()
    await vi.waitFor(() => expect(wrapper.findAll('.bar-col')).toHaveLength(2))
    wrapper.unmount()
  })
})
