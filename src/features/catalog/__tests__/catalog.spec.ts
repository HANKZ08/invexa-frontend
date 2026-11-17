import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const plain = (text: string) => text.replace(/ | /g, ' ')
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import { buildProductQuery } from '../api'
import ProductFormDialog from '../components/ProductFormDialog.vue'
import ProductsView from '../views/ProductsView.vue'

const PRODUCTS = {
  count: 2,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      sku: 'PIN-001',
      barcode: null,
      name: 'Pintura látex blanco 1 gal',
      description: '',
      category: 1,
      category_name: 'Pinturas',
      supplier: 2,
      supplier_name: 'Proveedor',
      cost_price: '32.00',
      sale_price: '49.90',
      stock: 41,
      min_stock: 5,
      is_low_stock: false,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
    {
      id: 2,
      sku: 'ELE-003',
      barcode: '7701234567890',
      name: 'Interruptor simple empotrable',
      description: '',
      category: 2,
      category_name: 'Electricidad',
      supplier: null,
      supplier_name: null,
      cost_price: '5.20',
      sale_price: '9.50',
      stock: 9,
      min_stock: 15,
      is_low_stock: true,
      is_active: true,
      created_at: '',
      updated_at: '',
    },
  ],
}

const seen: { url: string }[] = []
let posts = 0
const server = setupServer(
  http.get('*/api/products/', ({ request }) => {
    seen.push({ url: request.url })
    return HttpResponse.json(PRODUCTS)
  }),
  http.get('*/api/suppliers/', () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 2,
          name: 'Proveedor',
          tax_id: '20512345678',
          contact_name: '',
          email: '',
          phone: '',
          address: '',
          is_active: true,
          created_at: '',
        },
      ],
    }),
  ),
  http.get('*/api/categories/', () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          name: 'Pinturas',
          description: '',
          is_active: true,
          products_count: 1,
          created_at: '',
        },
      ],
    }),
  ),
  http.post('*/api/products/', async ({ request }) => {
    posts++
    const body = (await request.json()) as { sku: string }
    if (body.sku === 'PIN-001') {
      return HttpResponse.json({ sku: ['Ya existe un producto con este SKU.'] }, { status: 400 })
    }
    return HttpResponse.json({ id: 9, ...body }, { status: 201 })
  }),
)

beforeAll(() => {
  // jsdom no implementa el <dialog> modal
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
  seen.length = 0
  posts = 0
})
afterEach(() => server.resetHandlers())

function mountWith(
  role: 'admin' | 'cashier' | 'warehouse',
  component: unknown,
  path = '/productos',
) {
  const session = useSessionStore()
  session.setUser({ id: 1, username: 'u', fullName: 'U', role })
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push(path)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(component as never, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
}

describe('buildProductQuery', () => {
  it('traduce los filtros a los parámetros de la API', () => {
    expect(
      buildProductQuery({
        search: 'PIN',
        category: 2,
        low_stock: true,
        ordering: '-stock',
        page: 2,
      }),
    ).toEqual({ search: 'PIN', category: 2, low_stock: true, ordering: '-stock', page: 2 })
  })

  it('omite los filtros vacíos', () => {
    expect(buildProductQuery({ search: '', category: undefined, low_stock: false })).toEqual({
      low_stock: false,
    })
  })
})

describe('ProductsView', () => {
  it('muestra los productos con precio en soles y marca el stock bajo', async () => {
    const wrapper = mountWith('warehouse', ProductsView)
    await flushPromises()
    await new Promise((r) => setTimeout(r, 0))
    expect(wrapper.text()).toContain('PIN-001')
    expect(plain(wrapper.text())).toContain('S/ 49.90')
    expect(wrapper.text()).toContain('Reponer')
    wrapper.unmount()
  })

  it('el filtro de stock bajo envía low_stock=true a la API', async () => {
    const wrapper = mountWith('warehouse', ProductsView)
    await flushPromises()
    await wrapper.get('input[type="checkbox"][name="low-stock"]').setValue(true)
    await flushPromises()
    expect(seen[seen.length - 1]!.url).toContain('low_stock=true')
    wrapper.unmount()
  })

  it('el cajero ve la lista pero no el botón de nuevo producto', async () => {
    const wrapper = mountWith('cashier', ProductsView)
    await flushPromises()
    expect(wrapper.text()).toContain('PIN-001')
    expect(wrapper.findAll('button').map((b) => b.text())).not.toContain('Nuevo producto')
    wrapper.unmount()
  })
})

describe('ProductFormDialog', () => {
  it('bloquea un precio de venta menor al costo antes de enviar', async () => {
    const wrapper = mountWith('warehouse', ProductFormDialog, '/productos')
    await wrapper.setProps({ open: true, product: null } as never)
    await flushPromises()
    await flushPromises()
    await wrapper.get('select[name="category"]').setValue('1')
    await wrapper.get('input[name="sku"]').setValue('NEW-1')
    await wrapper.get('input[name="name"]').setValue('Nuevo')
    await wrapper.get('input[name="cost_price"]').setValue('10')
    await wrapper.get('input[name="sale_price"]').setValue('5')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('El precio de venta no puede ser menor al costo.')
    expect(posts).toBe(0)
    wrapper.unmount()
  })

  it('un SKU repetido muestra el error junto al campo sin perder lo escrito', async () => {
    const wrapper = mountWith('warehouse', ProductFormDialog, '/productos')
    await wrapper.setProps({ open: true, product: null } as never)
    await flushPromises()
    await flushPromises()
    await wrapper.get('select[name="category"]').setValue('1')
    await wrapper.get('input[name="sku"]').setValue('PIN-001')
    await wrapper.get('input[name="name"]').setValue('Pintura')
    await wrapper.get('input[name="cost_price"]').setValue('10')
    await wrapper.get('input[name="sale_price"]').setValue('20')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Ya existe un producto con este SKU.')
    expect((wrapper.get('input[name="name"]').element as HTMLInputElement).value).toBe('Pintura')
    wrapper.unmount()
  })
})
