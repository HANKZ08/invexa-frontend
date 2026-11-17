import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

import { useSessionStore } from '@/stores/session'

import AppLayout from '../AppLayout.vue'
import { routes, setDocumentTitle } from '../router'

function makeRouter() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.afterEach((to) => setDocumentTitle(to.meta.title))
  return router
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('AppLayout', () => {
  async function mountLayout(role: 'admin' | 'cashier' | 'warehouse', path: string) {
    const router = makeRouter()
    await router.push(path)
    const wrapper = mount(AppLayout, {
      props: { role, userName: 'Luis Ramírez', shopName: 'Ferretería El Tornillo' },
      global: { plugins: [router] },
    })
    await flushPromises()
    return wrapper
  }

  it('muestra solo la navegación del rol', async () => {
    const wrapper = await mountLayout('cashier', '/caja')
    const links = wrapper.findAll('nav a').map((a) => a.text())
    expect(links).toEqual(['Caja', 'Ventas', 'Clientes', 'Deudores', 'Productos', 'Categorías'])
    expect(wrapper.text()).not.toContain('Dashboard')
  })

  it('marca la sección actual con aria-current', async () => {
    const wrapper = await mountLayout('warehouse', '/inventario')
    const current = wrapper.get('nav a[aria-current="page"]')
    expect(current.text()).toBe('Inventario')
  })

  it('ofrece un enlace para saltar al contenido', async () => {
    const wrapper = await mountLayout('admin', '/dashboard')
    expect(wrapper.get('a.skip').attributes('href')).toBe('#contenido')
    expect(wrapper.find('main#contenido').exists()).toBe(true)
  })

  it('muestra el usuario y su rol', async () => {
    const wrapper = await mountLayout('cashier', '/caja')
    expect(wrapper.text()).toContain('Luis Ramírez')
    expect(wrapper.text()).toContain('Cajero')
  })
})

describe('router', () => {
  it('la raíz lleva a la pantalla de inicio del rol', async () => {
    const router = makeRouter()
    useSessionStore().setUser({
      id: 2,
      username: 'cajero',
      fullName: 'Luis Ramírez',
      role: 'cashier',
    })
    await router.push('/')
    expect(router.currentRoute.value.path).toBe('/caja')
  })

  it('pone el título de la pestaña', async () => {
    const router = makeRouter()
    await router.push('/productos')
    expect(document.title).toBe('Productos · Ferretería El Tornillo')
  })

  it('las rutas desconocidas muestran la página 404', async () => {
    const router = makeRouter()
    await router.push('/no-existe')
    expect(router.currentRoute.value.name).toBe('not-found')
  })

  it('cada sección declara sus roles', () => {
    const shell = routes.find((r) => r.path === '/')!
    const sections = shell.children!.filter((r) => r.meta)
    expect(sections.length).toBe(11)
    expect(sections.every((r) => r.meta!.roles && r.meta!.roles.length > 0)).toBe(true)
    expect(sections.find((r) => r.path === 'dashboard')!.meta!.roles).toEqual(['admin'])
  })
})

describe('AppShell', () => {
  it('muestra la pantalla pendiente del rol y el botón Salir', async () => {
    const router = makeRouter()
    useSessionStore().setUser({
      id: 2,
      username: 'cajero',
      fullName: 'Luis Ramírez',
      role: 'cashier',
    })
    await router.push('/caja')
    const { default: App } = await import('@/App.vue')
    const queryClient = new QueryClient()
    const wrapper = mount(App, { global: { plugins: [router, [VueQueryPlugin, { queryClient }]] } })
    await vi.waitFor(() => expect(wrapper.get('h1').text()).toBe('Caja'))
    expect(wrapper.text()).toContain('Salir')
  })

  it('la página 404 ofrece volver al inicio', async () => {
    const router = makeRouter()
    await router.push('/no-existe')
    const { default: App } = await import('@/App.vue')
    const wrapper = mount(App, { global: { plugins: [router] } })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Esta página no existe')
    expect(wrapper.get('a').attributes('href')).toBe('/')
  })
})
