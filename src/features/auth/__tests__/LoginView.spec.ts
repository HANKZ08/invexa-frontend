import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { authGuard, routes } from '@/app/router'

import LoginView from '../views/LoginView.vue'

const server = setupServer(
  http.post('*/api/auth/token/', async ({ request }) => {
    const body = (await request.json()) as { password: string }
    if (body.password !== 'Invexa2026!') {
      return HttpResponse.json({ detail: 'Credenciales inválidas.' }, { status: 401 })
    }
    return HttpResponse.json({ access: 'a', refresh: 'r' })
  }),
  http.get('*/api/auth/me/', () =>
    HttpResponse.json({
      id: 1,
      username: 'admin',
      first_name: 'Carmen',
      last_name: 'Salazar',
      role: 'admin',
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
})
afterEach(() => server.resetHandlers())

function setup(path = '/login') {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach(authGuard)
  router.push(path)
  return { router }
}

describe('LoginView', () => {
  it('con credenciales correctas entra a la pantalla de inicio del rol', async () => {
    const { router } = setup()
    await router.isReady()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    await wrapper.get('input[autocomplete="username"]').setValue('admin')
    await wrapper.get('input[type="password"]').setValue('Invexa2026!')
    await wrapper.get('form').trigger('submit')
    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/dashboard'), {
      timeout: 4000,
    })
  })

  it('con credenciales inválidas muestra el error sin borrar el usuario', async () => {
    const { router } = setup()
    await router.isReady()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    await wrapper.get('input[autocomplete="username"]').setValue('admin')
    await wrapper.get('input[type="password"]').setValue('mal')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Credenciales inválidas.')
    expect((wrapper.get('input[autocomplete="username"]').element as HTMLInputElement).value).toBe(
      'admin',
    )
    expect(router.currentRoute.value.path).toBe('/login')
  })

  it('exige usuario y contraseña antes de enviar', async () => {
    const { router } = setup()
    await router.isReady()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('Escribe tu usuario.')
    expect(wrapper.text()).toContain('Escribe tu contraseña.')
  })

  it('después de entrar vuelve a la ruta que pidió', async () => {
    const { router } = setup('/login?redirect=/productos')
    await router.isReady()
    const wrapper = mount(LoginView, { global: { plugins: [router] } })

    await wrapper.get('input[autocomplete="username"]').setValue('admin')
    await wrapper.get('input[type="password"]').setValue('Invexa2026!')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/productos'), {
      timeout: 4000,
    })
  })
})
