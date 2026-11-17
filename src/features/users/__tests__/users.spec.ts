import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { authGuard, routes } from '@/app/router'
import { useSessionStore } from '@/stores/session'

import UsersView from '../views/UsersView.vue'

const USERS = {
  count: 2,
  next: null,
  previous: null,
  results: [
    {
      id: 1,
      username: 'admin',
      first_name: 'Carmen',
      last_name: 'Salazar',
      email: 'a@x.pe',
      role: 'admin',
      role_display: 'Administrador',
      is_active: true,
      email_verified_at: '2026-11-16T10:00:00Z',
    },
    {
      id: 7,
      username: 'nueva',
      first_name: 'Ana',
      last_name: 'Pérez',
      email: 'ana@x.pe',
      role: 'cashier',
      role_display: 'Cajero',
      is_active: false,
      email_verified_at: null,
    },
  ],
}

let createBody: unknown = null
const server = setupServer(
  http.get('*/api/users/', () => HttpResponse.json(USERS)),
  http.post('*/api/users/', async ({ request }) => {
    createBody = await request.json()
    return HttpResponse.json({ email: ['Ya existe una cuenta con este correo.'] }, { status: 400 })
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
  useSessionStore().setUser({ id: 1, username: 'a', fullName: 'A', role: 'admin' })
  createBody = null
})
afterEach(() => server.resetHandlers())

async function mountUsers() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach(authGuard)
  await router.push('/usuarios')
  await router.isReady()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(UsersView, {
    global: { plugins: [router, [VueQueryPlugin, { queryClient }]] },
    attachTo: document.body,
  })
}

describe('usuarios', () => {
  it('muestra el estado de cada cuenta: activa o pendiente de verificar', async () => {
    const wrapper = await mountUsers()
    await vi.waitFor(() => expect(wrapper.text()).toContain('Carmen'))
    expect(wrapper.text()).toContain('Activo')
    expect(wrapper.text()).toContain('Pendiente de verificar')
    wrapper.unmount()
  })

  it('crear un usuario no pide contraseña y el correo repetido aparece en su campo', async () => {
    const wrapper = await mountUsers()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Nuevo usuario')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.find('input[name="password"]').exists()).toBe(false)
    await wrapper.get('input[name="username"]').setValue('nuevo2')
    await wrapper.get('input[name="first_name"]').setValue('Luis')
    await wrapper.get('input[name="last_name"]').setValue('Ramírez')
    await wrapper.get('input[name="email"]').setValue('ana@x.pe')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() =>
      expect(wrapper.text()).toContain('Ya existe una cuenta con este correo.'),
    )
    expect(createBody).toMatchObject({ username: 'nuevo2', email: 'ana@x.pe', role: 'cashier' })
    expect((wrapper.get('input[name="username"]').element as HTMLInputElement).value).toBe('nuevo2')
    wrapper.unmount()
  })

  it('un correo mal escrito no se envía', async () => {
    const wrapper = await mountUsers()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Nuevo usuario')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('input[name="username"]').setValue('x1')
    await wrapper.get('input[name="email"]').setValue('no-es-correo')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.text()).toContain('Escribe un correo válido.')
    expect(createBody).toBeNull()
    wrapper.unmount()
  })
})
