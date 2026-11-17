import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { authGuard, routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import CategoriesView from '../views/CategoriesView.vue'
import SuppliersView from '../views/SuppliersView.vue'

let categoryPosts = 0
let supplierPosts = 0

const server = setupServer(
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
          products_count: 4,
          created_at: '',
        },
      ],
    }),
  ),
  http.post('*/api/categories/', async () => {
    categoryPosts++
    return HttpResponse.json({ id: 2 }, { status: 201 })
  }),
  http.get('*/api/suppliers/', () =>
    HttpResponse.json({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 1,
          name: 'Distribuidora Ferretera del Sur S.A.C.',
          tax_id: '20512345678',
          contact_name: 'Rosa Quispe',
          email: '',
          phone: '987654321',
          address: '',
          is_active: true,
          created_at: '',
        },
      ],
    }),
  ),
  http.post('*/api/suppliers/', async () => {
    supplierPosts++
    return HttpResponse.json({ id: 2 }, { status: 201 })
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
  categoryPosts = 0
  supplierPosts = 0
})
afterEach(() => server.resetHandlers())

function mountAs(role: 'admin' | 'cashier' | 'warehouse', component: unknown) {
  useSessionStore().setUser({ id: 1, username: 'u', fullName: 'U', role })
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.push('/categorias')
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(component as never, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
}

describe('categorías', () => {
  it('muestra cuántos productos tiene cada categoría', async () => {
    const wrapper = mountAs('warehouse', CategoriesView)
    await flushPromises()
    expect(wrapper.text()).toContain('Pinturas')
    expect(wrapper.text()).toContain('4')
    wrapper.unmount()
  })

  it('el cajero solo ve las categorías, sin crear', async () => {
    const wrapper = mountAs('cashier', CategoriesView)
    await flushPromises()
    expect(wrapper.text()).toContain('Pinturas')
    expect(wrapper.findAll('button').map((b) => b.text())).not.toContain('Nueva categoría')
    wrapper.unmount()
  })

  it('crear una categoría sin nombre no envía nada', async () => {
    const wrapper = mountAs('warehouse', CategoriesView)
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Nueva categoría')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Escribe el nombre de la categoría.')
    expect(categoryPosts).toBe(0)
    wrapper.unmount()
  })
})

describe('proveedores', () => {
  it('el cajero no tiene acceso: la guarda de ruta no lo deja entrar', async () => {
    useSessionStore().setUser({ id: 1, username: 'c', fullName: 'C', role: 'cashier' })
    const router = createRouter({ history: createMemoryHistory(), routes })
    router.beforeEach(authGuard)
    await router.push('/proveedores')
    expect(router.currentRoute.value.path).toBe('/caja')
  })

  it('el RUC debe tener 11 dígitos antes de enviar', async () => {
    const wrapper = mountAs('warehouse', SuppliersView)
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Nuevo proveedor')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('input[name="name"]').setValue('Proveedor X')
    await wrapper.get('input[name="tax_id"]').setValue('2051')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('El RUC debe tener 11 dígitos.')
    expect(supplierPosts).toBe(0)
    wrapper.unmount()
  })
})
