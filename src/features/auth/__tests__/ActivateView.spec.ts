import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { authGuard, routes } from '@/app/router'

import ActivateView from '../views/ActivateView.vue'

const server = setupServer(
  http.post('*/api/auth/verify-email/', async ({ request }) => {
    const body = (await request.json()) as { code: string }
    if (body.code !== '482917') {
      return HttpResponse.json(
        { code: ['Código inválido o vencido. Solicita uno nuevo.'] },
        { status: 400 },
      )
    }
    return HttpResponse.json({
      id: 4,
      username: 'nueva',
      email: 'nueva@ejemplo.com',
      first_name: 'Ana',
      last_name: 'Pérez',
      role: 'cashier',
    })
  }),
  http.post('*/api/auth/token/', () => HttpResponse.json({ access: 'a', refresh: 'r' })),
  http.get('*/api/auth/me/', () =>
    HttpResponse.json({
      id: 4,
      username: 'nueva',
      first_name: 'Ana',
      last_name: 'Pérez',
      role: 'cashier',
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

function setup() {
  const router = createRouter({ history: createMemoryHistory(), routes })
  router.beforeEach(authGuard)
  router.push('/activar')
  return router
}

async function fillCode(wrapper: ReturnType<typeof mount>, code: string) {
  const box = wrapper.findAll('input.code__box')[0]!
  await box.trigger('paste', { clipboardData: { getData: () => code } })
}

describe('ActivateView', () => {
  it('con el código correcto activa la cuenta, entra y va a su inicio', async () => {
    const router = setup()
    await router.isReady()
    const wrapper = mount(ActivateView, { global: { plugins: [router] } })
    await wrapper.get('input[type="email"]').setValue('nueva@ejemplo.com')
    await fillCode(wrapper, '482917')
    await wrapper.get('input[autocomplete="new-password"]').setValue('Clave-Nueva-2026')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    await vi.waitFor(() => expect(router.currentRoute.value.path).toBe('/caja'))
  })

  it('con un código inválido muestra el error y conserva el correo', async () => {
    const router = setup()
    await router.isReady()
    const wrapper = mount(ActivateView, { global: { plugins: [router] } })
    await wrapper.get('input[type="email"]').setValue('nueva@ejemplo.com')
    await fillCode(wrapper, '111111')
    await wrapper.get('input[autocomplete="new-password"]').setValue('Clave-Nueva-2026')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Código inválido o vencido')
    expect((wrapper.get('input[type="email"]').element as HTMLInputElement).value).toBe(
      'nueva@ejemplo.com',
    )
    expect(router.currentRoute.value.path).toBe('/activar')
  })

  it('no envía si el código no tiene 6 dígitos', async () => {
    const router = setup()
    await router.isReady()
    const wrapper = mount(ActivateView, { global: { plugins: [router] } })
    await wrapper.get('input[type="email"]').setValue('nueva@ejemplo.com')
    await fillCode(wrapper, '482')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('El código debe tener 6 dígitos.')
  })
})
